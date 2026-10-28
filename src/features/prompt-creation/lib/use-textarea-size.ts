"use client";

import { useLayoutEffect, type RefObject } from "react";

function fitTextarea(textarea: HTMLTextAreaElement) {
  const style = getComputedStyle(textarea);
  const minimum = Number.parseFloat(style.minHeight) || 56;
  const maximum = Math.max(minimum, Number.parseFloat(style.maxHeight) || 208);
  const previousHeight = textarea.getBoundingClientRect().height || minimum;
  const previousTransition = textarea.style.transition;
  // Measure natural content without animating the temporary measurement size.
  textarea.style.transition = "none";
  textarea.style.height = "auto";
  const contentHeight = textarea.scrollHeight;
  const height = Math.min(maximum, Math.max(minimum, contentHeight));
  textarea.style.height = `${previousHeight}px`;
  void textarea.offsetHeight;
  textarea.style.transition = previousTransition;
  textarea.style.height = `${height}px`;
  textarea.style.overflowY = contentHeight > maximum ? "auto" : "hidden";
}

/** Refit both typed content and the wrapping that changes when the sidebar opens. */
export function useTextareaSize(ref: RefObject<HTMLTextAreaElement | null>, value: string) {
  useLayoutEffect(() => { if (ref.current) fitTextarea(ref.current); }, [ref, value]);
  useLayoutEffect(() => {
    const textarea = ref.current;
    if (!textarea) return;
    if (typeof ResizeObserver === "undefined") {
      const resize = () => fitTextarea(textarea);
      window.addEventListener("resize", resize);
      return () => window.removeEventListener("resize", resize);
    }
    let width = -1;
    const observer = new ResizeObserver(entries => {
      const nextWidth = entries[0]?.contentRect.width;
      if (nextWidth !== undefined && nextWidth !== width) { width = nextWidth; fitTextarea(textarea); }
    });
    observer.observe(textarea);
    return () => observer.disconnect();
  }, [ref]);
}
