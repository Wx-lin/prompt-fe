import { useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import messages from "../../../../messages/zh.json";
import { CreationComposer } from "./creation-composer";
import styles from "./creation.module.css";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function setup(extra = {}) {
  const props = { message: "", previewUrl: null, disabled: false, onMessage: vi.fn(), onSelectFile: vi.fn(), onClearAttachment: vi.fn(), onSend: vi.fn(), onHistory: vi.fn(), ...extra };
  render(<NextIntlClientProvider locale="zh" messages={messages}><CreationComposer {...props} /></NextIntlClientProvider>);
  return props;
}
describe("unified creation composer", () => {
  it("has one clear creation input and explicit image/history/send actions without section headings", () => {
    const props = setup();
    expect(screen.getByRole("textbox", { name: "说说你的想法，帮你写成提示词" })).toBeVisible();
    expect(screen.getByRole("button", { name: "发送" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "历史" }));
    expect(props.onHistory).toHaveBeenCalledOnce();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
  it("selects a valid image locally and does not submit it until send", () => {
    const props = setup({ message: "想法" });
    const file = new File(["image"], "photo.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("选择创作参考图片"), { target: { files: [file] } });
    expect(props.onSelectFile).toHaveBeenCalledWith(file);
    expect(props.onSend).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "发送" }));
    expect(props.onSend).toHaveBeenCalledOnce();
  });
  it("rejects multiple/invalid attachments and supports pasted files inside the textbox", () => {
    const props = setup();
    const input = screen.getByLabelText("选择创作参考图片");
    fireEvent.change(input, { target: { files: [new File(["bad"], "bad.svg", { type: "image/svg+xml" })] } });
    expect(props.onSelectFile).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("5 MiB");
    const file = new File(["image"], "ok.png", { type: "image/png" });
    fireEvent.paste(screen.getByRole("textbox"), { clipboardData: { files: [file] } });
    expect(props.onSelectFile).toHaveBeenCalledWith(file);
  });
  it("keeps IME/newlines intact and supports explicit Ctrl+Enter with Unicode input", () => {
    const props = setup({ message: "想法" });
    const input = screen.getByRole("textbox");
    fireEvent.keyDown(input, { key: "Enter", ctrlKey: true, isComposing: true });
    expect(props.onSend).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter", ctrlKey: true });
    expect(props.onSend).toHaveBeenCalledOnce();
    fireEvent.change(input, { target: { value: "🐱".repeat(501) } });
    expect(props.onMessage).toHaveBeenLastCalledWith("🐱".repeat(500));
  });
  it("shows one removable reference, and disabled form cannot replace or send", () => {
    const props = setup({ previewUrl: "/photo.jpg", disabled: true });
    expect(screen.getByRole("img", { name: "参考图片" })).toHaveAttribute("src", "/photo.jpg");
    expect(screen.getByRole("button", { name: "移除参考图片" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("选择创作参考图片"), { target: { files: [new File(["a"], "ok.png", { type: "image/png" })] } });
    expect(props.onSelectFile).not.toHaveBeenCalled();
  });

  it("opens the native image picker and allows selecting the same file again after reset", async () => {
    const props = setup();
    const user = userEvent.setup();
    const input = screen.getByLabelText("选择创作参考图片") as HTMLInputElement;
    const open = vi.spyOn(input, "click");
    await user.click(screen.getByRole("button", { name: "图片转提示词" }));
    expect(open).toHaveBeenCalledOnce();
    const file = new File(["image"], "repeat.png", { type: "image/png" });
    await user.upload(input, file);
    expect(input.value).toBe("");
    expect(input.files).toHaveLength(0);
    await user.upload(input, file);
    expect(props.onSelectFile).toHaveBeenCalledTimes(2);
    expect(props.onSelectFile).toHaveBeenLastCalledWith(file);
    expect(props.onSend).not.toHaveBeenCalled();
  });

  it("treats an empty native picker result as cancel without showing a validation error", () => {
    const props = setup();
    fireEvent.change(screen.getByLabelText("选择创作参考图片"), { target: { files: null } });
    expect(props.onSelectFile).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps the drop affordance when moving between its own controls and clears it after leaving or dropping", () => {
    const props = setup();
    const textbox = screen.getByRole("textbox");
    const form = textbox.closest("form")!;
    expect(fireEvent.dragOver(form)).toBe(false);
    expect(form).toHaveClass(styles.dragging);
    fireEvent(form, new MouseEvent("dragleave", { bubbles: true, relatedTarget: textbox }));
    expect(form).toHaveClass(styles.dragging);
    fireEvent(form, new MouseEvent("dragleave", { bubbles: true, relatedTarget: document.body }));
    expect(form).not.toHaveClass(styles.dragging);
    fireEvent.dragOver(form);
    const file = new File(["image"], "dropped.webp", { type: "image/webp" });
    expect(fireEvent.drop(form, { dataTransfer: { files: [file] } })).toBe(false);
    expect(form).not.toHaveClass(styles.dragging);
    expect(props.onSelectFile).toHaveBeenCalledWith(file);
    expect(props.onSend).not.toHaveBeenCalled();
  });

  it("rejects multiple dropped references and clears the warning after one valid reference is dropped", () => {
    const props = setup();
    const form = screen.getByRole("textbox").closest("form")!;
    const file = new File(["image"], "reference.png", { type: "image/png" });
    fireEvent.drop(form, { dataTransfer: { files: [file, file] } });
    expect(screen.getByRole("alert")).toBeVisible();
    expect(props.onSelectFile).not.toHaveBeenCalled();
    fireEvent.drop(form, { dataTransfer: { files: [file] } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(props.onSelectFile).toHaveBeenCalledOnce();
  });

  it("ignores drag-and-drop and shortcut submission while disabled", () => {
    const props = setup({ message: "保存期间不可再次发送", disabled: true });
    const textbox = screen.getByRole("textbox");
    const form = textbox.closest("form")!;
    fireEvent.dragOver(form);
    expect(form).not.toHaveClass(styles.dragging);
    fireEvent.drop(form, { dataTransfer: { files: [new File(["image"], "ignored.png", { type: "image/png" })] } });
    fireEvent.keyDown(textbox, { key: "Enter", metaKey: true });
    fireEvent.submit(form);
    expect(props.onSelectFile).not.toHaveBeenCalled();
    expect(props.onSend).not.toHaveBeenCalled();
  });

  it("preserves typed Unicode, line breaks and composing input until the user explicitly sends", async () => {
    const onSend = vi.fn();
    function TypingComposer() {
      const [message, onMessage] = useState("");
      return <CreationComposer message={message} previewUrl={null} onMessage={onMessage} onSelectFile={vi.fn()} onClearAttachment={vi.fn()} onSend={onSend} />;
    }
    render(<NextIntlClientProvider locale="zh" messages={messages}><TypingComposer /></NextIntlClientProvider>);
    const user = userEvent.setup();
    const textbox = screen.getByRole("textbox");
    await user.type(textbox, "雨夜🐱{Shift>}{Enter}{/Shift}霓虹");
    expect(textbox).toHaveValue("雨夜🐱\n霓虹");
    expect(screen.getByText("6/500")).toBeVisible();
    fireEvent.keyDown(textbox, { key: "Enter", metaKey: true, isComposing: true });
    expect(onSend).not.toHaveBeenCalled();
    fireEvent.keyDown(textbox, { key: "Enter", metaKey: true });
    expect(onSend).toHaveBeenCalledOnce();
  });

  it("allows ordinary text paste and prevents whitespace-only form submission", () => {
    const props = setup({ message: " \n " });
    const textbox = screen.getByRole("textbox");
    expect(fireEvent.paste(textbox, { clipboardData: { files: [] } })).toBe(true);
    fireEvent.submit(textbox.closest("form")!);
    expect(props.onSelectFile).not.toHaveBeenCalled();
    expect(props.onSend).not.toHaveBeenCalled();
  });

  it("removes the current reference and resumes an existing conversation through explicit actions", () => {
    const onContinue = vi.fn();
    const props = setup({ previewUrl: "/reference.png", onContinue, followup: true });
    fireEvent.click(screen.getByRole("button", { name: "移除参考图片" }));
    expect(props.onClearAttachment).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "继续上次创作" }));
    expect(onContinue).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "发送" }));
    expect(props.onSend).toHaveBeenCalledOnce();
  });

  it("sends with desktop Enter and keeps Shift+Enter available for a newline", () => {
    const props = setup({ message: "雨夜的小猫" });
    const textbox = screen.getByRole("textbox");
    expect(fireEvent.keyDown(textbox, { key: "Enter", shiftKey: true })).toBe(true);
    expect(props.onSend).not.toHaveBeenCalled();
    expect(fireEvent.keyDown(textbox, { key: "Enter" })).toBe(false);
    expect(props.onSend).toHaveBeenCalledOnce();
  });

  it("does not send a held Enter or an IME commit even when Safari omits isComposing", () => {
    const props = setup({ message: "输入法正在选词" });
    const textbox = screen.getByRole("textbox");
    fireEvent.keyDown(textbox, { key: "Enter", repeat: true });
    fireEvent.compositionStart(textbox);
    fireEvent.keyDown(textbox, { key: "Enter", isComposing: false });
    fireEvent.compositionEnd(textbox);
    fireEvent.keyDown(textbox, { key: "Enter", keyCode: 229 });
    expect(props.onSend).not.toHaveBeenCalled();
    fireEvent.keyDown(textbox, { key: "Enter", keyCode: 13 });
    expect(props.onSend).toHaveBeenCalledOnce();
  });

  it("preserves the coarse-pointer mobile Enter key while keeping explicit shortcut and button send", () => {
    vi.stubGlobal("matchMedia", vi.fn((query: string) => ({ matches: query.includes("pointer: coarse"), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn() })));
    const props = setup({ message: "手机上输入的多行想法" });
    const textbox = screen.getByRole("textbox");
    expect(fireEvent.keyDown(textbox, { key: "Enter" })).toBe(true);
    expect(props.onSend).not.toHaveBeenCalled();
    expect(fireEvent.keyDown(textbox, { key: "Enter", ctrlKey: true })).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "发送" }));
    expect(props.onSend).toHaveBeenCalledTimes(2);
  });

  it("shows the keyboard hint as an accessible description without a visible paste instruction", () => {
    setup();
    expect(screen.getByRole("textbox")).toHaveAccessibleDescription("Enter 发送 · Shift+Enter 换行");
    expect(screen.queryByText("支持粘贴")).not.toBeInTheDocument();
  });

  it("grows with content, bounds long drafts and shrinks after clearing without manual resizing", () => {
    const props = { previewUrl: null, onMessage: vi.fn(), onSelectFile: vi.fn(), onClearAttachment: vi.fn(), onSend: vi.fn() };
    const view = (message: string) => <NextIntlClientProvider locale="zh" messages={messages}><CreationComposer {...props} message={message} /></NextIntlClientProvider>;
    const { rerender } = render(view("短句"));
    const textbox = screen.getByRole("textbox") as HTMLTextAreaElement;
    textbox.style.minHeight = "56px"; textbox.style.maxHeight = "208px";
    let contentHeight = 56;
    // Browser scrollHeight cannot shrink below the current client box until height is reset for measurement.
    Object.defineProperty(textbox, "scrollHeight", { configurable: true, get: () => Math.max(contentHeight, Number.parseFloat(textbox.style.height) || 0) });
    rerender(view("初始短句"));
    const baseline = Number.parseFloat(textbox.style.height);
    contentHeight = 140; rerender(view("第一行\n第二行\n第三行"));
    const expanded = Number.parseFloat(textbox.style.height);
    expect(expanded).toBeGreaterThan(baseline);
    contentHeight = 380; rerender(view("很多行\n".repeat(50)));
    const bounded = Number.parseFloat(textbox.style.height);
    expect(bounded).toBeGreaterThanOrEqual(expanded);
    expect(bounded).toBeLessThan(contentHeight);
    expect(textbox.style.overflowY).toBe("auto");
    contentHeight = 28; rerender(view(""));
    expect(Number.parseFloat(textbox.style.height)).toBeLessThan(expanded);
    expect(textbox.style.overflowY).toBe("hidden");
  });

  it("remeasures wrapped text after the composer width changes and disconnects its observer", () => {
    let observerCallback: ResizeObserverCallback | undefined;
    const disconnect = vi.fn();
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: ResizeObserverCallback) { observerCallback = callback; }
      observe = vi.fn(); unobserve = vi.fn(); disconnect = disconnect;
    });
    const { unmount } = render(<NextIntlClientProvider locale="zh" messages={messages}><CreationComposer message="同一句想法在窄屏中换行" previewUrl={null} onMessage={vi.fn()} onSelectFile={vi.fn()} onClearAttachment={vi.fn()} onSend={vi.fn()} /></NextIntlClientProvider>);
    const textbox = screen.getByRole("textbox") as HTMLTextAreaElement;
    textbox.style.minHeight = "56px"; textbox.style.maxHeight = "208px";
    let contentHeight = 70;
    Object.defineProperty(textbox, "scrollHeight", { configurable: true, get: () => contentHeight });
    expect(observerCallback).toBeDefined();
    const resize = (width: number) => act(() => observerCallback!([{ target: textbox, contentRect: new DOMRect(0, 0, width, contentHeight), borderBoxSize: [], contentBoxSize: [], devicePixelContentBoxSize: [] }], { observe: vi.fn(), unobserve: vi.fn(), disconnect }));
    resize(480);
    const wideHeight = Number.parseFloat(textbox.style.height);
    contentHeight = 150;
    resize(260);
    expect(Number.parseFloat(textbox.style.height)).toBeGreaterThan(wideHeight);
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });
});
