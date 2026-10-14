import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import { PublishForm } from "./publish-form";
import messages from "../../../../messages/zh.json";
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

beforeEach(() => {
  class TestPointerEvent extends MouseEvent {
    readonly pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerType = init.pointerType ?? "mouse";
    }
  }
  vi.stubGlobal("PointerEvent", TestPointerEvent);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 100,
    bottom: 40,
    width: 100,
    height: 40,
    toJSON: () => ({})
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("rejects an unsupported image before upload and explains review", async () => {
  const user = userEvent.setup({ applyAccept: false });
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  render(<NextIntlClientProvider locale="zh" messages={messages}>
    <PublishForm
      categories={[{
        key: "illustration",
        label: "插画",
        count: 0
      }]}
      models={[{
        key: "Midjourney V7",
        label: "Midjourney V7",
        group: "Midjourney"
      }]}
    />
  </NextIntlClientProvider>);
  expect(screen.getByText(/人工审核/)).toBeVisible();
  await user.upload(screen.getByLabelText("作品图片"), new File(["bad"], "bad.svg", { type: "image/svg+xml" }));
  expect(screen.getByRole("alert")).toHaveTextContent(/5 MB/);
  expect(fetcher).not.toHaveBeenCalled();
});

it("uploads an image then submits its id with the selected full model version", async () => {
  const user = userEvent.setup();
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ id: "00000000-0000-4000-8000-000000000001", image_url: "https://example.com/cat.png" })).mockResolvedValueOnce(Response.json({ id: "work-1" }));
  vi.stubGlobal("fetch", fetcher);
  render(<NextIntlClientProvider locale="zh" messages={messages}>
    <PublishForm
      categories={[{
        key: "illustration",
        label: "插画",
        count: 0
      }]}
      models={[{
        key: "Midjourney V7",
        label: "Midjourney V7",
        group: "Midjourney"
      }]}
    />
  </NextIntlClientProvider>);
  await user.upload(screen.getByLabelText("作品图片"), new File(["png"], "cat.png", { type: "image/png" }));
  expect(await screen.findByAltText("作品预览 1")).toBeVisible();
  await user.type(screen.getByLabelText("作品标题"), "猫咪");
  await user.type(screen.getByLabelText("提示词"), "A watercolor cat");
  await user.click(screen.getByRole("combobox", { name: "作品分类" }));
  await user.click(await screen.findByRole("option", { name: "插画与绘本" }));
  await waitFor(() => expect(screen.getByRole("combobox", { name: "作品分类" })).toHaveAttribute("aria-expanded", "false"));
  await user.click(screen.getByRole("combobox", { name: "模型版本" }));
  expect(await screen.findByRole("group", { name: "Midjourney" })).toBeVisible();
  await user.click(await screen.findByRole("option", { name: "Midjourney V7" }));
  expect(screen.queryByLabelText("补充模型版本（选填）")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "提交审核" }));
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({
    title: "猫咪",
    prompt_text: "A watercolor cat",
    description: "",
    category: "illustration",
    models: ["Midjourney V7"],
    upload_ids: ["00000000-0000-4000-8000-000000000001"]
  });
});

it("accepts a new version only for a generic family and submits the full name", async () => {
  const user = userEvent.setup();
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ id: "00000000-0000-4000-8000-000000000001", image_url: "https://example.com/cat.png" })).mockResolvedValueOnce(Response.json({ id: "work-1" }));
  vi.stubGlobal("fetch", fetcher);
  render(<NextIntlClientProvider locale="zh" messages={messages}>
    <PublishForm
      categories={[{
        key: "illustration",
        label: "插画",
        count: 0
      }]}
      models={[{
        key: "Midjourney",
        label: "Midjourney",
        group: "Midjourney"
      }, {
        key: "Midjourney V7",
        label: "Midjourney V7",
        group: "Midjourney"
      }]}
    />
  </NextIntlClientProvider>);
  await user.upload(screen.getByLabelText("作品图片"), new File(["png"], "cat.png", { type: "image/png" }));
  await screen.findByAltText("作品预览 1");
  await user.type(screen.getByLabelText("作品标题"), "猫咪");
  await user.type(screen.getByLabelText("提示词"), "A watercolor cat");
  await user.click(screen.getByRole("combobox", { name: "作品分类" }));
  await user.click(await screen.findByRole("option", { name: "插画与绘本" }));
  await waitFor(() => expect(screen.getByRole("combobox", { name: "作品分类" })).toHaveAttribute("aria-expanded", "false"));
  await user.click(screen.getByRole("combobox", { name: "模型版本" }));
  await user.click(await screen.findByRole("option", { name: /^Midjourney$/ }));
  const version = screen.getByLabelText("补充模型版本（选填）");
  expect(version).toHaveAttribute("maxlength", "39");
  await user.type(version, "V6.1");
  await user.click(screen.getByRole("button", { name: "提交审核" }));
  expect(JSON.parse(fetcher.mock.calls[1][1].body).models).toEqual(["Midjourney V6.1"]);
});

it("keeps text fields editable but blocks submission during pending and failed uploads", async () => {
  const user = userEvent.setup();
  let reject!: (reason: Error) => void;
  vi.stubGlobal("fetch", vi.fn(() => new Promise((_resolve, fail) => { reject = fail; })));
  render(<NextIntlClientProvider locale="zh" messages={messages}><PublishForm categories={[{ key: "illustration", label: "插画", count: 0 }]} models={[{ key: "Midjourney V7", label: "Midjourney V7" }]} /></NextIntlClientProvider>);
  await user.upload(screen.getByLabelText("作品图片"), new File(["png"], "cat.png", { type: "image/png" }));
  expect(screen.getByRole("button", { name: "提交审核" })).toBeDisabled();
  await user.type(screen.getByLabelText("作品标题"), "正在编辑");
  expect(screen.getByLabelText("作品标题")).toHaveValue("正在编辑");
  reject(new Error("network"));
  await screen.findByText("上传失败，请重试");
  expect(screen.getByRole("button", { name: "提交审核" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: /移除.*cat.png/ }));
  expect(screen.getByRole("button", { name: "提交审核" })).not.toBeDisabled();
});

it("allows a zero-inventory new category but excludes all legacy categories", async () => {
  const { fallbackCategories } = await import("@/features/gallery/data/categories");
  render(<NextIntlClientProvider locale="zh" messages={messages}><PublishForm categories={[...fallbackCategories, { key: "photography", label: "模拟摄影", count: 10 }, { key: "image_edit", label: "图片编辑", count: 10 }, { key: "workflow", label: "工作流", count: 10 }]} models={[{ key: "FLUX", label: "FLUX" }]} /></NextIntlClientProvider>);
  await userEvent.click(screen.getByRole("combobox", { name: "作品分类" }));
  expect(await screen.findAllByRole("option")).toHaveLength(12);
  expect(screen.queryByRole("option", {name: "模拟摄影"})).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("option", {name: "商品与电商"}));
  expect(screen.getByRole("combobox", {name: "作品分类"})).toHaveTextContent("商品与电商");
});
