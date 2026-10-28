import { StrictMode, useEffect } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../../messages/zh.json";
import { ApiError, promptAnalysisClient } from "@/features/image-to-prompt/lib/client";
import { promptConversationClient } from "../lib/client";
import type { ConversationTurn, PromptConversationDetail, PromptConversationHistory, PromptConversationSummary } from "@/types/prompt-conversation";
import { CreationProvider, useCreation } from "./creation-provider";
import { CreationHomeComposer, CreationPanel } from "./creation-panel";
import NextLink from "next/link";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/features/auth/components/login-page", async () => {
  const { useState } = await import("react");
  return { LoginPage: ({ onAuthenticated, onClose }: { onAuthenticated: () => Promise<void>; onClose: () => void }) => {
    const [error, setError] = useState(false);
    return <div role="dialog" aria-label="登录"><button onClick={() => { void onAuthenticated().catch(() => setError(true)); }}>完成登录</button><button onClick={onClose}>关闭登录</button>{error && <p role="alert">登录未成功</p>}</div>;
  } };
});

const DATE = "2026-10-26T12:00:00Z";
const ID = "00000000-0000-4000-8000-000000000001";
const TURN = "00000000-0000-4000-8000-000000000002";
const SECOND = "00000000-0000-4000-8000-000000000003";
const ASSET = "00000000-0000-4000-8000-000000000004";
const NEXT = "00000000-0000-4000-8000-000000000005";
const pair = { zh: "雨夜送花的小猫，电影感光影。", en: "A kitten in the rain, cinematic lighting." };
const turn: ConversationTurn = {
  id: TURN, conversation_id: ID, parent_analysis_id: null, user_message: "雨夜的小猫", version: 1,
  input_type: "text", idea_text: "雨夜的小猫", asset_id: null, status: "succeeded", phase: "completed", revision: 0,
  created_at: DATE, finished_at: DATE, title: "雨夜小猫壁纸", error_code: null, history_retain_until: DATE,
  image_available: false, preview_url: null, thumbnail_url: null, preview_expires_at: null, saved_to_history: true,
  prompt: pair, result: { schema_version: "1", title: "雨夜小猫壁纸", prompt: pair, breakdown: { subject: pair, composition: pair, lighting: pair, style: pair }, uncertain_details: [] },
};
const queued: ConversationTurn = { ...turn, status: "queued", phase: "queued", prompt: null, result: null, saved_to_history: false };
const conversation = (item = turn): PromptConversationDetail => ({ id: item.conversation_id, title: item.title!, created_at: DATE, updated_at: DATE, turns: [item] });
const summary = (id = ID, title = "雨夜小猫壁纸"): PromptConversationSummary => ({ id, title, status: "succeeded", created_at: DATE, updated_at: DATE, latest_analysis_id: TURN, version: 1 });
const history = (items: PromptConversationSummary[], cursor: string | null = null): PromptConversationHistory => ({ items, pagination: { limit: 20, has_more: cursor !== null, next_cursor: cursor } });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }

function Workspace({ identity }: { identity: string | null }) {
  const { syncIdentity } = useCreation();
  useEffect(() => syncIdentity(identity), [identity, syncIdentity]);
  return <><CreationHomeComposer /><CreationPanel /></>;
}
function view(identity: string | null = "owner") {
  return <NextIntlClientProvider locale="zh" messages={messages}><CreationProvider><Workspace identity={identity} /></CreationProvider></NextIntlClientProvider>;
}
function mount(identity: string | null = "owner") {
  const result = render(view(identity));
  return { user: userEvent.setup(), changeIdentity: (next: string | null) => result.rerender(view(next)), unmount: result.unmount };
}
async function openSaved(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "历史" }));
  await user.click(await screen.findByRole("button", { name: "雨夜小猫壁纸" }));
  expect(await screen.findByText(pair.zh)).toBeVisible();
}

beforeEach(() => {
  vi.spyOn(promptConversationClient, "create").mockResolvedValue(queued);
  vi.spyOn(promptConversationClient, "send").mockResolvedValue({ ...queued, id: NEXT, parent_analysis_id: TURN, version: 2 });
  vi.spyOn(promptConversationClient, "retry").mockResolvedValue({ ...queued, id: NEXT, version: 2 });
  vi.spyOn(promptConversationClient, "detail").mockResolvedValue(conversation());
  vi.spyOn(promptConversationClient, "history").mockResolvedValue(history([summary()]));
  vi.spyOn(promptConversationClient, "remove").mockResolvedValue(undefined);
  vi.spyOn(promptAnalysisClient, "update").mockImplementation(async (_id, _revision, prompt) => ({ ...turn, prompt, revision: 1 }));
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Unexpected network request")));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); refresh.mockReset(); });

describe("real same-page creative workspace", () => {
  it.each(["click", "Enter"])("sends a homepage greeting through auto mode with %s", async action => {
    const { user } = mount();
    const textbox = screen.getByRole("textbox");
    fireEvent.change(textbox, { target: { value: "你好" } });
    if (action === "click") await user.click(screen.getByRole("button", { name: "发送" }));
    else fireEvent.keyDown(textbox, { key: "Enter" });
    await waitFor(() => expect(promptConversationClient.create).toHaveBeenCalledWith({ message: "你好" }, expect.any(String), expect.any(AbortSignal)));
    expect(vi.mocked(promptConversationClient.create).mock.calls[0][0].mode ?? "auto").toBe("auto");
  });

  it("sends a homepage image-only attachment as asset_id without forcing generation", async () => {
    vi.stubGlobal("URL", class extends URL {
      static createObjectURL = vi.fn(() => "blob:homepage-reference");
      static revokeObjectURL = vi.fn();
    });
    const asset = { id: ASSET, width: 800, height: 600, byte_size: 1234, preview_url: "https://images.example.com/private", thumbnail_url: "https://images.example.com/thumb", preview_expires_at: DATE };
    vi.spyOn(promptConversationClient, "upload").mockResolvedValue(asset);
    vi.mocked(promptConversationClient.create).mockResolvedValueOnce({ ...queued, input_type: "image", asset_id: ASSET, idea_text: null, user_message: "" });
    const { user } = mount();
    const file = new File(["image"], "reference.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("选择创作参考图片"), file);
    expect(promptConversationClient.upload).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "发送" }));
    await waitFor(() => expect(promptConversationClient.create).toHaveBeenCalledWith({ asset_id: ASSET }, expect.any(String), expect.any(AbortSignal)));
    expect(promptConversationClient.upload).toHaveBeenCalledWith(file, expect.any(AbortSignal));
    expect(promptConversationClient.send).not.toHaveBeenCalled();
    expect(vi.mocked(promptConversationClient.create).mock.calls[0][0].mode ?? "auto").toBe("auto");
  });

  it("continues the collapsed successful conversation from its latest turn through homepage auto send", async () => {
    const assistant: ConversationTurn = { ...turn, id: SECOND, parent_analysis_id: TURN, version: 2, response_type: "assistant", assistant_reply: "可以继续聊。", prompt_number: null, result: null, prompt: null };
    vi.mocked(promptConversationClient.detail).mockResolvedValueOnce({ ...conversation(), turns: [turn, assistant] });
    vi.mocked(promptConversationClient.send).mockResolvedValueOnce({ ...queued, id: NEXT, parent_analysis_id: SECOND, version: 3 });
    const { user } = mount();
    await openSaved(user);
    await user.click(screen.getByRole("button", { name: "收起" }));
    fireEvent.change(screen.getByRole("textbox", { name: "说说你的想法，帮你写成提示词" }), { target: { value: "你好" } });
    await user.click(screen.getByRole("button", { name: "发送" }));
    await waitFor(() => expect(promptConversationClient.send).toHaveBeenCalledWith(ID, { message: "你好", parent_analysis_id: SECOND, parent_revision: 0 }, expect.any(String), expect.any(AbortSignal)));
    expect(vi.mocked(promptConversationClient.send).mock.calls[0][1].mode ?? "auto").toBe("auto");
    expect(promptConversationClient.create).not.toHaveBeenCalled();
  });

  it("shows a plain safe assistant reply without prompt controls and continues with auto mode", async () => {
    const reply = '<img src="x" onerror="alert(1)">';
    const assistant: ConversationTurn = { ...turn, response_type: "assistant", assistant_reply: reply, prompt_number: null, prompt: null, result: null, title: "普通对话" };
    vi.mocked(promptConversationClient.detail).mockResolvedValue(conversation(assistant));
    const { user } = mount();
    await user.click(screen.getByRole("button", { name: "历史" }));
    await user.click(await screen.findByRole("button", { name: "雨夜小猫壁纸" }));
    expect(await screen.findByText(reply, { exact: true })).toBeVisible();
    expect(document.querySelector('img[src="x"]')).toBeNull();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "编辑" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /版本 \d/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "换一种风格" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "调整构图" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "继续提问或描述想法，也可以添加参考图" }), { target: { value: "再解释一下" } });
    await user.click(screen.getByRole("button", { name: "发送" }));
    await waitFor(() => expect(promptConversationClient.send).toHaveBeenCalledWith(ID, expect.objectContaining({ message: "再解释一下", parent_analysis_id: TURN, parent_revision: 0 }), expect.any(String), expect.any(AbortSignal)));
    expect(vi.mocked(promptConversationClient.send).mock.calls[0][1].mode ?? "auto").toBe("auto");
  });

  it("keeps the latest successful prompt expanded after a later assistant turn and displays prompt numbering", async () => {
    const firstReply: ConversationTurn = { ...turn, id: NEXT, response_type: "assistant", assistant_reply: "你好，想聊些什么？", prompt_number: null, prompt: null, result: null };
    const promptTurn: ConversationTurn = { ...turn, parent_analysis_id: NEXT, version: 2, response_type: "prompt", assistant_reply: null, prompt_number: 1 };
    const assistant: ConversationTurn = { ...turn, id: SECOND, parent_analysis_id: TURN, version: 3, response_type: "assistant", assistant_reply: "可以把色调改得更温暖。", prompt_number: null, prompt: null, result: null };
    vi.mocked(promptConversationClient.detail).mockResolvedValue({ ...conversation(), turns: [firstReply, promptTurn, assistant] });
    const { user } = mount();
    await user.click(screen.getByRole("button", { name: "历史" }));
    await user.click(await screen.findByRole("button", { name: "雨夜小猫壁纸" }));
    expect(await screen.findByText(pair.zh)).toBeVisible();
    expect(screen.getByText(firstReply.assistant_reply!)).toBeVisible();
    expect(screen.getByText(assistant.assistant_reply!)).toBeVisible();
    expect(screen.getByRole("button", { name: "版本 1 · 收起" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /版本 [23]/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "换一种风格" })).toBeVisible();
  });

  it("survives the StrictMode effect cycle and submits one user action once", async () => {
    render(<StrictMode>{view()}</StrictMode>);
    const user = userEvent.setup();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "严格模式下的一次想法" } });
    await user.click(screen.getByRole("button", { name: "发送" }));
    await waitFor(() => expect(promptConversationClient.create).toHaveBeenCalledOnce());
    expect(screen.getByRole("status")).toHaveTextContent("处理中");
  });

  it("restores an anonymous greeting in auto mode after login verifies the real session", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ id: "owner" })); vi.stubGlobal("fetch", fetcher);
    const { user } = mount(null);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "你好" } });
    await user.click(screen.getByRole("button", { name: "发送" }));
    expect(screen.getByRole("dialog", { name: "登录" })).toBeVisible();
    expect(promptConversationClient.create).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "完成登录" }));
    await waitFor(() => expect(promptConversationClient.create).toHaveBeenCalledWith({ message: "你好" }, expect.any(String), expect.any(AbortSignal)));
    expect(fetcher).toHaveBeenCalledWith("/api/auth/me", expect.objectContaining({ credentials: "same-origin", cache: "no-store", redirect: "error" }));
    expect(refresh).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("处理中");
  });

  it("retains anonymous input on cancel and ignores a later successful session response", async () => {
    const pending = deferred<Response>(); vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending.promise));
    const { user } = mount(null);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "取消后保留的想法" } });
    await user.click(screen.getByRole("button", { name: "发送" }));
    await user.click(screen.getByRole("button", { name: "完成登录" }));
    await user.click(screen.getByRole("button", { name: "关闭登录" }));
    await act(async () => pending.resolve(Response.json({ id: "owner" })));
    expect(promptConversationClient.create).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox")).toHaveValue("取消后保留的想法");
    await user.click(screen.getByRole("button", { name: "发送" }));
    expect(screen.getByRole("dialog", { name: "登录" })).toBeVisible();
  });

  it("does not restore a canceled old identity after the server account changed", async () => {
    const pending = deferred<Response>(); vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending.promise));
    const { user, changeIdentity } = mount("account-a");
    changeIdentity(null);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "账号A的私密草稿" } });
    await user.click(screen.getByRole("button", { name: "发送" }));
    await user.click(screen.getByRole("button", { name: "完成登录" }));
    changeIdentity("account-b");
    await act(async () => pending.resolve(Response.json({ id: "account-a" })));
    expect(promptConversationClient.create).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "关闭登录" }));
    expect(screen.getByRole("textbox")).toHaveValue("");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "账号B的新想法" } });
    await user.click(screen.getByRole("button", { name: "发送" }));
    await waitFor(() => expect(promptConversationClient.create).toHaveBeenCalledWith({ message: "账号B的新想法" }, expect.any(String), expect.any(AbortSignal)));
  });

  it.each([Response.json({ id: 7 }), new Response(null, { status: 401 })])("does not create when login has no verified user session", async response => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    const { user } = mount(null);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "尚未认证的想法" } });
    await user.click(screen.getByRole("button", { name: "发送" }));
    await user.click(screen.getByRole("button", { name: "完成登录" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("登录未成功");
    expect(promptConversationClient.create).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox")).toHaveValue("尚未认证的想法");
  });

  it("ignores a login completion after the workspace was unmounted", async () => {
    const pending = deferred<Response>(); vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending.promise));
    const { user, unmount } = mount(null);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "已经离开的想法" } });
    await user.click(screen.getByRole("button", { name: "发送" }));
    await user.click(screen.getByRole("button", { name: "完成登录" }));
    unmount();
    await act(async () => pending.resolve(Response.json({ id: "owner" })));
    expect(promptConversationClient.create).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("loads and paginates durable history, then opens the selected versioned conversation", async () => {
    vi.mocked(promptConversationClient.history).mockResolvedValueOnce(history([summary()], "next-page"))
      .mockResolvedValueOnce(history([summary(), summary(SECOND, "产品摄影")]));
    const { user } = mount();
    await user.click(screen.getByRole("button", { name: "历史" }));
    expect(await screen.findByRole("button", { name: "雨夜小猫壁纸" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "加载更多" }));
    expect(await screen.findByRole("button", { name: "产品摄影" })).toBeVisible();
    expect(screen.getAllByRole("button", { name: "雨夜小猫壁纸" })).toHaveLength(1);
    expect(promptConversationClient.history).toHaveBeenLastCalledWith("next-page", expect.any(AbortSignal));
    await user.click(screen.getByRole("button", { name: "雨夜小猫壁纸" }));
    expect(await screen.findByText(pair.zh)).toBeVisible();
    expect(promptConversationClient.detail).toHaveBeenCalledWith(ID, expect.any(AbortSignal));
  });

  it("shows loading before an empty history and can return to the same workspace", async () => {
    const pending = deferred<PromptConversationHistory>(); vi.mocked(promptConversationClient.history).mockReturnValueOnce(pending.promise);
    const { user } = mount();
    await user.click(screen.getByRole("button", { name: "历史" }));
    expect(screen.getByRole("status")).toHaveTextContent("正在加载");
    expect(screen.queryByText("还没有创作记录")).not.toBeInTheDocument();
    await act(async () => pending.resolve(history([])));
    expect(screen.getByText("还没有创作记录")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "返回对话" }));
    expect(screen.getByText("从一个想法，或一张图开始")).toBeVisible();
  });

  it("does not describe a failed history load as an empty account", async () => {
    vi.mocked(promptConversationClient.history).mockRejectedValueOnce(new ApiError(503, "SERVICE_UNAVAILABLE"));
    const { user } = mount();
    await user.click(screen.getByRole("button", { name: "历史" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("创作服务暂不可用");
    expect(screen.queryByText("还没有创作记录")).not.toBeInTheDocument();
  });

  it("cancels a delete confirmation and deletes only the explicitly selected conversation", async () => {
    vi.mocked(promptConversationClient.history).mockResolvedValue(history([summary(), summary(SECOND, "产品摄影")]));
    const { user } = mount();
    await user.click(screen.getByRole("button", { name: "历史" }));
    const row = (await screen.findByRole("button", { name: "雨夜小猫壁纸" })).closest("li")!;
    await user.click(within(row).getByRole("button", { name: "删除对话" }));
    expect(within(row).getByRole("alert")).toHaveTextContent("删除后无法恢复");
    await user.click(within(row).getByRole("button", { name: "取消" }));
    expect(promptConversationClient.remove).not.toHaveBeenCalled();
    await user.click(within(row).getByRole("button", { name: "删除对话" }));
    await user.click(within(row).getByRole("button", { name: "确认删除" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "雨夜小猫壁纸" })).not.toBeInTheDocument());
    expect(promptConversationClient.remove).toHaveBeenCalledWith(ID, expect.any(AbortSignal));
    expect(screen.getByRole("button", { name: "产品摄影" })).toBeVisible();
  });

  it("keeps history intact and reports an unsuccessful deletion", async () => {
    vi.mocked(promptConversationClient.remove).mockRejectedValueOnce(new ApiError(503, "SERVICE_UNAVAILABLE"));
    const { user } = mount();
    await user.click(screen.getByRole("button", { name: "历史" }));
    await user.click(await screen.findByRole("button", { name: "删除对话" }));
    await user.click(screen.getByRole("button", { name: "确认删除" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("创作服务暂不可用");
    expect(screen.getByRole("button", { name: "雨夜小猫壁纸" })).toBeVisible();
  });

  it("prevents a duplicate delete while the selected conversation removal is pending", async () => {
    const pending = deferred<void>(); vi.mocked(promptConversationClient.remove).mockReturnValueOnce(pending.promise);
    const { user } = mount();
    await user.click(screen.getByRole("button", { name: "历史" }));
    await user.click(await screen.findByRole("button", { name: "删除对话" }));
    await user.click(screen.getByRole("button", { name: "确认删除" }));
    expect(screen.getByRole("button", { name: "确认删除" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "删除对话" })).toBeDisabled();
    await act(async () => pending.resolve());
    expect(screen.getByText("还没有创作记录")).toBeVisible();
    expect(promptConversationClient.remove).toHaveBeenCalledOnce();
  });

  it("guards an edited version before starting over and keeps it when requested", async () => {
    const { user } = mount(); await openSaved(user);
    await user.click(screen.getByRole("button", { name: "编辑" }));
    fireEvent.change(screen.getByRole("textbox", { name: "编辑中文提示词" }), { target: { value: "尚未保存的修改" } });
    await user.click(screen.getByRole("button", { name: "新建" }));
    expect(screen.getByRole("alert")).toHaveTextContent("有尚未保存的修改");
    await user.click(screen.getByRole("button", { name: "保留修改" }));
    expect(screen.getByRole("textbox", { name: "编辑中文提示词" })).toHaveValue("尚未保存的修改");
    await user.click(screen.getByRole("button", { name: "新建" }));
    await user.click(screen.getByRole("button", { name: "放弃修改并继续" }));
    expect(screen.getByText("从一个想法，或一张图开始")).toBeVisible();
    expect(screen.queryByText(pair.zh)).not.toBeInTheDocument();
    expect(promptAnalysisClient.update).not.toHaveBeenCalled();
  });

  it("protects a dirty edit before history navigation, then opens history on explicit discard", async () => {
    const { user } = mount(); await openSaved(user);
    await user.click(screen.getByRole("button", { name: "编辑" }));
    fireEvent.change(screen.getByRole("textbox", { name: "编辑中文提示词" }), { target: { value: "切换前的草稿" } });
    vi.mocked(promptConversationClient.history).mockClear();
    await user.click(screen.getByRole("button", { name: "历史" }));
    expect(screen.getByRole("alert")).toHaveTextContent("有尚未保存的修改");
    expect(promptConversationClient.history).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "放弃修改并继续" }));
    expect(await screen.findByRole("heading", { name: "历史创作" })).toBeVisible();
    expect(promptConversationClient.history).toHaveBeenCalledOnce();
  });

  it("preserves an edited version across collapsing and resuming the inline chat", async () => {
    const { user } = mount(); await openSaved(user);
    await user.click(screen.getByRole("button", { name: "编辑" }));
    fireEvent.change(screen.getByRole("textbox", { name: "编辑中文提示词" }), { target: { value: "收起后仍保留的草稿" } });
    await user.click(screen.getByRole("button", { name: "收起" }));
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "继续上次创作" }));
    expect(screen.getByRole("textbox", { name: "编辑中文提示词" })).toHaveValue("收起后仍保留的草稿");
    expect(promptAnalysisClient.update).not.toHaveBeenCalled();
  });

  it("reveals the unsaved edit confirmation when opening history from the collapsed homepage", async () => {
    const { user } = mount(); await openSaved(user);
    await user.click(screen.getByRole("button", { name: "编辑" }));
    fireEvent.change(screen.getByRole("textbox", { name: "编辑中文提示词" }), { target: { value: "收起后点历史的草稿" } });
    await user.click(screen.getByRole("button", { name: "收起" }));
    vi.mocked(promptConversationClient.history).mockClear();
    await user.click(screen.getByRole("button", { name: "历史" }));
    expect(screen.getByRole("alert")).toHaveTextContent("有尚未保存的修改");
    expect(screen.getByRole("textbox", { name: "编辑中文提示词" })).toHaveValue("收起后点历史的草稿");
    expect(promptConversationClient.history).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "保留修改" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "编辑中文提示词" })).toHaveValue("收起后点历史的草稿");
    await user.click(screen.getByRole("button", { name: "收起" }));
    await user.click(screen.getByRole("button", { name: "历史" }));
    await user.click(screen.getByRole("button", { name: "放弃修改并继续" }));
    expect(await screen.findByRole("heading", { name: "历史创作" })).toBeVisible();
    expect(promptConversationClient.history).toHaveBeenCalledOnce();
    expect(promptAnalysisClient.update).not.toHaveBeenCalled();
  });

  it("keeps the collapsed home composer read-only until the result edit is resolved", async () => {
    const { user } = mount(); await openSaved(user);
    await user.click(screen.getByRole("button", { name: "编辑" }));
    await user.click(screen.getByRole("button", { name: "收起" }));
    expect(screen.getByRole("textbox")).toBeDisabled();
    expect(screen.getByRole("button", { name: "图片转提示词" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "继续上次创作" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "继续上次创作" }));
    expect(screen.getByRole("textbox", { name: "编辑中文提示词" })).toHaveValue(pair.zh);
  });

  it("guards a locale SPA Link before its click side effects or navigation can change", async () => {
    const navigate = vi.fn();
    document.cookie = "NEXT_LOCALE=zh";
    render(<NextIntlClientProvider locale="zh" messages={messages}><CreationProvider>
      <div onClick={event => { if ((event.target as Element).closest("a")) { event.preventDefault(); navigate(); } }}><NextLink href="/en/?category=animal" onClick={() => { document.cookie = "NEXT_LOCALE=en"; }}>切换语言</NextLink></div>
      <Workspace identity="owner" />
    </CreationProvider></NextIntlClientProvider>);
    const user = userEvent.setup(); await openSaved(user);
    await user.click(screen.getByRole("button", { name: "编辑" }));
    fireEvent.change(screen.getByRole("textbox", { name: "编辑中文提示词" }), { target: { value: "语言切换前的草稿" } });
    await user.click(screen.getByRole("button", { name: "收起" }));
    const cookie = document.cookie;
    await user.click(screen.getByRole("link", { name: "切换语言" }));
    expect(navigate).not.toHaveBeenCalled();
    expect(document.cookie).toBe(cookie);
    expect(screen.getByRole("alert")).toHaveTextContent("有尚未保存的修改");
    await user.click(screen.getByRole("button", { name: "保留修改" }));
    expect(screen.getByRole("textbox", { name: "编辑中文提示词" })).toHaveValue("语言切换前的草稿");
    await user.click(screen.getByRole("link", { name: "切换语言" }));
    await user.click(screen.getByRole("button", { name: "放弃修改并继续" }));
    expect(navigate).toHaveBeenCalledOnce();
    expect(screen.queryByRole("textbox", { name: "编辑中文提示词" })).not.toBeInTheDocument();
    expect(document.cookie).toContain("NEXT_LOCALE=en");
  });

  it("keeps query filters, hash links and links opened elsewhere outside the SPA leave guard", async () => {
    const navigate = vi.fn();
    render(<NextIntlClientProvider locale="zh" messages={messages}><CreationProvider>
      <nav onClick={event => { event.preventDefault(); navigate(); }}>
        <a href="?category=portrait">筛选</a><a href="#gallery">定位</a>
        <NextLink href="/en" target="_blank" rel="noreferrer">新标签</NextLink><NextLink href="/en" download>下载</NextLink>
        <a href="https://outside.example.com/">外部网站</a><a href="http://[">无效链接</a><NextLink href="/en">修饰点击</NextLink>
      </nav><Workspace identity="owner" />
    </CreationProvider></NextIntlClientProvider>);
    const user = userEvent.setup(); await openSaved(user);
    await user.click(screen.getByRole("button", { name: "编辑" }));
    fireEvent.change(screen.getByRole("textbox", { name: "编辑中文提示词" }), { target: { value: "仍然编辑中的草稿" } });
    for (const name of ["筛选", "定位", "新标签", "下载", "外部网站", "无效链接"]) fireEvent.click(screen.getByRole("link", { name }));
    const modified = screen.getByRole("link", { name: "修饰点击" });
    for (const options of [{ metaKey: true }, { ctrlKey: true }, { altKey: true }, { shiftKey: true }, { button: 1 }]) fireEvent.click(modified, options);
    expect(navigate).toHaveBeenCalledTimes(11);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "编辑中文提示词" })).toHaveValue("仍然编辑中的草稿");
  });

  it.each(["destination", "target", "download"] as const)("does not replay a pending navigation after the link %s changed", async change => {
    const navigate = vi.fn();
    render(<NextIntlClientProvider locale="zh" messages={messages}><CreationProvider>
      <NextLink href="/en" onClick={event => { event.preventDefault(); navigate(); }}>更改目标的链接</NextLink><Workspace identity="owner" />
    </CreationProvider></NextIntlClientProvider>);
    const user = userEvent.setup(); await openSaved(user);
    await user.click(screen.getByRole("button", { name: "编辑" }));
    fireEvent.change(screen.getByRole("textbox", { name: "编辑中文提示词" }), { target: { value: "等待确认的修改" } });
    const link = screen.getByRole("link", { name: "更改目标的链接" });
    await user.click(link);
    if (change === "destination") link.setAttribute("href", "/publish");
    else if (change === "target") link.setAttribute("target", "_blank");
    else link.setAttribute("download", "");
    await user.click(screen.getByRole("button", { name: "放弃修改并继续" }));
    expect(navigate).not.toHaveBeenCalled();
  });

  it("cannot discard an edit while its save is pending", async () => {
    const pending = deferred<ConversationTurn>(); vi.mocked(promptAnalysisClient.update).mockReturnValueOnce(pending.promise);
    const { user } = mount(); await openSaved(user);
    await user.click(screen.getByRole("button", { name: "编辑" }));
    fireEvent.change(screen.getByRole("textbox", { name: "编辑中文提示词" }), { target: { value: "正在保存的修改" } });
    await user.click(screen.getByRole("button", { name: "历史" }));
    await user.click(screen.getByRole("button", { name: "保存修改" }));
    expect(screen.getByRole("button", { name: "放弃修改并继续" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "保留修改" }));
    await act(async () => pending.resolve({ ...turn, revision: 1, prompt: { ...pair, zh: "正在保存的修改" } }));
    expect(await screen.findByText("正在保存的修改")).toBeVisible();
  });

  it("registers browser-leave protection only while the visible edit is dirty", async () => {
    const { user } = mount(); await openSaved(user);
    await user.click(screen.getByRole("button", { name: "编辑" }));
    fireEvent.change(screen.getByRole("textbox", { name: "编辑中文提示词" }), { target: { value: "需要保护的草稿" } });
    const dirtyLeave = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(dirtyLeave);
    expect(dirtyLeave.defaultPrevented).toBe(true);
    await user.click(screen.getByRole("button", { name: "取消" }));
    const savedLeave = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(savedLeave);
    expect(savedLeave.defaultPrevented).toBe(false);
  });

  it("fills suggested refinements without creating another model job until the user sends", async () => {
    const { user } = mount(); await openSaved(user);
    await user.click(screen.getByRole("button", { name: "换一种风格" }));
    expect(screen.getByRole("textbox")).toHaveValue("保留主体，换一种风格");
    expect(promptConversationClient.send).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "调整构图" }));
    expect(screen.getByRole("textbox")).toHaveValue("保留主体，调整画面构图");
    await user.click(screen.getByRole("button", { name: "发送" }));
    await waitFor(() => expect(promptConversationClient.send).toHaveBeenCalledWith(ID, { message: "保留主体，调整画面构图", parent_analysis_id: TURN, parent_revision: 0 }, expect.any(String), expect.any(AbortSignal)));
    expect(screen.getByRole("status")).toHaveTextContent("处理中");
  });

  it("retains a failed follow-up and lets the user query the existing conversation", async () => {
    vi.mocked(promptConversationClient.send).mockRejectedValueOnce(new ApiError(0, "NETWORK_ERROR"));
    const { user } = mount(); await openSaved(user);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "失败后保留的修改要求" } });
    await user.click(screen.getByRole("button", { name: "发送" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("输入已保留");
    expect(screen.getByRole("textbox")).toHaveValue("失败后保留的修改要求");
    await user.click(screen.getByRole("button", { name: "查询状态" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(promptConversationClient.detail).toHaveBeenCalledTimes(2);
    expect(promptConversationClient.send).toHaveBeenCalledOnce();
  });

  it("queries uncertain results without retrying the provider", async () => {
    vi.mocked(promptConversationClient.detail).mockResolvedValue(conversation({ ...turn, status: "unknown", prompt: null, result: null, saved_to_history: false }));
    const { user } = mount();
    await user.click(screen.getByRole("button", { name: "历史" }));
    await user.click(await screen.findByRole("button", { name: "雨夜小猫壁纸" }));
    expect(await screen.findByText("结果暂时无法确认")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "查询状态" }));
    expect(promptConversationClient.detail).toHaveBeenCalledTimes(2);
    expect(promptConversationClient.retry).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "重新生成" })).not.toBeInTheDocument();
  });

  it("only retries a failed turn after an explicit click", async () => {
    vi.mocked(promptConversationClient.detail).mockResolvedValue(conversation({ ...turn, status: "failed", prompt: null, result: null, saved_to_history: false }));
    const { user } = mount();
    await user.click(screen.getByRole("button", { name: "历史" }));
    await user.click(await screen.findByRole("button", { name: "雨夜小猫壁纸" }));
    expect(await screen.findByText("这次生成未完成")).toBeVisible();
    expect(promptConversationClient.retry).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "重新生成" }));
    await waitFor(() => expect(promptConversationClient.retry).toHaveBeenCalledWith(ID, TURN, expect.any(String), expect.any(AbortSignal)));
    expect(screen.getByRole("status")).toHaveTextContent("处理中");
  });

  it("recovers an expired preview through private conversation refresh", async () => {
    const imageTurn = { ...turn, input_type: "image" as const, asset_id: ASSET, idea_text: null, user_message: "", image_available: true, thumbnail_url: "https://images.example.com/old", preview_url: "https://images.example.com/old", preview_expires_at: DATE };
    vi.mocked(promptConversationClient.detail).mockResolvedValueOnce(conversation(imageTurn))
      .mockResolvedValueOnce(conversation({ ...imageTurn, thumbnail_url: "https://images.example.com/new", preview_url: "https://images.example.com/new" }));
    const { user } = mount();
    await user.click(screen.getByRole("button", { name: "历史" }));
    await user.click(await screen.findByRole("button", { name: "雨夜小猫壁纸" }));
    const image = await screen.findByRole("img", { name: "参考图片" });
    fireEvent.error(image);
    await user.click(screen.getByRole("button", { name: "刷新参考图片" }));
    await waitFor(() => expect(screen.getByRole("img", { name: "参考图片" })).toHaveAttribute("src", "https://images.example.com/new"));
    expect(screen.getByRole("button", { name: /画面拆解/ })).toBeVisible();
  });
});
