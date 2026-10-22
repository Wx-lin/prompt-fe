import { useSyncExternalStore } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, expect, it, vi } from "vitest";
import messages from "../../../../messages/zh.json";
import type { AnalysisSummary } from "@/types/prompt-analysis";
import { ApiError, promptAnalysisClient } from "../lib/client";
import { createPromptAnalysisWorkflow } from "../lib/workflow";
import { AnalysisHistory } from "./analysis-history";

afterEach(cleanup);
const record: AnalysisSummary = {
  id: "00000000-0000-4000-8000-000000000001", asset_id: "00000000-0000-4000-8000-000000000002",
  status: "succeeded", phase: "finished", revision: 0, created_at: "2026-10-22T08:00:00Z",
  finished_at: "2026-10-22T08:00:10Z", title: "海边的猫", error_code: null,
  history_retain_until: "2026-11-21T08:00:00Z", image_available: true,
  preview_url: "https://images.example/preview.jpg", thumbnail_url: "https://images.example/thumb.jpg",
  preview_expires_at: "2026-10-22T08:10:00Z", summary: { zh: "猫坐在海边", en: "A cat by the sea" },
};
type Props = Parameters<typeof AnalysisHistory>[0];
function show(overrides: Partial<Props> = {}, locale = "zh") {
  const props: Props = {
    items: [record], loading: false, error: null, hasMore: false,
    onOpen: vi.fn().mockResolvedValue(undefined), onDelete: vi.fn().mockResolvedValue(undefined),
    onLoad: vi.fn().mockResolvedValue(undefined), ...overrides,
  };
  const view = render(<NextIntlClientProvider locale={locale} messages={messages}><AnalysisHistory {...props} /></NextIntlClientProvider>);
  return { ...view, props };
}
function connected(flow: ReturnType<typeof createPromptAnalysisWorkflow>) {
  function Connected() {
    const state = useSyncExternalStore(flow.subscribe, flow.getSnapshot, flow.getSnapshot);
    return <AnalysisHistory items={state.history} loading={state.historyLoading} error={state.historyError}
      hasMore={state.hasMore} onOpen={flow.reopen} onDelete={flow.removeHistory} onLoad={flow.loadHistory} />;
  }
  return render(<NextIntlClientProvider locale="zh" messages={messages}><Connected /></NextIntlClientProvider>);
}

it("opens the chosen history record and prevents another open while it loads", async () => {
  let finish!: () => void;
  const onOpen = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  show({ items: [record, { ...record, id: "another", title: "另一张图" }], onOpen });
  fireEvent.click(screen.getByRole("button", { name: "打开记录 海边的猫" }));
  expect(onOpen).toHaveBeenCalledExactlyOnceWith(record.id);
  expect(screen.getByRole("button", { name: "打开记录 海边的猫" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "打开记录 另一张图" })).toBeDisabled();
  await act(async () => finish());
  expect(screen.getByRole("button", { name: "打开记录 另一张图" })).toBeEnabled();
  expect(within(screen.getByRole("button", { name: "打开记录 海边的猫" })).getByText("猫坐在海边")).toBeVisible();
});

it("keeps a record readable when its signed thumbnail expires", () => {
  show();
  const open = screen.getByRole("button", { name: "打开记录 海边的猫" });
  const image = open.querySelector("img");
  expect(image).toHaveAttribute("referrerPolicy", "no-referrer");
  fireEvent.error(image!);
  expect(open.querySelector("img")).toBeNull();
  expect(open).toBeVisible();
  expect(within(open).getByText("猫坐在海边")).toBeVisible();
});

it("shows a text-only queued record with a useful fallback title", () => {
  show({ items: [{ ...record, title: null, status: "queued", summary: {}, image_available: false, thumbnail_url: null, preview_url: null, preview_expires_at: null }] });
  const open = screen.getByRole("button", { name: "打开记录 图片反推" });
  expect(within(open).getByText("正在排队")).toBeVisible();
  expect(open.querySelector("img")).toBeNull();
});

it("uses the stored English summary when the site language is English", () => {
  show({}, "en");
  expect(screen.getByText("A cat by the sea")).toBeVisible();
  expect(screen.queryByText("猫坐在海边")).not.toBeInTheDocument();
});

it("asks before deletion and keeps the record when confirmation is canceled", async () => {
  const { props } = show();
  fireEvent.click(screen.getByRole("button", { name: "删除记录 海边的猫" }));
  expect(screen.getByRole("alertdialog", { name: "删除这条记录？" })).toBeVisible();
  expect(props.onDelete).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "保留" }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  expect(screen.getByRole("button", { name: "打开记录 海边的猫" })).toBeVisible();
  expect(props.onDelete).not.toHaveBeenCalled();
});

it("waits for confirmed deletion before removing a record and showing the empty state", async () => {
  let finish!: () => void;
  const remove = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  const flow = createPromptAnalysisWorkflow({ client: { ...promptAnalysisClient,
    history: vi.fn().mockResolvedValue({ items: [record], pagination: { limit: 20, has_more: false, next_cursor: null } }), remove,
  } });
  await flow.loadHistory();
  connected(flow);
  fireEvent.click(screen.getByRole("button", { name: "删除记录 海边的猫" }));
  fireEvent.click(screen.getByRole("button", { name: "删除" }));
  expect(remove).toHaveBeenCalledWith(record.id, expect.any(AbortSignal));
  expect(screen.getByRole("button", { name: "删除" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "保留" })).toBeDisabled();
  expect(screen.getByText("海边的猫")).toBeInTheDocument();
  await act(async () => finish());
  await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  expect(screen.queryByRole("button", { name: "打开记录 海边的猫" })).not.toBeInTheDocument();
  expect(screen.getByText("还没有反推记录")).toBeVisible();
  flow.destroy();
});

it("retains a record after a failed deletion and lets the user refresh history", async () => {
  const history = vi.fn().mockResolvedValue({ items: [record], pagination: { limit: 20, has_more: false, next_cursor: null } });
  const remove = vi.fn().mockRejectedValue(new ApiError(503, "SERVICE_UNAVAILABLE"));
  const flow = createPromptAnalysisWorkflow({ client: { ...promptAnalysisClient, history, remove } });
  await flow.loadHistory();
  connected(flow);
  fireEvent.click(screen.getByRole("button", { name: "删除记录 海边的猫" }));
  fireEvent.click(screen.getByRole("button", { name: "删除" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("服务暂不可用，请稍后再试"));
  expect(screen.getByRole("button", { name: "打开记录 海边的猫" })).toBeVisible();
  history.mockResolvedValue({ items: [{ ...record, title: "服务器中的记录" }], pagination: { limit: 20, has_more: false, next_cursor: null } });
  fireEvent.click(screen.getByRole("button", { name: "重试" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "打开记录 服务器中的记录" })).toBeVisible());
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(history).toHaveBeenCalledTimes(2);
  flow.destroy();
});

it("loads the next history page and disables further requests while loading", async () => {
  const { props, rerender } = show({ hasMore: true });
  fireEvent.click(screen.getByRole("button", { name: "加载更多" }));
  expect(props.onLoad).toHaveBeenCalledExactlyOnceWith(true);
  rerender(<NextIntlClientProvider locale="zh" messages={messages}><AnalysisHistory {...props} loading /></NextIntlClientProvider>);
  const busy = screen.getByRole("button", { name: "正在加载记录" });
  expect(busy).toBeDisabled();
  fireEvent.click(busy);
  expect(props.onLoad).toHaveBeenCalledOnce();
});

it("shows a pending history request without incorrectly claiming it is empty", () => {
  show({ items: [], loading: true });
  expect(screen.getByRole("heading", { name: "正在加载记录" })).toBeVisible();
  expect(screen.queryByText("还没有反推记录")).not.toBeInTheDocument();
});

it.each([
  [{ code: "UNAUTHENTICATED", status: 401 }, "登录后开始反推，结果会保存在你的历史中"],
  [{ code: "RATE_LIMITED", status: 429 }, "操作较频繁，请稍后再试"],
  [{ code: "NOT_FOUND", status: 404 }, "记录不存在或已过期"],
  [{ code: "NETWORK_ERROR", status: 0 }, "连接暂时中断，请重试；不会自动创建新任务"],
])("shows a useful history error and retries the first page", (error, message) => {
  const { props } = show({ items: [], error });
  expect(screen.getByRole("heading", { name: "暂时无法加载记录" })).toBeVisible();
  expect(screen.getByRole("alert")).toHaveTextContent(message);
  fireEvent.click(screen.getByRole("button", { name: "重试" }));
  expect(props.onLoad).toHaveBeenCalledExactlyOnceWith(false);
});
