import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CharacterAiComposer } from "./character-ai-composer";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("character AI composer", () => {
  it("does not submit a blank description and sends the current value on Enter", () => {
    const onSubmit = vi.fn();
    const onChange = vi.fn();
    const { rerender } = render(<div><CharacterAiComposer en={false} value="  " onChange={onChange} onSubmit={onSubmit} /></div>);
    expect(screen.getByRole("button", { name: "生成角色" })).toBeDisabled();
    rerender(<div><CharacterAiComposer en={false} value="黑色长发" onChange={onChange} onSubmit={onSubmit} /></div>);
    const input = screen.getByRole("textbox", { name: "描述角色，AI 快速创建" });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    fireEvent.change(input, { target: { value: "红色短发" } });
    expect(onChange).toHaveBeenCalledWith("红色短发");
  });

  it("prevents duplicate submissions and shows the supplied error", () => {
    const onSubmit = vi.fn();
    render(<div><CharacterAiComposer en={false} value="角色" onChange={vi.fn()} onSubmit={onSubmit} busy error="生成失败，请重试" /></div>);
    expect(screen.getByRole("button", { name: "生成中" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("生成失败，请重试");
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("offers keyboard movement with arrow keys, constrained to the preview", () => {
    render(<div data-testid="preview"><CharacterAiComposer en={false} value="角色" onChange={vi.fn()} onSubmit={vi.fn()} /></div>);
    const parent = screen.getByTestId("preview");
    const handle = screen.getByRole("button", { name: /移动输入框/ });
    const composer = handle.parentElement!;
    vi.spyOn(parent, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, right: 500, bottom: 400, width: 500, height: 400, x: 0, y: 0, toJSON: () => ({}) });
    vi.spyOn(composer, "getBoundingClientRect").mockReturnValue({ left: 100, top: 330, right: 400, bottom: 380, width: 300, height: 50, x: 100, y: 330, toJSON: () => ({}) });
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(composer).toHaveStyle({ left: "110px", top: "330px" });
    fireEvent.keyDown(handle, { key: "ArrowDown", shiftKey: true });
    expect(composer).toHaveStyle({ left: "110px", top: "350px" });
  });

  it("keeps pointer dragging inside the preview even when dragged past an edge", () => {
    class TestPointerEvent extends MouseEvent {
      pointerId: number;
      constructor(type: string, init: MouseEventInit & { pointerId?: number }) { super(type, init); this.pointerId = init.pointerId ?? 1; }
    }
    vi.stubGlobal("PointerEvent", TestPointerEvent);
    render(<div data-testid="preview"><CharacterAiComposer en={false} value="角色" onChange={vi.fn()} onSubmit={vi.fn()} /></div>);
    const parent = screen.getByTestId("preview");
    const handle = screen.getByRole("button", { name: /移动输入框/ });
    const composer = handle.parentElement!;
    vi.spyOn(parent, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, right: 500, bottom: 400, width: 500, height: 400, x: 0, y: 0, toJSON: () => ({}) });
    vi.spyOn(composer, "getBoundingClientRect").mockReturnValue({ left: 100, top: 330, right: 400, bottom: 380, width: 300, height: 50, x: 100, y: 330, toJSON: () => ({}) });
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 100, clientY: 330, button: 0 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 1000, clientY: 1000 });
    expect(composer).toHaveStyle({ left: "200px", top: "350px" });
    fireEvent.pointerUp(handle, { pointerId: 1 });
  });
});
