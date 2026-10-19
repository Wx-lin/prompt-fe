"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/** Best effort, first-party browser counts; no URL, identity or referrer payload. */
export function VisitTracker() {
  const pathname = usePathname();
  const pending = useRef(false);
  const previous = useRef<{ path: string; at: number; day: string } | null>(null);
  useEffect(() => {
    if (!pathname || /(?:^|\/)(?:api|admin)(?:\/|$)/.test(pathname)
      || /bot|crawler|spider|slurp|headless/i.test(navigator.userAgent)) return;
    const report = () => {
      if (pending.current || document.visibilityState === "hidden") return;
      const at = Date.now();
      const day = new Date(at + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const last = previous.current;
      if (last?.path === pathname && last.day === day && at - last.at < 30 * 60 * 1000) return;
      pending.current = true;
      previous.current = { path: pathname, at, day };
      void fetch("/api/analytics/visit", { method: "POST", credentials: "same-origin", cache: "no-store", keepalive: true, referrerPolicy: "no-referrer" }).catch(() => {}).finally(() => { pending.current = false; });
    };
    report();
    document.addEventListener("visibilitychange", report);
    window.addEventListener("pageshow", report);
    return () => {
      document.removeEventListener("visibilitychange", report);
      window.removeEventListener("pageshow", report);
    };
  }, [pathname]);
  return null;
}
