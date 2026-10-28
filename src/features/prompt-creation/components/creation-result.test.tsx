import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { useSyncExternalStore } from "react";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import messages from "../../../../messages/zh.json";
import { ApiError, type PromptAnalysisClient } from "@/features/image-to-prompt/lib/client";
import { createConversationWorkflow, type ConversationWorkflow } from "../lib/workflow";
import type { PromptConversationClient } from "../lib/client";
import type { ConversationTurn } from "@/types/prompt-conversation";
import { CreationResult } from "./creation-result";

const DATE = "2026-10-26T12:00:00Z";
const ID = "00000000-0000-4000-8000-000000000001";
const TURN = "00000000-0000-4000-8000-000000000002";
const pair = { zh: "雨夜送花的小猫，电影感光影。", en: "A kitten in the rain, cinematic lighting." };
const base: ConversationTurn = {
  id: TURN, conversation_id: ID, parent_analysis_id: null, user_message: "雨夜的小猫", version: 1,
  input_type: "text", idea_text: "雨夜的小猫", asset_id: null, status: "succeeded", phase: "completed", revision: 0,
  created_at: DATE, finished_at: DATE, title: "雨夜的小猫", error_code: null, history_retain_until: DATE,
  image_available: false, preview_url: null, thumbnail_url: null, preview_expires_at: null, saved_to_history: true,
  prompt: pair, result: { schema_version: "1", title: "雨夜的小猫", prompt: pair, breakdown: { subject: pair, composition: { zh: "", en: "" }, lighting: pair, style: pair }, uncertain_details: ["花束品种未确定"] },
};
const workflows: ConversationWorkflow[] = [];
afterEach(() => { cleanup(); workflows.forEach(flow => flow.destroy()); workflows.length = 0; vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function setup(options: { turn?: ConversationTurn; turns?: ConversationTurn[]; isLatest?: boolean; imageConversation?: boolean; update?: Mock<PromptAnalysisClient["update"]> } = {}) {
  const turn = options.turn ?? base;
  const conversation = { id: ID, title: turn.title!, created_at: DATE, updated_at: DATE, turns: options.turns ?? [turn] };
  const client = { detail: vi.fn().mockImplementation(async () => conversation), retry: vi.fn().mockImplementation(async () => ({ ...turn, status: "queued" })) } as unknown as PromptConversationClient;
  const update = options.update ?? vi.fn<PromptAnalysisClient["update"]>().mockImplementation(async (_id, _revision, prompt) => ({ ...turn, prompt, revision: 1 }));
  const workflow = createConversationWorkflow({ identity: "owner", client, analysisClient: { update } });
  workflows.push(workflow);
  await workflow.openConversation(ID);
  function Harness() {
    const state = useSyncExternalStore(workflow.subscribe, workflow.getSnapshot, workflow.getSnapshot);
    const current = state.conversation?.turns.find(item => item.id === turn.id) ?? turn;
    return <NextIntlClientProvider locale="zh" messages={messages}><CreationResult turn={current} isLatest={options.isLatest ?? true} imageConversation={options.imageConversation ?? false} workflow={workflow} state={state} /></NextIntlClientProvider>;
  }
  render(<Harness />);
  return { workflow, client, update, user: userEvent.setup() };
}

describe("version-specific creation result", () => {
  it("keeps queued and running output neutral without a premature prompt version card", async () => {
    await setup({ turn: { ...base, status: "queued", phase: "queued", prompt: null, result: null, saved_to_history: false, response_type: null, assistant_reply: null, prompt_number: null } });
    expect(screen.getByRole("status")).toHaveTextContent("处理中");
    expect(screen.queryByRole("button", { name: /版本/ })).not.toBeInTheDocument();
    cleanup();
    await setup({ turn: { ...base, status: "running", phase: "running", prompt: null, result: null, saved_to_history: false, response_type: null, assistant_reply: null, prompt_number: null } });
    expect(screen.getByRole("status")).toHaveTextContent("正在回复");
    expect(screen.queryByRole("button", { name: /版本/ })).not.toBeInTheDocument();
  });

  it("opens the latest version with bilingual output and copies its selected language", async () => {
    const clipboard = vi.fn().mockResolvedValue(undefined);
    const { user } = await setup();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: clipboard } });
    expect(screen.getByText(pair.zh)).toBeVisible();
    await user.click(screen.getByRole("tab", { name: "English" }));
    expect(screen.getByText(pair.en)).toBeVisible();
    expect(screen.getByRole("tabpanel", { name: "English" })).toHaveTextContent(pair.en);
    await user.click(screen.getByRole("button", { name: "复制English" }));
    expect(clipboard).toHaveBeenCalledWith(pair.en);
    expect(await screen.findByRole("status")).toHaveTextContent("已复制English");
  });

  it("keeps older versions collapsed until explicitly opened", async () => {
    const { user } = await setup({ isLatest: false });
    expect(screen.queryByText(pair.zh)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /版本 1.*展开/ }));
    expect(screen.getByText(pair.zh)).toBeVisible();
  });

  it("copies an expanded older version instead of the newer conversation result", async () => {
    const newer = { ...base, id: "00000000-0000-4000-8000-000000000003", version: 2, prompt: { zh: "新版内容", en: "Newer English" } };
    const { user } = await setup({ turns: [base, newer], isLatest: false });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    await user.click(screen.getByRole("button", { name: /版本 1.*展开/ }));
    await user.click(screen.getByRole("tab", { name: "English" }));
    await user.click(screen.getByRole("button", { name: "复制English" }));
    expect(writeText).toHaveBeenCalledWith(pair.en);
    expect(screen.queryByText("Newer English")).not.toBeInTheDocument();
  });

  it("shows creative points or image breakdown through an accessible disclosure", async () => {
    const { user } = await setup({ imageConversation: true });
    expect(screen.queryByText("花束品种未确定")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /画面拆解/ }));
    expect(screen.getByText("花束品种未确定")).toBeVisible();
    expect(screen.getByText("未确定")).toBeVisible();
  });

  it("edits only the chosen language and sends the effective revision and unchanged other language", async () => {
    const { user, update } = await setup();
    await user.click(screen.getByRole("tab", { name: "English" }));
    await user.click(screen.getByRole("button", { name: "编辑" }));
    const input = screen.getByRole("textbox", { name: "编辑English提示词" });
    expect(input).toHaveValue(pair.en);
    fireEvent.change(input, { target: { value: "Updated English prompt" } });
    await user.click(screen.getByRole("button", { name: "保存修改" }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(TURN, 0, { zh: pair.zh, en: "Updated English prompt" }, expect.any(AbortSignal)));
    await waitFor(() => expect(screen.queryByRole("textbox")).not.toBeInTheDocument());
    expect(screen.getByText("Updated English prompt")).toBeVisible();
  });

  it("preserves a failed save draft and hides stale saved indicators", async () => {
    const update = vi.fn<PromptAnalysisClient["update"]>().mockRejectedValue(new ApiError(0, "NETWORK_ERROR"));
    const { user } = await setup({ update });
    await user.click(screen.getByRole("button", { name: "编辑" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "保留的修改" } });
    await user.click(screen.getByRole("button", { name: "保存修改" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("连接失败");
    expect(screen.getByRole("textbox")).toHaveValue("保留的修改");
    expect(screen.queryByText("已保存")).not.toBeInTheDocument();
  });

  it("keeps a conflicting draft copyable and prevents a blind overwrite retry", async () => {
    const update = vi.fn<PromptAnalysisClient["update"]>().mockRejectedValue(new ApiError(409, "REVISION_CONFLICT"));
    const { user } = await setup({ update });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    await user.click(screen.getByRole("button", { name: "编辑" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "冲突后保留的草稿" } });
    await user.click(screen.getByRole("button", { name: "保存修改" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("修改已保留");
    expect(screen.getByRole("button", { name: "保存修改" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "复制中文" }));
    expect(writeText).toHaveBeenCalledWith("冲突后保留的草稿");
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText(pair.zh)).toBeVisible();
    expect(update).toHaveBeenCalledOnce();
  });

  it("disables editing controls while an effective revision is being saved", async () => {
    let resolve!: (value: ConversationTurn) => void;
    const update = vi.fn<PromptAnalysisClient["update"]>().mockImplementation(() => new Promise(done => { resolve = done; }));
    const { user } = await setup({ update });
    await user.click(screen.getByRole("button", { name: "编辑" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "保存后的内容" } });
    await user.click(screen.getByRole("button", { name: "保存修改" }));
    expect(screen.getByRole("textbox")).toBeDisabled();
    expect(screen.getByRole("button", { name: "取消" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "保存中…" })).toBeDisabled();
    await act(async () => resolve({ ...base, prompt: { zh: "保存后的内容", en: pair.en }, revision: 1 }));
    expect(screen.getByText("保存后的内容")).toBeVisible();
    expect(update).toHaveBeenCalledOnce();
  });

  it("validates a blank edit locally without discarding the draft", async () => {
    const { user, update } = await setup();
    await user.click(screen.getByRole("button", { name: "编辑" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "   " } });
    await user.click(screen.getByRole("button", { name: "保存修改" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("提示词不能为空");
    expect(screen.getByRole("textbox")).toHaveValue("   ");
    expect(update).not.toHaveBeenCalled();
  });

  it.each(["queued", "running"] as const)("shows actual %s state without fake output or percentages", async status => {
    await setup({ turn: { ...base, status, result: null, prompt: null, saved_to_history: false } });
    expect(screen.getByRole("status")).toHaveTextContent(status === "queued" ? "处理中" : "正在回复");
    expect(screen.queryByRole("button", { name: /复制/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument();
  });

  it("only queries unknown turns and never offers retry", async () => {
    const { user, workflow } = await setup({ turn: { ...base, status: "unknown", result: null, prompt: null } });
    const refresh = vi.spyOn(workflow, "refresh");
    await user.click(screen.getByRole("button", { name: "查询状态" }));
    expect(refresh).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "重新生成" })).not.toBeInTheDocument();
  });

  it.each(["failed", "canceled"] as const)("only retries the explicit latest %s version", async status => {
    const { user, workflow } = await setup({ turn: { ...base, status, result: null, prompt: null } });
    const retry = vi.spyOn(workflow, "retryTurn");
    await user.click(screen.getByRole("button", { name: "重新生成" }));
    expect(retry).toHaveBeenCalledWith(TURN);
  });

  it("does not retry a failed historical version after a newer turn exists", async () => {
    await setup({ turn: { ...base, status: "failed", prompt: null, result: null }, isLatest: false });
    expect(screen.getByText("这次生成未完成")).toBeVisible();
    expect(screen.queryByRole("button", { name: /版本/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "重新生成" })).not.toBeInTheDocument();
  });

  it("reports clipboard permission failures without exposing raw browser errors", async () => {
    const { user } = await setup();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error("private host or system details")) } });
    await user.click(screen.getByRole("button", { name: "复制中文" }));
    expect(await screen.findByRole("status")).toHaveTextContent("复制失败，请手动选择文字复制");
    expect(screen.queryByText(/private host/)).not.toBeInTheDocument();
  });

  it("suppresses late copy feedback when the selected language changed", async () => {
    let resolve!: () => void;
    const { user } = await setup();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockImplementation(() => new Promise<void>(done => { resolve = done; })) } });
    await user.click(screen.getByRole("button", { name: "复制中文" }));
    await user.click(screen.getByRole("tab", { name: "English" }));
    await act(async () => resolve());
    await user.click(screen.getByRole("tab", { name: "中文" }));
    expect(screen.queryByText("已复制中文")).not.toBeInTheDocument();
  });

  it("suppresses old revision feedback when refreshed output has changed", async () => {
    let resolve!: () => void;
    const { user, workflow, client } = await setup();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockImplementation(() => new Promise<void>(done => { resolve = done; })) } });
    await user.click(screen.getByRole("button", { name: "复制中文" }));
    vi.mocked(client.detail).mockResolvedValue({ id: ID, title: base.title!, created_at: DATE, updated_at: DATE, turns: [{ ...base, revision: 1, prompt: { zh: "刷新后的内容", en: pair.en } }] });
    await act(async () => workflow.refresh());
    await act(async () => resolve());
    expect(screen.getByText("刷新后的内容")).toBeVisible();
    expect(screen.queryByText("已复制中文")).not.toBeInTheDocument();
  });

  it("suppresses late clipboard feedback after identity switches", async () => {
    let resolve!: () => void;
    const { user, workflow } = await setup();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockImplementation(() => new Promise<void>(done => { resolve = done; })) } });
    await user.click(screen.getByRole("button", { name: "复制中文" }));
    act(() => workflow.setIdentity("different-owner"));
    await act(async () => resolve());
    expect(screen.queryByText("已复制中文")).not.toBeInTheDocument();
  });
});
