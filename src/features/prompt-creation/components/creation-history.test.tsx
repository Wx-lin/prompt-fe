import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CreationHistory } from "./creation-history";

vi.mock("next-intl", () => ({ useLocale: () => "zh", useTranslations: () => (key: string, values?: Record<string, number>) => key === "version" ? `版本 ${values?.version}` : key === "historyTurns" ? `${values?.count}轮对话` : key }));
vi.mock("./creation-provider", () => ({ useCreation: () => ({
  state: { history: [{ id: "chat", title: "普通问题", version: 3, status: "succeeded", created_at: "2026-10-28T00:00:00Z" }], historyLoading: false, historyError: null, hasMore: false },
  workflow: {}, guard: vi.fn(),
}) }));
afterEach(cleanup);

it("labels history by message turns rather than prompt versions", () => {
  render(<CreationHistory />);
  expect(screen.getByRole("button", { name: "普通问题" })).toBeVisible();
  expect(screen.getByText(/3轮对话/)).toBeVisible();
  expect(screen.queryByText(/版本/)).not.toBeInTheDocument();
});
