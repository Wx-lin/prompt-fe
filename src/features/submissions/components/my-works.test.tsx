import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import { MyWorks } from "./my-works";
import messages from "../../../../messages/zh.json";
import type { ComponentProps } from "react";
const router = { push: vi.fn() };
vi.mock("@/i18n/navigation", () => ({ useRouter: () => router, Link: (props: ComponentProps<"a">) => <a {...props} /> }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("shows pending, published, rejected and taken-down states with review reasons", async () => {
  const base = {
    image_urls: [],
    created_at: "2026-10-13",
    review_note: null,
    published: false
  };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
    items: [
      {
        ...base,
        id: "1",
        title: "one",
        review_status: "pending"
      },
      {
        ...base,
        id: "2",
        title: "two",
        review_status: "approved",
        published: true
      },
      {
        ...base,
        id: "3",
        title: "three",
        review_status: "rejected",
        review_note: "请补充提示词"
      },
      {
        ...base,
        id: "4",
        title: "four",
        review_status: "approved",
        review_note: "作者申请下架"
      },
    ],
    has_more: false
  })));
  render(<NextIntlClientProvider locale="zh" messages={messages}>
    <MyWorks />
  </NextIntlClientProvider>);
  expect(await screen.findByText("待审核")).toBeVisible();
  expect(screen.getByText("已公开")).toBeVisible();
  expect(screen.getByText("未通过")).toBeVisible();
  expect(screen.getByText("已下架")).toBeVisible();
  expect(screen.getByText("请补充提示词")).toBeVisible();
  expect(screen.getByText("作者申请下架")).toBeVisible();
});
