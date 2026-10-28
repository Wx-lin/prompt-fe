import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalysisAsset, AnalysisResult } from "@/types/prompt-analysis";
import type { ConversationTurn, PromptConversationDetail, PromptConversationHistory } from "@/types/prompt-conversation";
import { ApiError } from "@/features/image-to-prompt/lib/client";
import { createConversationWorkflow } from "./workflow";

const prompt = { zh: "产品居中，奶油白背景。", en: "A centered product against a cream background." };
const result: AnalysisResult = { schema_version: "1", title: "产品摄影", prompt, breakdown: Object.fromEntries(["subject", "composition", "lighting", "style"].map(key => [key, { zh: "细节", en: "Detail" }])) as AnalysisResult["breakdown"], uncertain_details: [] };
const asset: AnalysisAsset = { id: "asset", width: 20, height: 20, byte_size: 20, preview_url: "/private.jpg", thumbnail_url: "/thumb.jpg", preview_expires_at: "later" };
function turn(status: ConversationTurn["status"] = "succeeded", id = "root", version = 1): ConversationTurn {
  return { id, asset_id: null, input_type: "text", idea_text: "想法", status, phase: status, revision: 0, created_at: "today", finished_at: null, title: "产品摄影", error_code: null, history_retain_until: "later", image_available: false, preview_url: null, thumbnail_url: null, preview_expires_at: null, prompt: status === "succeeded" ? prompt : null, result: status === "succeeded" ? result : null, saved_to_history: status === "succeeded", conversation_id: "root", parent_analysis_id: version > 1 ? "root" : null, user_message: "写产品摄影", version };
}
const conversation = (turns = [turn()]): PromptConversationDetail => ({ id: "root", title: "产品摄影", created_at: "today", updated_at: "today", turns });
const history = (ids: string[], cursor: string | null = null): PromptConversationHistory => ({ items: ids.map(id => ({ id, title: id, created_at: "today", updated_at: "today", latest_analysis_id: id, version: 1, status: "succeeded" })), pagination: { limit: 20, has_more: Boolean(cursor), next_cursor: cursor } });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; }
function api() {
  return { create: vi.fn().mockResolvedValue(turn("queued")), send: vi.fn().mockResolvedValue(turn("queued", "second", 2)), retry: vi.fn().mockResolvedValue(turn("queued", "retry", 2)), detail: vi.fn().mockResolvedValue(conversation()), history: vi.fn().mockResolvedValue(history([])), remove: vi.fn().mockResolvedValue(undefined), upload: vi.fn().mockResolvedValue(asset), importReference: vi.fn().mockResolvedValue(asset) };
}
const flows: ReturnType<typeof createConversationWorkflow>[] = [];
function setup(identity: string | null = "a") {
  const client = api();
  const analysisClient = { update: vi.fn().mockImplementation(async (id, revision, value) => ({ ...turn("succeeded", id), revision: revision + 1, prompt: value })) };
  const onUnauthorized = vi.fn();
  const flow = createConversationWorkflow({ client, analysisClient, identity, onUnauthorized });
  flows.push(flow);
  return { flow, client, analysisClient, onUnauthorized, state: flow.getSnapshot };
}
const image = (name = "photo.png") => new File(["image"], name, { type: "image/png" });
beforeEach(() => { vi.useFakeTimers(); URL.createObjectURL = vi.fn(file => "blob:" + (file as File).name); URL.revokeObjectURL = vi.fn(); });
afterEach(() => { flows.splice(0).forEach(flow => flow.destroy()); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("private inline conversation workflow", () => {
  it("keeps a first anonymous generate intent through confirmed login", async () => {
    const { flow, client, state } = setup(null);
    flow.setMessage("一只送花的小猫");
    await flow.send("generate");
    expect(client.create).not.toHaveBeenCalled();
    flow.setIdentity("owner");
    await flow.resumeIntent();
    expect(client.create).toHaveBeenCalledWith({ message: "一只送花的小猫", mode: "generate" }, expect.any(String), expect.any(AbortSignal));
    expect(state().message).toBe("");
  });

  it("freezes the generate mode and idempotency key across uncertain creation retries", async () => {
    const { flow, client } = setup();
    client.create.mockRejectedValueOnce(new ApiError(0, "NETWORK_ERROR"));
    flow.setMessage("产品摄影");
    await flow.send("generate");
    await flow.send();
    expect(client.create.mock.calls[0][0]).toEqual({ message: "产品摄影", mode: "generate" });
    expect(client.create.mock.calls[1][0]).toEqual(client.create.mock.calls[0][0]);
    expect(client.create.mock.calls[1][1]).toBe(client.create.mock.calls[0][1]);
  });

  it("freezes generate mode before an upload failure and clears it when the draft changes", async () => {
    const { flow, client } = setup();
    flow.selectFile(image());
    client.upload.mockRejectedValueOnce(new ApiError(0, "NETWORK_ERROR"));
    await flow.send("generate");
    await flow.send();
    expect(client.create.mock.calls[0][0]).toMatchObject({ mode: "generate", asset_id: "asset" });
    const next = setup();
    next.client.create.mockRejectedValueOnce(new ApiError(0, "NETWORK_ERROR"));
    next.flow.setMessage("先生成"); await next.flow.send("generate");
    next.flow.setMessage("我现在只想问问题"); await next.flow.send();
    expect(next.client.create.mock.calls[1][0]).toEqual({ message: "我现在只想问问题" });
    expect(next.client.create.mock.calls[1][1]).not.toBe(next.client.create.mock.calls[0][1]);
  });

  it("continues from the latest assistant turn while preserving an earlier edited prompt", async () => {
    const { flow, client, analysisClient, state } = setup();
    const assistant: ConversationTurn = { ...turn("succeeded", "answer", 2), parent_analysis_id: "root", response_type: "assistant", assistant_reply: "可以，推荐保留暖光。", prompt_number: null, result: null, prompt: null, user_message: "这样好看吗" };
    client.detail.mockResolvedValueOnce(conversation([turn()]));
    await flow.openConversation("root");
    flow.beginEdit("root", "zh"); flow.setEditText("用户编辑后的提示词"); await flow.saveEdit();
    client.detail.mockResolvedValueOnce(conversation([{ ...turn(), revision: 1, prompt: { ...prompt, zh: "用户编辑后的提示词" } }, assistant]));
    await flow.refresh();
    flow.beginEdit("answer", "zh");
    expect(state().edit).toBeNull();
    client.send.mockResolvedValueOnce(turn("queued", "next", 3));
    flow.setMessage("继续写一版"); await flow.send("generate");
    expect(client.send).toHaveBeenCalledWith("root", { message: "继续写一版", mode: "generate", parent_analysis_id: "answer", parent_revision: 0 }, expect.any(String), expect.any(AbortSignal));
    expect(analysisClient.update).toHaveBeenCalledOnce();
    expect(state().conversation?.turns[0].prompt?.zh).toBe("用户编辑后的提示词");
  });

  it("does not restore an old account generate intent after401", async () => {
    const { flow, client, state } = setup();
    client.create.mockRejectedValueOnce(new ApiError(401, "UNAUTHORIZED"));
    flow.setMessage("private idea"); await flow.send("generate");
    flow.setIdentity("another"); await flow.resumeIntent();
    expect(client.create).toHaveBeenCalledOnce();
    expect(state().message).toBe("");
  });
  it("resumes history navigation after another account logs in without resending private input", async () => {
    const { flow, client, state } = setup("account-a");
    await flow.openConversation("root");
    flow.setMessage("账户A的私密草稿");
    flow.setIdentity(null);
    await flow.showHistory();
    expect(client.history).not.toHaveBeenCalled();
    flow.setIdentity("account-b");
    await flow.resumeIntent();
    expect(state()).toMatchObject({ expanded: true, view: "history", message: "", conversation: null });
    expect(client.history).toHaveBeenCalledOnce();
    expect(client.create).not.toHaveBeenCalled();
    expect(client.send).not.toHaveBeenCalled();
  });
  it("a late history page cannot resurrect a deleted inactive conversation", async () => {
    const { flow, client, state } = setup();
    client.history.mockResolvedValueOnce(history(["deleted", "kept"]));
    await flow.loadHistory();
    const late = deferred<PromptConversationHistory>();
    client.history.mockReturnValueOnce(late.promise);
    const loading = flow.loadHistory();
    await flow.removeConversation("deleted");
    late.resolve(history(["deleted", "kept"])); await loading;
    expect(state().history.map(item => item.id)).toEqual(["kept"]);
  });
  it("aborting an in-flight history load to send does not strand its loading flag", async () => {
    const { flow, client, state } = setup();
    const late = deferred<PromptConversationHistory>();
    client.history.mockReturnValueOnce(late.promise);
    const loading = flow.loadHistory();
    flow.setMessage("新的想法"); await flow.send();
    late.resolve(history(["stale"])); await loading;
    expect(state().historyLoading).toBe(false);
    await flow.loadHistory();
    expect(client.history).toHaveBeenCalledTimes(2);
  });
  it("does not let an unfinished history open race a newly submitted conversation", async () => {
    const { flow, client, state } = setup();
    const old = deferred<PromptConversationDetail>();
    client.detail.mockReturnValueOnce(old.promise);
    const reading = flow.openConversation("old-conversation");
    flow.setMessage("新的想法");
    await flow.send();
    expect(client.create).not.toHaveBeenCalled();
    expect(state().opening).toBe(true);
    old.resolve(conversation()); await reading;
    expect(state().opening).toBe(false);
    expect(state().conversation?.id).toBe("root");
  });
  it("fences a refresh snapshot started before a new version was submitted", async () => {
    const { flow, client, state } = setup();
    await flow.openConversation("root");
    const old = deferred<PromptConversationDetail>();
    client.detail.mockReturnValueOnce(old.promise);
    const reading = flow.refresh();
    flow.setMessage("改成白天"); await flow.send();
    expect(state().conversation?.turns.at(-1)?.id).toBe("second");
    old.resolve(conversation()); await reading;
    expect(state().conversation?.turns.at(-1)?.id).toBe("second");
    expect(state().conversation?.turns).toHaveLength(2);
  });
  it("sends an idea once, expands in place and polls existing task without another model request", async () => {
    const { flow, client, state } = setup();
    flow.setMessage("  写产品摄影  ");
    await flow.send();
    expect(client.create).toHaveBeenCalledWith({ message: "写产品摄影" }, expect.any(String), expect.any(AbortSignal));
    expect(client.upload).not.toHaveBeenCalled();
    expect(state()).toMatchObject({ expanded: true, message: "", phase: "idle", conversation: { id: "root", turns: [{ status: "queued" }] } });
    await vi.advanceTimersByTimeAsync(2000);
    expect(state().conversation?.turns[0].status).toBe("succeeded");
    expect(client.create).toHaveBeenCalledTimes(1);
  });

  it("selects a local photo without uploading and attaches optional text on explicit send", async () => {
    const { flow, client, state } = setup();
    expect(flow.selectFile(image())).toBe(true);
    expect(state().previewUrl).toBe("blob:photo.png");
    expect(client.upload).not.toHaveBeenCalled();
    flow.setMessage("照这张图写");
    await flow.send();
    expect(client.upload).toHaveBeenCalledTimes(1);
    expect(client.create).toHaveBeenCalledWith({ message: "照这张图写", asset_id: "asset" }, expect.any(String), expect.any(AbortSignal));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:photo.png");
  });

  it("imports gallery references only on send and keeps their pending source visible", async () => {
    const { flow, client, state } = setup();
    flow.selectReference({ promptId: "public-id", title: "产品", imageUrl: "/public.jpg" });
    expect(state()).toMatchObject({ expanded: true, previewUrl: "/public.jpg", source: { promptId: "public-id" } });
    expect(client.importReference).not.toHaveBeenCalled();
    await flow.send();
    expect(client.importReference).toHaveBeenCalledWith("public-id", expect.any(AbortSignal));
    expect(client.create).toHaveBeenCalledWith({ asset_id: "asset" }, expect.any(String), expect.any(AbortSignal));
  });

  it("refines the last saved effective result with matching parent revision", async () => {
    const { flow, client } = setup();
    await flow.openConversation("root");
    flow.setMessage("换奶油白背景");
    await flow.send();
    expect(client.send).toHaveBeenCalledWith("root", { message: "换奶油白背景", parent_analysis_id: "root", parent_revision: 0 }, expect.any(String), expect.any(AbortSignal));
    expect(flow.getSnapshot().conversation?.turns).toHaveLength(2);
  });

  it("retains an identical create key and uploaded asset after an uncertain network failure", async () => {
    const { flow, client } = setup();
    client.create.mockRejectedValueOnce(new ApiError(0, "NETWORK_ERROR"));
    flow.selectFile(image());
    await flow.send();
    const firstKey = client.create.mock.calls[0][1];
    await flow.send();
    expect(client.create.mock.calls[1][1]).toBe(firstKey);
    expect(client.upload).toHaveBeenCalledTimes(1);
  });

  it("prevents overlapping sends while uploading or creating", async () => {
    const { flow, client } = setup();
    const slow = deferred<ConversationTurn>();
    client.create.mockReturnValueOnce(slow.promise);
    flow.setMessage("一个想法");
    const first = flow.send();
    await flow.send();
    expect(client.create).toHaveBeenCalledTimes(1);
    expect(flow.selectFile(image())).toBe(false);
    slow.resolve(turn("queued"));
    await first;
  });

  it("clears every private draft and fences late responses when identity changes", async () => {
    const { flow, client, state } = setup();
    const slow = deferred<PromptConversationDetail>();
    client.detail.mockReturnValueOnce(slow.promise);
    const reading = flow.openConversation("root");
    const signal = client.detail.mock.calls[0][1];
    flow.setMessage("private-a");
    flow.setIdentity("b");
    expect(signal.aborted).toBe(true);
    slow.resolve(conversation());
    await reading;
    expect(state()).toMatchObject({ message: "", conversation: null, history: [], previewUrl: null, expanded: false });
  });

  it("preserves only first anonymous local input through login and resumes after confirmation", async () => {
    const { flow, client, state, onUnauthorized } = setup(null);
    flow.setMessage("匿名想法");
    flow.selectFile(image());
    await flow.send();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(client.upload).not.toHaveBeenCalled();
    flow.setIdentity("a");
    expect(state().message).toBe("匿名想法");
    await flow.resumeIntent();
    expect(client.create).toHaveBeenCalledTimes(1);
    flow.setIdentity(null);
    flow.setMessage("退出后的输入");
    flow.setIdentity("b");
    expect(state().message).toBe("");
  });

  it("a known identity receiving401 loses old input and never auto-resends it after relogin", async () => {
    const { flow, client, state, onUnauthorized } = setup();
    client.create.mockRejectedValueOnce(new ApiError(401, "UNAUTHORIZED"));
    flow.setMessage("secret-a");
    await flow.send();
    expect(state().message).toBe("");
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    flow.setIdentity("b");
    await flow.resumeIntent();
    expect(client.create).toHaveBeenCalledTimes(1);
  });

  it("closing an active chat retains its conversation and querying never recreates it", async () => {
    const { flow, client, state } = setup();
    flow.setMessage("想法");
    await flow.send();
    flow.setExpanded(false);
    expect(state().conversation?.id).toBe("root");
    await vi.advanceTimersByTimeAsync(2000);
    flow.setExpanded(true);
    await flow.refresh();
    expect(client.create).toHaveBeenCalledTimes(1);
  });

  it("validates empty input, Unicode length and photo type before network work", async () => {
    const { flow, client, state } = setup();
    await flow.send();
    expect(state().error?.code).toBe("INVALID_REQUEST");
    flow.setMessage("🐱".repeat(501));
    await flow.send();
    expect(client.create).not.toHaveBeenCalled();
    expect(flow.selectFile(new File(["bad"], "bad.svg", { type: "image/svg+xml" }))).toBe(false);
    expect(state().error?.code).toBe("INVALID_IMAGE");
    flow.setMessage("🐱".repeat(500));
    await flow.send();
    expect(client.create).toHaveBeenCalledTimes(1);
  });

  it("loads and deduplicates paginated private history and removes a deleted active conversation", async () => {
    const { flow, client, state } = setup();
    client.history.mockResolvedValueOnce(history(["root"], "next")).mockResolvedValueOnce(history(["root", "second"]));
    await flow.loadHistory();
    await flow.loadHistory(true);
    expect(state().history.map(item => item.id)).toEqual(["root", "second"]);
    await flow.openConversation("root");
    await flow.removeConversation("root");
    expect(state().history.map(item => item.id)).toEqual(["second"]);
    expect(state().conversation).toBeNull();
  });

  it("edits only the selected version and language, preserving English and revision", async () => {
    const { flow, analysisClient, state } = setup();
    await flow.openConversation("root");
    flow.beginEdit("root", "zh");
    flow.setEditText("新版中文");
    expect(flow.hasUnsavedEdit()).toBe(true);
    await flow.saveEdit();
    expect(analysisClient.update).toHaveBeenCalledWith("root", 0, { zh: "新版中文", en: prompt.en }, expect.any(AbortSignal));
    expect(state().edit).toBeNull();
    expect(state().conversation?.turns[0].revision).toBe(1);
    expect(state().conversation?.turns[0].prompt?.zh).toBe("新版中文");
  });

  it("keeps edits on save failure, cancels without writing and rejects blank or oversize prompts", async () => {
    const { flow, analysisClient, state } = setup();
    await flow.openConversation("root");
    flow.beginEdit("root", "en");
    flow.setEditText(" ");
    await flow.saveEdit();
    expect(state().saveError?.code).toBe("INVALID_PROMPT");
    flow.setEditText("New English");
    analysisClient.update.mockRejectedValueOnce(new ApiError(409, "REVISION_CONFLICT"));
    await flow.saveEdit();
    expect(state().edit?.text).toBe("New English");
    expect(state().saveError?.code).toBe("REVISION_CONFLICT");
    flow.cancelEdit();
    expect(state().edit).toBeNull();
    expect(state().conversation?.turns[0].prompt).toEqual(prompt);
  });

  it("requires explicit failed retry with a fresh key, while unknown only queries", async () => {
    const { flow, client, state } = setup();
    client.detail.mockResolvedValueOnce(conversation([turn("unknown")]));
    await flow.openConversation("root");
    await flow.retryTurn("root");
    expect(client.retry).not.toHaveBeenCalled();
    client.detail.mockResolvedValueOnce(conversation([turn("failed")]));
    await flow.refresh();
    await flow.retryTurn("root");
    expect(client.retry).toHaveBeenCalledWith("root", "root", expect.any(String), expect.any(AbortSignal));
    expect(state().conversation?.turns.at(-1)?.status).toBe("queued");
  });

  it("releases previews and resets current context on new conversation without deleting history", async () => {
    const { flow, state } = setup();
    await flow.loadHistory();
    await flow.openConversation("root");
    flow.selectFile(image());
    flow.newConversation();
    expect(state()).toMatchObject({ expanded: true, conversation: null, message: "", previewUrl: null });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:photo.png");
  });

  it.each([403, 404])("scrubs inaccessible records on query%s", async status => {
    const { flow, client, state } = setup();
    await flow.openConversation("root");
    client.detail.mockRejectedValueOnce(new ApiError(status, "NOT_FOUND"));
    await flow.refresh();
    expect(state().conversation).toBeNull();
    expect(state().error?.status).toBe(status);
  });
});
