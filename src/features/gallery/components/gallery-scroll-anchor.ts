export interface GalleryScrollAnchor {
  promptId: string;
  offset: number;
  windowScrollY: number;
}

function visibleArtwork(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>("article[data-prompt-id]"))
    .filter((card) => card.getClientRects().length > 0);
}

/** Use a work identity rather than a pixel count when masonry columns are redistributed. */
export function readGalleryAnchor(root: HTMLElement): GalleryScrollAnchor | null {
  for (const card of visibleArtwork(root)) {
    const bounds = card.getBoundingClientRect();
    if (bounds.bottom > 0 && bounds.top < window.innerHeight) {
      return { promptId: card.dataset.promptId!, offset: bounds.top, windowScrollY: window.scrollY };
    }
  }
  return null;
}

export function restoreGalleryAnchor(root: HTMLElement, anchor: GalleryScrollAnchor | null) {
  if (!anchor || anchor.windowScrollY === 0) return;
  const card = visibleArtwork(root).find((item) => item.dataset.promptId === anchor.promptId);
  if (!card) return;
  const delta = card.getBoundingClientRect().top - anchor.offset;
  if (Math.abs(delta) >= 1) window.scrollBy({ top: delta, behavior: "auto" });
}
