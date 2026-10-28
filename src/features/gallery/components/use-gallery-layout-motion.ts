"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { readGalleryAnchor, restoreGalleryAnchor, type GalleryScrollAnchor } from "./gallery-scroll-anchor";

const duration = 240;
const easing = "cubic-bezier(.2,.7,.2,1)";

/** Animate public geometry only; removed composer/chat children are never retained. */
export function useGalleryLayoutMotion(open: boolean, home: RefObject<HTMLDivElement | null>, gallery: RefObject<HTMLDivElement | null>) {
  const previous = useRef(open);
  const homeHeight = useRef(0);
  const anchor = useRef<GalleryScrollAnchor | null>(null);
  const moving = useRef(false);
  const cancel = useRef<() => void>(() => {});
  const finish = useRef<() => void>(() => {});

  useEffect(() => {
    let frame = 0;
    const remember = () => {
      frame = 0;
      if (!moving.current && gallery.current) anchor.current = readGalleryAnchor(gallery.current);
    };
    const schedule = () => { if (!frame && !moving.current) frame = requestAnimationFrame(remember); };
    const respectScroll = () => { if (moving.current) anchor.current = null; };
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const reduce = () => { if (media?.matches) finish.current(); };
    remember();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("wheel", respectScroll, { passive: true });
    window.addEventListener("touchstart", respectScroll, { passive: true });
    media?.addEventListener("change", reduce);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("wheel", respectScroll);
      window.removeEventListener("touchstart", respectScroll);
      media?.removeEventListener("change", reduce);
      cancelAnimationFrame(frame); cancel.current();
    };
  }, [gallery]);

  useLayoutEffect(() => {
    const element = home.current;
    if (!element) return;
    if (previous.current === open) {
      if (!open && !moving.current) homeHeight.current = element.scrollHeight;
      return;
    }
    previous.current = open;
    const startHeight = moving.current ? element.getBoundingClientRect().height : open ? homeHeight.current : 0;
    const targetHeight = open ? 0 : element.scrollHeight;
    cancel.current();
    moving.current = true;
    if (!open) homeHeight.current = targetHeight;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const animation = reduced ? undefined : element.animate?.([
      { height: `${startHeight}px`, opacity: open ? 1 : 0 },
      { height: `${targetHeight}px`, opacity: open ? 0 : 1 },
    ], { duration, easing });
    let timer = 0;
    let frame = 0;
    let canceled = false;
    cancel.current = () => {
      canceled = true; window.clearTimeout(timer); cancelAnimationFrame(frame); animation?.cancel();
    };
    finish.current = () => {
      if (canceled) return;
      cancel.current(); moving.current = false;
      if (gallery.current) {
        restoreGalleryAnchor(gallery.current, anchor.current);
        anchor.current = readGalleryAnchor(gallery.current);
      }
    };
    if (reduced) {
      finish.current();
      return;
    }
    timer = window.setTimeout(() => { frame = requestAnimationFrame(() => finish.current()); }, duration);
  });
}
