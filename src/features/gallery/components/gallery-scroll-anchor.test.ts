import { afterEach, expect, it, vi } from "vitest";
import { readGalleryAnchor, restoreGalleryAnchor } from "./gallery-scroll-anchor";

afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });
function artwork(root: HTMLElement, id: string, top: number, visible = true) {
  const card = document.createElement("article");
  card.dataset.promptId = id;
  const bounds = { top, bottom: top + 160, height: 160, left: 0, right: 160, width: 160, x: 0, y: top, toJSON: () => ({}) };
  vi.spyOn(card, "getBoundingClientRect").mockReturnValue(bounds);
  vi.spyOn(card, "getClientRects").mockReturnValue((visible ? [bounds] : []) as unknown as DOMRectList);
  root.appendChild(card);
  return card;
}

it("remembers a visible work instead of the hidden duplicate layout or an offscreen card", () => {
  const root = document.createElement("div");
  artwork(root, "hidden", 10, false);
  artwork(root, "above", -300);
  artwork(root, "visible", 88);
  vi.spyOn(window, "scrollY", "get").mockReturnValue(300);
  expect(readGalleryAnchor(root)).toEqual({ promptId: "visible", offset: 88, windowScrollY: 300 });
});

it("restores the same work's viewport offset after the gallery changes column count", () => {
  const root = document.createElement("div");
  artwork(root, "visible", 130);
  const scroll = vi.spyOn(window, "scrollBy").mockImplementation(() => {});
  restoreGalleryAnchor(root, { promptId: "visible", offset: 88, windowScrollY: 300 });
  expect(scroll).toHaveBeenCalledExactlyOnceWith({ top: 42, behavior: "auto" });
});

it("keeps the first viewport at the top and never jumps when a previous work is gone", () => {
  const root = document.createElement("div");
  artwork(root, "visible", 130);
  const scroll = vi.spyOn(window, "scrollBy").mockImplementation(() => {});
  restoreGalleryAnchor(root, { promptId: "visible", offset: 88, windowScrollY: 0 });
  restoreGalleryAnchor(root, { promptId: "removed", offset: 88, windowScrollY: 300 });
  restoreGalleryAnchor(root, null);
  expect(scroll).not.toHaveBeenCalled();
});
