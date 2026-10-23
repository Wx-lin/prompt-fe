import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import messages from "../../../../messages/zh.json";
import { ImagePromptLauncher } from "./image-prompt-launcher";

const mock = vi.hoisted(() => ({ state: {} as Record<string, unknown>, unauthorized: () => {}, refresh: vi.fn() }));
vi.mock("../lib/workflow", () => ({ usePromptAnalysis: (options: { onUnauthorized: () => void }) => { mock.unauthorized = options.onUnauthorized; return mock.state; } }));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ refresh: mock.refresh }) }));
vi.mock("@/features/auth/components/login-page", () => ({ LoginPage: ({ onAuthenticated, onClose }: { onAuthenticated: () => void; onClose: () => void }) => <div><button onClick={onAuthenticated}>finish login</button><button onClick={onClose}>cancel login</button></div> }));
beforeEach(() => {
  mock.state = { file: null, previewUrl: null, asset: null, analysis: null, draft: { zh: "中文", en: "English" }, phase: "idle", error: null, saving: false, saved: false, saveError: null, history: [], historyLoading: false, historyError: null, hasMore: false,
    selectFile: vi.fn(), start: vi.fn(), reopen: vi.fn().mockResolvedValue(undefined), edit: vi.fn(), retrySave: vi.fn(), loadHistory: vi.fn().mockResolvedValue(undefined), removeHistory: vi.fn(), resume: vi.fn(), setIdentity: vi.fn() };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ id: "c7f83e2e-6725-48cf-9f6c-f6529060b8a6" })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.clearAllMocks(); });
function show() { render(<NextIntlClientProvider locale="zh" messages={messages}><ImagePromptLauncher /></NextIntlClientProvider>); fireEvent.click(screen.getByRole("button", { name: "图片转提示词" })); }
it("opens yesterday's unified workspace and requires an image before analysis", () => {
  show();
  expect(screen.getByRole("dialog", { name: "反推提示词" })).toBeVisible();
  expect(screen.getByRole("button", { name: "开始反推" })).toBeDisabled();
  expect(screen.getByRole("combobox", { name: "输出语言" })).toBeVisible();
});
it("retains the reference through inline authentication", async () => {
  mock.state = { ...mock.state, file: new File(["x"], "selected.png"), previewUrl: "blob:selected" };
  show();
  act(() => mock.unauthorized());
  expect(screen.getByRole("button", { name: "finish login" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "finish login" }));
  await waitFor(() => expect(screen.getByAltText("参考图片")).toHaveAttribute("src", "blob:selected"));
  expect(mock.state.start).not.toHaveBeenCalled();
  expect(mock.refresh).toHaveBeenCalledOnce();
});
it("can cancel login without immediately retrying an unauthorized request", async () => {
  show();
  act(() => mock.unauthorized());
  fireEvent.click(screen.getByRole("button", { name: "cancel login" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(mock.state.start).not.toHaveBeenCalled();
});
it("ignores late identity verification after login is canceled", async () => {
  let finish!: (response: Response) => void;
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(resolve => { finish = resolve; })));
  show();
  act(() => mock.unauthorized());
  fireEvent.click(screen.getByRole("button", { name: "finish login" }));
  fireEvent.click(screen.getByRole("button", { name: "cancel login" }));
  await act(async () => { finish(Response.json({ id: "late-account" })); });
  expect(mock.state.setIdentity).not.toHaveBeenCalled();
  expect(mock.refresh).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
it("shows history inside the same workspace without a new page", async () => {
  show();
  fireEvent.click(screen.getByRole("button", { name: "历史记录" }));
  await waitFor(() => expect(mock.state.loadHistory).toHaveBeenCalled());
  expect(screen.getByRole("dialog", { name: "历史记录" })).toBeVisible();
  expect(screen.getByText("还没有反推记录")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "返回反推" }));
  expect(screen.getByRole("dialog", { name: "反推提示词" })).toBeVisible();
});
function editable() {
  const pair = { zh: "中文", en: "English" };
  mock.state = { ...mock.state, phase: "succeeded", analysis: { status: "succeeded", image_available: true, result: { breakdown: { subject: pair, composition: pair, lighting: pair, style: pair }, uncertain_details: [] } } };
}
it("requires explicit confirmation before replacing an unsaved result", () => {
  editable();
  show();
  const file = new File(["png"], "next.png", { type: "image/png" });
  fireEvent.change(screen.getByLabelText("选择参考图片"), { target: { files: [file] } });
  expect(mock.state.selectFile).not.toHaveBeenCalled();
  expect(screen.getByRole("alertdialog", { name: "还有未保存的修改" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "继续切换" }));
  expect(mock.state.selectFile).toHaveBeenCalledExactlyOnceWith(file);
});
it("can keep an unsaved draft instead of starting a new paid analysis", () => {
  editable();
  show();
  fireEvent.click(screen.getByRole("button", { name: "重新反推" }));
  expect(mock.state.start).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "返回编辑" }));
  expect(screen.getByRole("textbox", { name: "完整提示词" })).toHaveValue("中文");
  expect(mock.state.start).not.toHaveBeenCalled();
});

it("copies the current draft rather than the originally generated prompt", async () => {
  userEvent.setup();
  const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
  editable();
  mock.state = { ...mock.state, draft: { zh: "我修改过的中文提示词", en: "My edited English prompt" } };
  show();
  fireEvent.click(screen.getByRole("button", { name: "复制提示词" }));
  await waitFor(() => expect(screen.getByText("已复制提示词")).toBeVisible());
  expect(writeText).toHaveBeenCalledExactlyOnceWith("我修改过的中文提示词");
  expect(mock.state.start).not.toHaveBeenCalled();
});

it("reports clipboard permission failure without claiming the prompt was copied", async () => {
  userEvent.setup();
  const writeText = vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new DOMException("Permission denied", "NotAllowedError"));
  editable();
  show();
  fireEvent.click(screen.getByRole("button", { name: "复制提示词" }));
  await waitFor(() => expect(screen.getByText("复制失败，请选择文字手动复制")).toBeVisible());
  expect(screen.queryByText("已复制提示词")).not.toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "完整提示词" })).toHaveValue("中文");
  expect(writeText).toHaveBeenCalledExactlyOnceWith("中文");
});

it("switches to the existing English draft without creating or resuming an analysis", async () => {
  const user = userEvent.setup();
  editable();
  show();
  await user.click(screen.getByRole("combobox", { name: "输出语言" }));
  await user.click(await screen.findByRole("option", { name: "English" }));
  expect(screen.getByRole("textbox", { name: "完整提示词" })).toHaveValue("English");
  expect(mock.state.start).not.toHaveBeenCalled();
  expect(mock.state.resume).not.toHaveBeenCalled();
  expect(mock.state.reopen).not.toHaveBeenCalled();
});

it("starts a fresh analysis only after confirming loss of unsaved changes", () => {
  editable();
  show();
  fireEvent.click(screen.getByRole("button", { name: "重新反推" }));
  expect(screen.getByRole("alertdialog", { name: "还有未保存的修改" })).toBeVisible();
  expect(mock.state.start).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "继续切换" }));
  expect(mock.state.start).toHaveBeenCalledExactlyOnceWith({ newAnalysis: true });
});

it("opens another historical result only after the unsaved-draft confirmation", async () => {
  editable();
  mock.state = { ...mock.state, history: [{ id: "other-record", title: "另一条历史", status: "succeeded", summary: { zh: "另一幅画面" }, created_at: "2026-10-22T08:00:00Z", thumbnail_url: null }] };
  show();
  fireEvent.click(screen.getByRole("button", { name: "历史记录" }));
  fireEvent.click(screen.getByRole("button", { name: "打开记录 另一条历史" }));
  expect(screen.getByRole("alertdialog", { name: "还有未保存的修改" })).toBeVisible();
  expect(mock.state.reopen).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "返回编辑" }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  expect(mock.state.reopen).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog", { name: "历史记录" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "打开记录 另一条历史" }));
  fireEvent.click(screen.getByRole("button", { name: "继续切换" }));
  await waitFor(() => expect(mock.state.reopen).toHaveBeenCalledExactlyOnceWith("other-record"));
  await waitFor(() => expect(screen.getByRole("dialog", { name: "反推提示词" })).toBeVisible());
});

it("resumes a disconnected active job instead of starting a second analysis", () => {
  mock.state = { ...mock.state, phase: "error", error: { code: "NETWORK_ERROR" }, analysis: { status: "running", image_available: true } };
  show();
  expect(screen.getByRole("alert")).toHaveTextContent("连接暂时中断，请重试；不会自动创建新任务");
  fireEvent.click(screen.getByRole("button", { name: "继续查询" }));
  expect(mock.state.resume).toHaveBeenCalledOnce();
  expect(mock.state.start).not.toHaveBeenCalled();
});

it("disables analysis creation while the selected image is uploading", () => {
  mock.state = { ...mock.state, phase: "uploading", file: new File(["png"], "cat.png", { type: "image/png" }) };
  show();
  expect(screen.getByRole("status")).toHaveTextContent("正在上传图片");
  expect(screen.getByRole("button", { name: "正在处理" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "历史记录" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "正在处理" }));
  expect(mock.state.start).not.toHaveBeenCalled();
});
