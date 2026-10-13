import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { it, expect, vi, afterEach } from "vitest";
import messages from "../../../../messages/zh.json";
import { ImageUpload } from "./image-upload";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("previews a dropped image immediately and reports the uploaded id", async () => {
  URL.createObjectURL = vi.fn(() => "blob:preview"); URL.revokeObjectURL = vi.fn();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({id:"one", image_url:"/one.png"})));
  const change = vi.fn();
  render(<NextIntlClientProvider locale="zh" messages={messages}><ImageUpload onChange={change} onUnauthorized={vi.fn()} /></NextIntlClientProvider>);
  fireEvent.drop(screen.getByTestId("image-dropzone"), {dataTransfer:{files:[new File(["png"],"one.png",{type:"image/png"})]}});
  expect(screen.getByAltText("作品预览 1")).toHaveAttribute("src", "blob:preview");
  expect(await screen.findByText("上传成功")).toBeVisible();
  expect(change).toHaveBeenLastCalledWith([{id:"one", image_url:"/one.png"}], false);
});

function setup(fetcher = vi.fn().mockResolvedValue(Response.json({ id: "one", image_url: "/one.png" }))) {
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const change = vi.fn();
  const view = render(<NextIntlClientProvider locale="zh" messages={messages}><ImageUpload onChange={change} onUnauthorized={vi.fn()} /><textarea aria-label="text" /></NextIntlClientProvider>);
  return { change, fetcher, ...view };
}
const image = (name = "one.png") => new File(["png"], name, { type: "image/png" });
it("accepts file selection and page paste but leaves text inputs alone", async () => {
  const { fetcher } = setup();
  fireEvent.change(screen.getByLabelText("作品图片"), { target: { files: [image()] } });
  await screen.findByText("上传成功");
  const clipboardData = { items: [{ kind: "file", getAsFile: () => image("two.png") }] };
  fireEvent.paste(screen.getByLabelText("text"), { clipboardData });
  expect(fetcher).toHaveBeenCalledTimes(1);
  fireEvent.paste(document.body, { clipboardData });
  expect(await screen.findByAltText("作品预览 2")).toBeVisible();
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it("rejects oversized, unsupported and more than six images", () => {
  const { fetcher } = setup();
  const drop = (files: File[]) => fireEvent.drop(screen.getByTestId("image-dropzone"), { dataTransfer: { files } });
  drop([new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.png", { type: "image/png" })]);
  expect(screen.getByRole("alert")).toBeVisible();
  drop([new File(["bad"], "bad.svg", { type: "image/svg+xml" })]);
  drop(Array.from({ length: 7 }, () => image()));
  expect(fetcher).not.toHaveBeenCalled();
});
it("keeps selection order across concurrent completion and ignores a removed upload", async () => {
  let first!: (response: Response) => void;
  let second!: (response: Response) => void;
  const fetcher = vi.fn().mockImplementationOnce(() => new Promise(resolve => { first = resolve; })).mockImplementationOnce(() => new Promise(resolve => { second = resolve; }));
  const { change } = setup(fetcher);
  fireEvent.drop(screen.getByTestId("image-dropzone"), { dataTransfer: { files: [image("first.png"), image("second.png")] } });
  second(Response.json({ id: "second", image_url: "/second.png" }));
  await screen.findByText("上传成功");
  first(Response.json({ id: "first", image_url: "/first.png" }));
  await waitFor(() => expect(change).toHaveBeenLastCalledWith([{ id: "first", image_url: "/first.png" }, { id: "second", image_url: "/second.png" }], false));
  fireEvent.click(screen.getByRole("button", { name: /first.png/ }));
  expect(URL.revokeObjectURL).toHaveBeenCalled();
  expect(change).toHaveBeenLastCalledWith([{ id: "second", image_url: "/second.png" }], false);
});
it("allows retry after failure and revokes previews on unmount", async () => {
  const fetcher = vi.fn().mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce(Response.json({ id: "ok", image_url: "/ok.png" }));
  const { change, unmount } = setup(fetcher);
  fireEvent.change(screen.getByLabelText("作品图片"), { target: { files: [image()] } });
  await screen.findByText("上传失败，请重试");
  expect(change).toHaveBeenLastCalledWith([], true);
  fireEvent.click(screen.getByRole("button", { name: "重试" }));
  await screen.findByText("上传成功");
  expect(change).toHaveBeenLastCalledWith([{ id: "ok", image_url: "/ok.png" }], false);
  unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
});
it("does not restore a removed pending image after its request completes", async () => {
  let resolve!: (response: Response) => void;
  const { change } = setup(vi.fn(() => new Promise(done => { resolve = done; })));
  fireEvent.change(screen.getByLabelText("作品图片"), { target: { files: [image()] } });
  fireEvent.click(screen.getByRole("button", { name: /one.png/ }));
  resolve(Response.json({ id: "removed", image_url: "/removed.png" }));
  await waitFor(() => expect(screen.queryByAltText("作品预览 1")).not.toBeInTheDocument());
  expect(change).toHaveBeenLastCalledWith([], false);
});
it("opens selection, handles drag feedback and leaves plain text paste unchanged", () => {
  const { fetcher } = setup();
  const input = screen.getByLabelText("作品图片");
  const click = vi.spyOn(input, "click");
  fireEvent.click(screen.getByTestId("image-dropzone"));
  expect(click).toHaveBeenCalled();
  fireEvent.dragOver(screen.getByTestId("image-dropzone"));
  fireEvent.dragLeave(screen.getByTestId("image-dropzone"));
  fireEvent.paste(document.body, { clipboardData: { items: [{ kind: "string" }] } });
  fireEvent.paste(document.body, { clipboardData: { items: [{ kind: "file", getAsFile: () => null }] } });
  fireEvent.change(input, { target: { files: [] } });
  expect(fetcher).not.toHaveBeenCalled();
});
it("reports unauthorized uploads and malformed responses as failures", async () => {
  URL.createObjectURL = vi.fn(() => "blob:preview");
  const unauthorized = vi.fn();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("", { status: 401 })).mockResolvedValueOnce(Response.json({})));
  render(<NextIntlClientProvider locale="zh" messages={messages}><ImageUpload onChange={vi.fn()} onUnauthorized={unauthorized} /></NextIntlClientProvider>);
  fireEvent.change(screen.getByLabelText("作品图片"), { target: { files: [image()] } });
  await screen.findByText("上传失败，请重试");
  expect(unauthorized).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "重试" }));
  await screen.findByText("上传失败，请重试");
});
it("does not start uploads while the form is disabled", () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  render(<NextIntlClientProvider locale="zh" messages={messages}><ImageUpload disabled onChange={vi.fn()} onUnauthorized={vi.fn()} /></NextIntlClientProvider>);
  fireEvent.click(screen.getByTestId("image-dropzone"));
  fireEvent.drop(screen.getByTestId("image-dropzone"), { dataTransfer: { files: [image()] } });
  expect(fetcher).not.toHaveBeenCalled();
});
