"use client";

import { useEffect } from "react";

let activeLocks = 0;
let previousLock: string | undefined;

/** Route overlays can overlap; only the last closing overlay releases the page. */
export function useScrollLock() {
  useEffect(() => {
    const root = document.documentElement;
    if (activeLocks === 0) {
      previousLock = root.dataset.scrollLocked;
      root.dataset.scrollLocked = "true";
    }
    activeLocks += 1;

    return () => {
      activeLocks -= 1;
      if (activeLocks !== 0) return;
      if (previousLock === undefined) delete root.dataset.scrollLocked;
      else root.dataset.scrollLocked = previousLock;
    };
  }, []);
}
