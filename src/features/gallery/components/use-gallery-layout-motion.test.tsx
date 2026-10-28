import { useRef } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useGalleryLayoutMotion } from "./use-gallery-layout-motion";

let reduced = false;
let top = 100;
let reduceListeners: (() => void)[] = [];
const cancel = vi.fn();
const animate = vi.fn(() => ({ cancel }));
const scrollBy = vi.fn();
function Harness({ open }: { open: boolean }) {
  const home = useRef<HTMLDivElement>(null);
  const gallery = useRef<HTMLDivElement>(null);
  useGalleryLayoutMotion(open, home, gallery);
  return <><div ref={home} data-testid="home">{!open && <p>current composer</p>}</div><div ref={gallery}><article data-prompt-id="work" /></div></>;
}
beforeEach(() => {
  vi.useFakeTimers(); reduced = false; top = 100; reduceListeners = [];
  vi.stubGlobal("matchMedia", () => ({ get matches() { return reduced; }, addEventListener: (_event: string, callback: () => void) => reduceListeners.push(callback), removeEventListener: vi.fn() }));
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 1));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id));
  vi.stubGlobal("scrollBy", scrollBy);
  vi.spyOn(window, "scrollY", "get").mockReturnValue(200);
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(180);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return { x: 0, y: top, top, bottom: top + 100, left: 0, right: 100, width: 100, height: this.dataset.testid === "home" ? 180 : 100, toJSON: () => ({}) };
  });
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockImplementation(() => [{ width: 100 }] as unknown as DOMRectList);
  vi.stubGlobal("Animation", class {});
  Object.defineProperty(HTMLElement.prototype, "animate", { configurable: true, value: animate });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); animate.mockClear(); cancel.mockClear(); scrollBy.mockClear(); delete (HTMLElement.prototype as Partial<HTMLElement>).animate; });

it("animates only numeric composer height and restores the gallery anchor after layout settles", () => {
  const view = render(<Harness open={false} />);
  top = 220;
  view.rerender(<Harness open />);
  expect(view.queryByText("current composer")).not.toBeInTheDocument();
  expect(animate).toHaveBeenCalledWith([{ height: "180px", opacity: 1 }, { height: "0px", opacity: 0 }], expect.objectContaining({ duration: 240 }));
  expect(scrollBy).not.toHaveBeenCalled();
  act(() => { vi.advanceTimersByTime(241); });
  expect(scrollBy).toHaveBeenCalledWith({ top: 120, behavior: "auto" });
});

it("skips animation and restores immediately for reduced motion", () => {
  reduced = true;
  const view = render(<Harness open={false} />);
  top = 220;
  view.rerender(<Harness open />);
  expect(animate).not.toHaveBeenCalled();
  expect(scrollBy).toHaveBeenCalledWith({ top: 120, behavior: "auto" });
  expect(vi.getTimerCount()).toBe(0);
});

it("cancels numeric animations and pending restoration on unmount", () => {
  const view = render(<Harness open={false} />);
  view.rerender(<Harness open />);
  view.unmount();
  expect(cancel).toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it("remembers the latest ordinary scroll position before opening", () => {
  const view = render(<Harness open={false} />);
  top = 140;
  act(() => { window.dispatchEvent(new Event("scroll")); vi.advanceTimersByTime(1); });
  top = 220;
  view.rerender(<Harness open />);
  act(() => { vi.advanceTimersByTime(241); });
  expect(scrollBy).toHaveBeenCalledWith({ top: 80, behavior: "auto" });
});

it("does not fight manual scrolling during a transition", () => {
  const view = render(<Harness open={false} />);
  top = 140;
  act(() => { window.dispatchEvent(new Event("scroll")); vi.advanceTimersByTime(1); });
  top = 220;
  view.rerender(<Harness open />);
  act(() => { window.dispatchEvent(new Event("wheel")); window.dispatchEvent(new Event("scroll")); vi.advanceTimersByTime(241); });
  expect(scrollBy).not.toHaveBeenCalled();
  view.rerender(<Harness open={false} />);
  expect(animate).toHaveBeenLastCalledWith([{ height: "0px", opacity: 0 }, { height: "180px", opacity: 1 }], expect.objectContaining({ duration: 240 }));
});

it("finishes immediately when the user changes to reduced motion mid-transition", () => {
  const view = render(<Harness open={false} />);
  top = 220;
  view.rerender(<Harness open />);
  reduced = true;
  act(() => { reduceListeners.forEach(listener => listener()); });
  expect(cancel).toHaveBeenCalled();
  expect(scrollBy).toHaveBeenCalledWith({ top: 120, behavior: "auto" });
  expect(vi.getTimerCount()).toBe(0);
});

it("cancels a reversed transition and never keeps an old composer node", () => {
  const view = render(<Harness open={false} />);
  const original = view.getByText("current composer");
  view.rerender(<Harness open />);
  view.rerender(<Harness open={false} />);
  expect(cancel).toHaveBeenCalled();
  expect(view.getByText("current composer")).not.toBe(original);
  act(() => { vi.advanceTimersByTime(241); });
  expect(vi.getTimerCount()).toBe(0);
});
