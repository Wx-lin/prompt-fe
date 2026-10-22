import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, expect, it, vi } from "vitest";
import messages from "../../../../messages/zh.json";
import type { AnalysisDetail } from "@/types/prompt-analysis";
import { AnalysisResultPane } from "./analysis-result";

afterEach(cleanup);
const pair = { zh: "中文画面描述", en: "An English image description" };
const analysis = {
  id: "one", status: "succeeded", result: { schema_version: "1", title: "图片", prompt: pair,
    breakdown: { subject: pair, composition: pair, lighting: pair, style: pair }, uncertain_details: ["小字无法确认"] },
} as AnalysisDetail;
function setup(overrides: Partial<Parameters<typeof AnalysisResultPane>[0]> = {}) {
  const edit = vi.fn();
  const retry = vi.fn();
  render(<NextIntlClientProvider locale="zh" messages={messages}><AnalysisResultPane analysis={analysis} draft={pair} language="zh" phase="succeeded" error={null} saving={false} saved onEdit={edit} saveError={null} onRetrySave={retry} {...overrides} /></NextIntlClientProvider>);
  return { edit, retry };
}
it("shows editable complete prompt and accessible breakdown tabs", () => {
  const { edit } = setup();
  const input = screen.getByRole("textbox", { name: "完整提示词" });
  expect(input).toHaveValue(pair.zh);
  fireEvent.change(input, { target: { value: "修改后" } });
  expect(edit).toHaveBeenLastCalledWith("zh", "修改后");
  fireEvent.click(screen.getByRole("tab", { name: "画面拆解" }));
  expect(screen.getByText("小字无法确认")).toBeVisible();
  expect(screen.getByRole("heading", { name: "构图" })).toBeVisible();
});
it("uses existing English output without a new model request", () => {
  setup({ language: "en" });
  expect(screen.getByRole("textbox", { name: "完整提示词" })).toHaveValue(pair.en);
});
it("shows real queued state and never an editable fake result", () => {
  setup({ analysis: null, phase: "queued", saved: false });
  expect(screen.getByText("正在排队")).toBeVisible();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});
it("keeps conflicting edits copyable without offering an overwrite retry", () => {
  setup({ saved: false, saveError: { code: "REVISION_CONFLICT" } });
  expect(screen.queryByText("已保存到历史")).not.toBeInTheDocument();
  expect(screen.getByText("记录已更新，当前修改尚未保存")).toBeVisible();
  expect(screen.queryByRole("button", { name: "重试保存" })).not.toBeInTheDocument();
  expect(screen.getByText("请先复制当前修改，再从历史重新打开")).toBeVisible();
  expect(screen.getByRole("textbox")).toHaveValue(pair.zh);
});
it("offers retry for an ordinary failed save", () => {
  const { retry } = setup({ saved: false, saveError: { code: "NETWORK_ERROR" } });
  fireEvent.click(screen.getByRole("button", { name: "重试保存" }));
  expect(retry).toHaveBeenCalledOnce();
});
