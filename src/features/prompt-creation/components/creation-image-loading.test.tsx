import { act, cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../../messages/zh.json";
import { CreationImageLoading } from "./creation-image-loading";

const start = "2026-11-03T04:00:00Z";
const view = (status: "queued" | "running") => (
  <NextIntlClientProvider locale="zh" messages={messages}>
    <CreationImageLoading status={status} createdAt={start} />
  </NextIntlClientProvider>
);

describe("image generation loading", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(start)); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it("advances a clearly marked estimate, remains stable across rerenders and caps below completion", () => {
    const { rerender, unmount } = render(view("running"));
    const progress = screen.getByRole("progressbar", { name: "预计生成进度" });
    expect(progress).toHaveAttribute("aria-valuenow", "5");
    expect(progress).toHaveTextContent(/^5%$/);
    expect(progress).toHaveAttribute("aria-valuetext", "预计 5%");
    act(() => { vi.advanceTimersByTime(6000); });
    expect(progress).toHaveAttribute("aria-valuenow", "8");
    expect(progress).toHaveTextContent(/^8%$/);
    rerender(view("running"));
    expect(progress).toHaveAttribute("aria-valuenow", "8");
    act(() => { vi.advanceTimersByTime(10 * 60_000); });
    expect(progress).toHaveAttribute("aria-valuenow", "95");
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("only shows indeterminate queuing and starts the timer when running", () => {
    const { rerender } = render(view("queued"));
    expect(screen.getByRole("status")).toHaveTextContent("排队中");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
    rerender(view("running"));
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "5");
    expect(vi.getTimerCount()).toBe(1);
  });
});
