import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, expect, it, vi } from "vitest";
import messages from "../../../../messages/zh.json";
import { ImageInput } from "./image-input";

afterEach(cleanup);
const image = () => new File(["png"], "reference.png", { type: "image/png" });
function setup(active = true, disabled = false) {
  const select = vi.fn();
  render(<NextIntlClientProvider locale="zh" messages={messages}><ImageInput active={active} disabled={disabled} previewUrl={null} onSelect={select} /><textarea aria-label="text" /></NextIntlClientProvider>);
  return select;
}
it("selects one image locally without starting requests", () => {
  const select = setup();
  const file = image();
  fireEvent.change(screen.getByLabelText("选择参考图片"), { target: { files: [file] } });
  expect(select).toHaveBeenCalledExactlyOnceWith(file);
});
it("accepts image paste outside editors and ignores text inputs", () => {
  const select = setup();
  const file = image();
  const clipboardData = { items: [{ kind: "file", getAsFile: () => file }] };
  fireEvent.paste(screen.getByLabelText("text"), { clipboardData });
  expect(select).not.toHaveBeenCalled();
  fireEvent.paste(document.body, { clipboardData });
  expect(select).toHaveBeenCalledExactlyOnceWith(file);
});
it("rejects video, oversized files and multiple images", () => {
  const select = setup();
  const drop = screen.getByTestId("prompt-image-dropzone");
  for (const files of [
    [new File(["video"], "video.mp4", { type: "video/mp4" })],
    [new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.png", { type: "image/png" })],
    [image(), image()],
  ]) fireEvent.drop(drop, { dataTransfer: { files } });
  expect(screen.getByRole("alert")).toBeVisible();
  expect(select).not.toHaveBeenCalled();
});
it("does not intercept paste or drop while closed or busy", () => {
  const select = setup(false, true);
  fireEvent.paste(document.body, { clipboardData: { items: [{ kind: "file", getAsFile: image }] } });
  fireEvent.drop(screen.getByTestId("prompt-image-dropzone"), { dataTransfer: { files: [image()] } });
  expect(select).not.toHaveBeenCalled();
});
it("keeps the reference image visible and provides replacement", () => {
  render(<NextIntlClientProvider locale="zh" messages={messages}><ImageInput active previewUrl="blob:reference" fileName="reference.png" onSelect={vi.fn()} /></NextIntlClientProvider>);
  expect(screen.getByAltText("参考图片")).toHaveAttribute("src", "blob:reference");
  expect(screen.getByRole("button", { name: "更换图片" })).toBeVisible();
});
