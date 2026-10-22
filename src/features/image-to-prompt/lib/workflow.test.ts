import { act, cleanup, renderHook } from "@testing-library/react";
import { createElement, StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalysisAsset, AnalysisDetail, AnalysisHistory, AnalysisStatus, AnalysisSummary } from "@/types/prompt-analysis";
import { ApiError, promptAnalysisClient, type PromptAnalysisClient } from "./client";
import { createPromptAnalysisWorkflow, usePromptAnalysis } from "./workflow";

const image = (name = "one.png") => new File(["image"], name, { type: "image/png" });
const asset: AnalysisAsset = { id: "asset", width: 2, height: 3, byte_size: 5, preview_url: "/asset", thumbnail_url: "/thumbnail", preview_expires_at: "later" };
const prompt = { zh: "中文提示词", en: "English prompt" };
function detail(status: AnalysisStatus = "succeeded", id = "job"): AnalysisDetail {
  return { id, asset_id: "asset", status, phase: status, revision: 0, created_at: "today", finished_at: null, title: "Title", error_code: null, history_retain_until: "later", image_available: true, preview_url: "/fresh-" + id, thumbnail_url: "/thumb", preview_expires_at: "later", prompt: status === "succeeded" ? prompt : null, result: null, saved_to_history: status === "succeeded" };
}
const summary = (id: string): AnalysisSummary => ({ ...detail("succeeded", id), summary: prompt });
const page = (ids: string[], next: string | null = null): AnalysisHistory => ({ items: ids.map(summary), pagination: { limit: 20, has_more: !!next, next_cursor: next } });
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function api(): PromptAnalysisClient {
  return {
    upload: vi.fn().mockResolvedValue(asset), create: vi.fn().mockResolvedValue(detail("queued")),
    detail: vi.fn().mockResolvedValue(detail()), update: vi.fn().mockImplementation(async (id, revision, value) => ({ ...detail("succeeded", id), revision: revision + 1, prompt: value })),
    history: vi.fn().mockResolvedValue(page([])), remove: vi.fn().mockResolvedValue(undefined),
  };
}
const owned: ReturnType<typeof createPromptAnalysisWorkflow>[] = [];
function setup(client = api(), options: { enabled?: boolean; onUnauthorized?: () => void; identity?: string | null } = {}) {
  const flow = createPromptAnalysisWorkflow({ client, ...options });
  owned.push(flow);
  return { flow, client, state: flow.getSnapshot };
}
async function selectAndStart(flow: ReturnType<typeof createPromptAnalysisWorkflow>) {
  flow.selectFile(image());
  await flow.start();
}
async function tick(ms: number) { await vi.advanceTimersByTimeAsync(ms); }

beforeEach(() => {
  vi.useFakeTimers();
  URL.createObjectURL = vi.fn(file => "blob:" + (file as File).name);
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => { cleanup(); owned.splice(0).forEach(flow => flow.destroy()); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("image-to-prompt workflow", () => {
  it("scrubs all private state on account change and fences previous queries and saves", async () => {
    const { flow, client, state } = setup(api(), { identity: "account-a" });
    vi.mocked(client.history).mockResolvedValueOnce(page(["private-a"], "private-cursor"));
    await flow.loadHistory();
    await selectAndStart(flow);
    await tick(2000);
    flow.edit("zh", "account-a private draft");
    const patch = deferred<AnalysisDetail>();
    const get = deferred<AnalysisDetail>();
    vi.mocked(client.update).mockReturnValueOnce(patch.promise);
    vi.mocked(client.detail).mockReturnValueOnce(get.promise);
    const saving = flow.retrySave();
    const reading = flow.resume();
    const saveSignal = vi.mocked(client.update).mock.calls[0][3];
    const getSignal = vi.mocked(client.detail).mock.calls.at(-1)![1];
    flow.setEnabled(false);
    flow.setIdentity(null);
    flow.setIdentity("account-b");
    flow.setEnabled(true);
    expect(state()).toMatchObject({ file: null, previewUrl: null, asset: null, analysis: null, draft: { zh: "", en: "" }, history: [], hasMore: false, saved: false, saving: false });
    expect(saveSignal?.aborted).toBe(true);
    expect(getSignal?.aborted).toBe(true);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:one.png");
    patch.resolve({ ...detail(), revision: 1, prompt: { ...prompt, zh: "account-a private draft" } });
    get.resolve(detail());
    await Promise.all([saving, reading]);
    await tick(3000);
    expect(state().analysis).toBeNull();
    expect(state().draft).toEqual({ zh: "", en: "" });
    expect(state().history).toEqual([]);
    expect(client.create).toHaveBeenCalledTimes(1);
  });

  it("retains only a new unuploaded selection and its start intent for initial anonymous login", async () => {
    const { flow, client, state } = setup(api(), { identity: null });
    vi.mocked(client.upload).mockRejectedValueOnce(new ApiError(401, "UNAUTHORIZED"));
    await selectAndStart(flow);
    flow.setEnabled(false);
    flow.setIdentity("account-a");
    expect(state()).toMatchObject({ file: expect.any(File), previewUrl: "blob:one.png", asset: null, analysis: null, error: null });
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    flow.setEnabled(true);
    await tick(0);
    expect(client.create).toHaveBeenCalledTimes(1);
    expect(state().analysis?.id).toBe("job");
    flow.setIdentity("account-a");
    flow.setEnabled(true);
    await tick(0);
    expect(client.create).toHaveBeenCalledTimes(1);
    flow.setIdentity(null);
    flow.selectFile(image("after-logout.png"));
    flow.setIdentity("account-b");
    expect(state().file).toBeNull();
    expect(state().previewUrl).toBeNull();
  });

  it("never preserves an uploaded asset or known analysis from an anonymous identity scope", async () => {
    const { flow, client, state } = setup();
    vi.mocked(client.create).mockRejectedValueOnce(new ApiError(401, "UNAUTHORIZED"));
    await selectAndStart(flow);
    expect(state().asset).not.toBeNull();
    flow.setIdentity("account-a");
    expect(state()).toMatchObject({ file: null, previewUrl: null, asset: null, analysis: null, draft: { zh: "", en: "" } });
    await flow.resume();
    expect(client.create).toHaveBeenCalledTimes(1);
  });

  it.each([403, 404])("removes inaccessible private content when a detail request returns %s", async status => {
    const { flow, client, state } = setup(api(), { identity: "account-a" });
    await selectAndStart(flow);
    await tick(2000);
    flow.edit("zh", "private unsaved text");
    vi.mocked(client.detail).mockRejectedValueOnce(new ApiError(status, "NOT_FOUND"));
    await flow.resume();
    expect(state()).toMatchObject({ file: null, previewUrl: null, asset: null, analysis: null, draft: { zh: "", en: "" }, phase: "error" });
    expect(state().error?.status).toBe(status);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:one.png");
    await tick(5000);
    expect(client.update).not.toHaveBeenCalled();
    await flow.resume();
    expect(client.detail).toHaveBeenCalledTimes(2);
  });

  it("only previews a valid selection, rejects unsupported/oversized/empty images and releases URLs", () => {
    const { flow, client, state } = setup();
    expect(flow.selectFile(image())).toBe(true);
    expect(state()).toMatchObject({ file: expect.any(File), previewUrl: "blob:one.png", phase: "idle" });
    expect(client.upload).not.toHaveBeenCalled();
    expect(client.create).not.toHaveBeenCalled();
    for (const file of [new File(["svg"], "a.svg", { type: "image/svg+xml" }), new File([], "a.png", { type: "image/png" }), new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.png", { type: "image/png" })]) {
      expect(flow.selectFile(file)).toBe(false);
      expect(state().error?.code).toBe("INVALID_IMAGE");
    }
    flow.selectFile(image("two.png"));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:one.png");
    flow.destroy();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:two.png");
  });

  it("retries an unknown create outcome using the same asset and idempotency key", async () => {
    const { flow, client, state } = setup();
    vi.mocked(client.create).mockRejectedValueOnce(new ApiError(0, "NETWORK_ERROR"));
    await selectAndStart(flow);
    expect(state().phase).toBe("error");
    const key = vi.mocked(client.create).mock.calls[0][1];
    await flow.start();
    expect(client.upload).toHaveBeenCalledTimes(1);
    expect(vi.mocked(client.create).mock.calls[1].slice(0, 2)).toEqual(["asset", key]);
    expect(state().analysis?.id).toBe("job");
    await flow.start();
    expect(client.create).toHaveBeenCalledTimes(2);
    expect(client.detail).toHaveBeenCalledWith("job", expect.any(AbortSignal));
  });

  it("deduplicates double starts and polls GET every two seconds until terminal", async () => {
    const { flow, client, state } = setup();
    const pending = deferred<AnalysisAsset>();
    vi.mocked(client.upload).mockReturnValueOnce(pending.promise);
    flow.selectFile(image());
    const first = flow.start();
    await flow.start();
    expect(client.upload).toHaveBeenCalledTimes(1);
    pending.resolve(asset);
    await first;
    vi.mocked(client.detail).mockResolvedValueOnce(detail("running")).mockResolvedValueOnce(detail());
    await tick(1999);
    expect(client.detail).not.toHaveBeenCalled();
    await tick(1);
    expect(state().phase).toBe("running");
    await tick(2000);
    expect(state()).toMatchObject({ phase: "succeeded", draft: prompt, saved: true });
    await tick(10000);
    expect(client.detail).toHaveBeenCalledTimes(2);
    expect(client.create).toHaveBeenCalledTimes(1);
  });

  it.each(["failed", "unknown", "canceled"] as const)("stops polling at %s and creates a fresh key only on explicit reparse", async status => {
    const { flow, client, state } = setup();
    await selectAndStart(flow);
    const key = vi.mocked(client.create).mock.calls[0][1];
    vi.mocked(client.detail).mockResolvedValueOnce(detail(status));
    await tick(2000);
    expect(state().phase).toBe(status);
    await tick(10000);
    expect(client.detail).toHaveBeenCalledTimes(1);
    await flow.start({ newAnalysis: true });
    expect(vi.mocked(client.create).mock.calls[1][1]).not.toBe(key);
    expect(client.upload).toHaveBeenCalledTimes(1);
  });

  it("does not reparse active jobs or silently retry failed polls, including deleted records", async () => {
    const { flow, client, state } = setup();
    await selectAndStart(flow);
    vi.mocked(client.detail).mockResolvedValueOnce(detail("running"));
    await flow.start({ newAnalysis: true });
    expect(client.create).toHaveBeenCalledTimes(1);
    vi.mocked(client.detail).mockRejectedValueOnce(new ApiError(404, "NOT_FOUND"));
    await tick(2000);
    expect(state().error?.status).toBe(404);
    await tick(20000);
    expect(client.detail).toHaveBeenCalledTimes(2);
    expect(client.create).toHaveBeenCalledTimes(1);
  });

  it("aborts on close, ignores late completions and resumes a known job with GET on reopen", async () => {
    const { flow, client, state } = setup();
    await selectAndStart(flow);
    const pending = deferred<AnalysisDetail>();
    vi.mocked(client.detail).mockReturnValueOnce(pending.promise);
    await tick(2000);
    const signal = vi.mocked(client.detail).mock.calls[0][1];
    flow.setEnabled(false);
    expect(signal?.aborted).toBe(true);
    pending.resolve(detail("failed"));
    await tick(0);
    expect(state().analysis?.status).toBe("queued");
    flow.setEnabled(true);
    await tick(0);
    expect(state().analysis?.status).toBe("succeeded");
    expect(client.create).toHaveBeenCalledTimes(1);
  });

  it("keeps the original creation intent through 401/login and resumes that key", async () => {
    const unauthorized = vi.fn();
    const { flow, client, state } = setup(api(), { onUnauthorized: unauthorized });
    vi.mocked(client.create).mockRejectedValueOnce(new ApiError(401, "UNAUTHORIZED"));
    await selectAndStart(flow);
    const key = vi.mocked(client.create).mock.calls[0][1];
    expect(unauthorized).toHaveBeenCalledOnce();
    expect(state().file?.name).toBe("one.png");
    await flow.resume();
    expect(vi.mocked(client.create).mock.calls[1][1]).toBe(key);
    vi.mocked(client.detail).mockRejectedValueOnce(new ApiError(401, "UNAUTHORIZED"));
    await tick(2000);
    await flow.resume();
    expect(client.create).toHaveBeenCalledTimes(2);
    expect(state().analysis?.status).toBe("succeeded");
  });

  it("resumes interrupted upload with a fresh asset and ignores responses for replaced images", async () => {
    const { flow, client, state } = setup();
    const pending = deferred<AnalysisAsset>();
    vi.mocked(client.upload).mockReturnValueOnce(pending.promise);
    flow.selectFile(image());
    const first = flow.start();
    flow.selectFile(image("replacement.png"));
    pending.resolve({ ...asset, id: "old-asset" });
    await first;
    expect(state().file?.name).toBe("replacement.png");
    expect(client.create).not.toHaveBeenCalled();
    await flow.start();
    expect(vi.mocked(client.create).mock.calls[0][0]).toBe("asset");
    expect(state().previewUrl).toBe("blob:replacement.png");
  });

  it("never starts upload, creation or autosave while disabled", async () => {
    const { flow, client } = setup(api(), { enabled: false });
    flow.selectFile(image());
    await flow.start();
    await flow.resume();
    await flow.loadHistory();
    await flow.removeHistory("job");
    expect(client.upload).not.toHaveBeenCalled();
    expect(client.history).not.toHaveBeenCalled();
    expect(client.remove).not.toHaveBeenCalled();
    flow.setEnabled(true);
    await flow.start();
    await tick(2000);
    flow.edit("zh", "新草稿");
    flow.setEnabled(false);
    await tick(1000);
    await flow.retrySave();
    expect(client.update).not.toHaveBeenCalled();
  });

  it("debounces edits, serializes patches and keeps text entered during an in-flight save", async () => {
    const { flow, client, state } = setup();
    await flow.reopen("job");
    const saving = deferred<AnalysisDetail>();
    vi.mocked(client.update).mockReturnValueOnce(saving.promise);
    flow.edit("zh", "第一版");
    await tick(599);
    expect(client.update).not.toHaveBeenCalled();
    await tick(1);
    expect(state()).toMatchObject({ saving: true, saved: false });
    flow.edit("en", "Second draft");
    await tick(1000);
    expect(client.update).toHaveBeenCalledTimes(1);
    saving.resolve({ ...detail(), revision: 1, prompt: { ...prompt, zh: "第一版" } });
    await tick(0);
    expect(state().draft).toEqual({ zh: "第一版", en: "Second draft" });
    expect(state().saved).toBe(false);
    await tick(600);
    expect(vi.mocked(client.update).mock.calls[1].slice(0, 3)).toEqual(["job", 1, { zh: "第一版", en: "Second draft" }]);
    expect(state()).toMatchObject({ saving: false, saved: true, saveError: null });
  });

  it.each([new ApiError(0, "NETWORK_ERROR"), new ApiError(409, "REVISION_CONFLICT")])("retains unsaved draft and exposes save error without infinite retry", async failure => {
    const { flow, client, state } = setup();
    await flow.reopen("job");
    vi.mocked(client.update).mockRejectedValueOnce(failure);
    flow.edit("zh", "本地改动");
    await tick(600);
    expect(state()).toMatchObject({ draft: { ...prompt, zh: "本地改动" }, saved: false, saving: false, saveError: failure });
    await tick(6000);
    expect(client.update).toHaveBeenCalledTimes(1);
    await flow.retrySave();
    expect(state().saved).toBe(failure.code !== "REVISION_CONFLICT");
  });

  it("rejects empty/over-limit edits without truncating drafts or sending invalid PATCH", async () => {
    const { flow, client, state } = setup();
    await flow.reopen("job");
    flow.edit("zh", "");
    await tick(600);
    expect(state().saveError?.code).toBe("INVALID_PROMPT");
    expect(state().draft.zh).toBe("");
    flow.edit("zh", "x".repeat(6001));
    await tick(600);
    expect(state().draft.zh).toHaveLength(6001);
    expect(client.update).not.toHaveBeenCalled();
  });

  it("preserves dirty drafts while refreshing expired previews and flags newer conflicting revisions", async () => {
    const { flow, client, state } = setup();
    await flow.reopen("job");
    flow.edit("zh", "本地草稿");
    flow.setEnabled(false);
    vi.mocked(client.detail).mockResolvedValueOnce({ ...detail(), revision: 2, preview_url: "/renewed", prompt: { ...prompt, zh: "其他窗口" } });
    flow.setEnabled(true);
    await tick(0);
    expect(state().previewUrl).toBe("/renewed");
    expect(state().draft.zh).toBe("本地草稿");
    expect(state().saveError?.code).toBe("REVISION_CONFLICT");
    await tick(1000);
    expect(client.update).not.toHaveBeenCalled();
    flow.edit("en", "Another local edit");
    await tick(1000);
    expect(state().saveError?.code).toBe("REVISION_CONFLICT");
    await flow.retrySave();
    expect(client.update).not.toHaveBeenCalled();
    vi.mocked(client.detail).mockResolvedValueOnce({ ...detail(), revision: 2, prompt: { ...prompt, zh: "其他窗口" } });
    await flow.reopen("job");
    expect(state().draft.zh).toBe("其他窗口");
    expect(state().analysis?.revision).toBe(2);
    expect(state().saveError).toBeNull();
  });

  it("counts Unicode prompt limits using codepoints before autosave", async () => {
    const { flow, client } = setup();
    await flow.reopen("job");
    flow.edit("zh", "🌏".repeat(6000));
    await tick(600);
    expect(client.update).toHaveBeenCalledOnce();
  });

  it("loads cursor history, deduplicates pages, refreshes detail on reopen and deletes only after success", async () => {
    const { flow, client, state } = setup();
    vi.mocked(client.history).mockResolvedValueOnce(page(["a", "b"], "next")).mockResolvedValueOnce(page(["b", "c"]));
    await flow.loadHistory();
    await flow.loadHistory(true);
    expect(state().history.map(item => item.id)).toEqual(["a", "b", "c"]);
    expect(vi.mocked(client.history).mock.calls[1][0]).toBe("next");
    await flow.loadHistory(true);
    expect(client.history).toHaveBeenCalledTimes(2);
    await flow.reopen("a");
    expect(client.detail).toHaveBeenCalledWith("a", expect.any(AbortSignal));
    vi.mocked(client.remove).mockRejectedValueOnce(new ApiError(503, "REQUEST_FAILED"));
    await flow.removeHistory("a");
    expect(state().history).toHaveLength(3);
    expect(state().historyError?.status).toBe(503);
    await flow.removeHistory("a");
    expect(state().history.map(item => item.id)).toEqual(["b", "c"]);
  });

  it("does not resurrect a deleted history item from an older pending list response", async () => {
    const { flow, client, state } = setup();
    const pending = deferred<AnalysisHistory>();
    vi.mocked(client.history).mockReturnValueOnce(pending.promise);
    const loading = flow.loadHistory();
    await flow.removeHistory("deleted");
    pending.resolve(page(["deleted", "kept"]));
    await loading;
    expect(state().history.map(item => item.id)).toEqual(["kept"]);
  });

  it("ignores stale details and stale saves when switching history records", async () => {
    const { flow, client, state } = setup();
    const pending = deferred<AnalysisDetail>();
    vi.mocked(client.detail).mockReturnValueOnce(pending.promise);
    const first = flow.reopen("old");
    vi.mocked(client.detail).mockResolvedValueOnce(detail("succeeded", "new"));
    await flow.reopen("new");
    pending.resolve(detail("succeeded", "old"));
    await first;
    expect(state().analysis?.id).toBe("new");
    const saving = deferred<AnalysisDetail>();
    vi.mocked(client.update).mockReturnValueOnce(saving.promise);
    flow.edit("en", "Old save");
    await tick(600);
    await flow.reopen("next");
    saving.resolve({ ...detail("succeeded", "new"), revision: 1 });
    await tick(0);
    expect(state().analysis?.id).toBe("job");
    expect(state().draft).toEqual(prompt);
  });

  it("fences an in-flight save when explicitly reparsing the same asset", async () => {
    const { flow, client, state } = setup();
    await flow.reopen("job");
    const saving = deferred<AnalysisDetail>();
    vi.mocked(client.update).mockReturnValueOnce(saving.promise);
    flow.edit("zh", "旧任务草稿");
    await tick(600);
    await flow.start({ newAnalysis: true });
    const signal = vi.mocked(client.update).mock.calls[0][3];
    expect(signal?.aborted).toBe(true);
    saving.resolve({ ...detail(), revision: 1 });
    await tick(0);
    expect(state().analysis?.status).toBe("queued");
    expect(state().draft).toEqual({ zh: "", en: "" });
    expect(state().saving).toBe(false);
  });

  it("waits for a resumed detail query before autosaving a retained draft", async () => {
    const { flow, client, state } = setup();
    await flow.reopen("job");
    flow.edit("zh", "保留的草稿");
    flow.setEnabled(false);
    const pending = deferred<AnalysisDetail>();
    vi.mocked(client.detail).mockReturnValueOnce(pending.promise);
    flow.setEnabled(true);
    await tick(1000);
    expect(client.update).not.toHaveBeenCalled();
    pending.resolve(detail());
    await tick(600);
    expect(state().saved).toBe(true);
    expect(client.update).toHaveBeenCalledOnce();
  });

  it("never rolls back a successful save from an earlier detail snapshot", async () => {
    const { flow, client, state } = setup();
    await flow.reopen("job");
    flow.edit("zh", "刚刚保存的文本");
    const patch = deferred<AnalysisDetail>();
    const get = deferred<AnalysisDetail>();
    vi.mocked(client.update).mockReturnValueOnce(patch.promise);
    vi.mocked(client.detail).mockReturnValueOnce(get.promise);
    const saving = flow.retrySave();
    const reading = flow.resume();
    patch.resolve({ ...detail(), revision: 1, prompt: { ...prompt, zh: "刚刚保存的文本" } });
    await saving;
    get.resolve(detail());
    await reading;
    expect(state().draft.zh).toBe("刚刚保存的文本");
    expect(state().analysis?.revision).toBe(1);
    expect(state().saved).toBe(true);
  });

  it("does not let a delayed PATCH clear a conflict reported by a newer GET", async () => {
    const { flow, client, state } = setup();
    await flow.reopen("job");
    flow.edit("zh", "本地文本");
    const patch = deferred<AnalysisDetail>();
    const get = deferred<AnalysisDetail>();
    vi.mocked(client.update).mockReturnValueOnce(patch.promise);
    vi.mocked(client.detail).mockReturnValueOnce(get.promise);
    const saving = flow.retrySave();
    const reading = flow.resume();
    get.resolve({ ...detail(), revision: 2, prompt: { zh: "本地文本", en: "Remote English edit" } });
    await reading;
    expect(state().saveError?.code).toBe("REVISION_CONFLICT");
    patch.resolve({ ...detail(), revision: 1, prompt: { ...prompt, zh: "本地文本" } });
    await saving;
    expect(state().analysis?.revision).toBe(2);
    expect(state().saved).toBe(false);
    expect(state().saveError?.code).toBe("REVISION_CONFLICT");
    expect(state().draft).toEqual({ ...prompt, zh: "本地文本" });
  });

  it.each([true, false])("retains a pending draft across close and reconciles whether the server saved it (%s)", async committed => {
    const { flow, client, state } = setup();
    await flow.reopen("job");
    const pending = deferred<AnalysisDetail>();
    vi.mocked(client.update).mockReturnValueOnce(pending.promise);
    flow.edit("zh", "关闭前的草稿");
    await tick(600);
    const signal = vi.mocked(client.update).mock.calls[0][3];
    flow.setEnabled(false);
    expect(signal?.aborted).toBe(true);
    vi.mocked(client.detail).mockResolvedValueOnce(committed
      ? { ...detail(), revision: 1, prompt: { ...prompt, zh: "关闭前的草稿" } }
      : detail());
    flow.setEnabled(true);
    await tick(0);
    expect(state().draft.zh).toBe("关闭前的草稿");
    expect(state().saved).toBe(committed);
    pending.resolve({ ...detail(), revision: 1, prompt: { ...prompt, zh: "迟到的保存" } });
    await tick(0);
    expect(state().draft.zh).toBe("关闭前的草稿");
    await tick(600);
    expect(client.update).toHaveBeenCalledTimes(committed ? 1 : 2);
    expect(state().saved).toBe(true);
  });

  it("retries an unauthorized draft save after login and a fresh nonconflicting detail", async () => {
    const unauthorized = vi.fn();
    const { flow, client, state } = setup(api(), { onUnauthorized: unauthorized });
    await flow.reopen("job");
    vi.mocked(client.update).mockRejectedValueOnce(new ApiError(401, "UNAUTHORIZED"));
    flow.edit("zh", "登录后继续保存");
    await tick(600);
    expect(unauthorized).toHaveBeenCalledOnce();
    expect(state().saveError?.status).toBe(401);
    flow.setEnabled(false);
    flow.setEnabled(true);
    await tick(600);
    expect(state().draft.zh).toBe("登录后继续保存");
    expect(state().saved).toBe(true);
    expect(client.create).not.toHaveBeenCalled();
    expect(client.update).toHaveBeenCalledTimes(2);
  });

  it("acknowledges its own interrupted save and then saves text typed while that request was pending", async () => {
    const { flow, client, state } = setup();
    await flow.reopen("job");
    const pending = deferred<AnalysisDetail>();
    vi.mocked(client.update).mockReturnValueOnce(pending.promise);
    flow.edit("zh", "已提交的A");
    await tick(600);
    flow.edit("zh", "继续输入的B");
    flow.setEnabled(false);
    vi.mocked(client.detail).mockResolvedValueOnce({ ...detail(), revision: 1, prompt: { ...prompt, zh: "已提交的A" } });
    flow.setEnabled(true);
    await tick(0);
    expect(state().draft.zh).toBe("继续输入的B");
    expect(state().saveError).toBeNull();
    pending.resolve({ ...detail(), revision: 1, prompt: { ...prompt, zh: "已提交的A" } });
    await tick(600);
    expect(vi.mocked(client.update).mock.calls[1].slice(0, 3)).toEqual(["job", 1, { ...prompt, zh: "继续输入的B" }]);
    expect(state().saved).toBe(true);
    expect(state().draft.zh).toBe("继续输入的B");
  });

  it("publishes immutable snapshots to subscribers and never touches a destroyed controller", async () => {
    const { flow, client, state } = setup();
    const listener = vi.fn();
    const unsubscribe = flow.subscribe(listener);
    const initial = state();
    flow.selectFile(image());
    expect(initial.file).toBeNull();
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
    flow.selectFile(image("two.png"));
    expect(listener).toHaveBeenCalledOnce();
    flow.destroy();
    await flow.start();
    expect(client.upload).not.toHaveBeenCalled();
  });

  it("connects React consumers to the same persistent workflow across enabled changes", async () => {
    const create = vi.spyOn(promptAnalysisClient, "create").mockResolvedValue(detail("queued"));
    vi.spyOn(promptAnalysisClient, "upload").mockResolvedValue(asset);
    const get = vi.spyOn(promptAnalysisClient, "detail").mockResolvedValue(detail());
    const { result, rerender, unmount } = renderHook(({ enabled }) => usePromptAnalysis({ enabled }), { initialProps: { enabled: true } });
    await act(async () => { result.current.selectFile(image()); await result.current.start(); });
    rerender({ enabled: false });
    expect(result.current.file?.name).toBe("one.png");
    rerender({ enabled: true });
    await act(async () => tick(0));
    expect(result.current.phase).toBe("succeeded");
    expect(create).toHaveBeenCalledOnce();
    expect(get).toHaveBeenCalledOnce();
    unmount();
  });

  it("survives StrictMode effect cleanup without discarding the selected file or creating twice", async () => {
    const create = vi.spyOn(promptAnalysisClient, "create").mockResolvedValue(detail("queued"));
    vi.spyOn(promptAnalysisClient, "upload").mockResolvedValue(asset);
    vi.spyOn(promptAnalysisClient, "detail").mockResolvedValue(detail());
    const { result, unmount } = renderHook(() => usePromptAnalysis(), {
      wrapper: ({ children }) => createElement(StrictMode, null, children),
    });
    await act(async () => { result.current.selectFile(image()); await result.current.start(); });
    await act(async () => tick(2000));
    expect(result.current.file?.name).toBe("one.png");
    expect(result.current.phase).toBe("succeeded");
    expect(create).toHaveBeenCalledOnce();
    unmount();
    await tick(0);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:one.png");
  });

  it("accepts imperative login identity until the SSR identity prop actually changes", async () => {
    vi.spyOn(promptAnalysisClient, "upload").mockRejectedValueOnce(new ApiError(401, "UNAUTHORIZED")).mockResolvedValue(asset);
    const create = vi.spyOn(promptAnalysisClient, "create").mockResolvedValue(detail("queued"));
    const { result, rerender } = renderHook(
      ({ enabled, identity }) => usePromptAnalysis({ enabled, identity }),
      { initialProps: { enabled: true, identity: null as string | null } },
    );
    await act(async () => { result.current.selectFile(image()); await result.current.start(); });
    rerender({ enabled: false, identity: null });
    act(() => result.current.setIdentity("account-a"));
    rerender({ enabled: true, identity: null });
    await act(async () => tick(0));
    expect(create).toHaveBeenCalledOnce();
    expect(result.current.file?.name).toBe("one.png");
    rerender({ enabled: true, identity: "account-a" });
    expect(result.current.file?.name).toBe("one.png");
    rerender({ enabled: false, identity: null });
    expect(result.current.file).toBeNull();
    expect(result.current.analysis).toBeNull();
    expect(result.current.draft).toEqual({ zh: "", en: "" });
  });
});
