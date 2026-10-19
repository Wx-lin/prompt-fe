import { StrictMode } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { VisitTracker } from "./visit-tracker";
let pathname = "/zh";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); pathname = "/zh"; });
it("reports invisibly once during StrictMode effects and on route entry, without private payload", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response()); vi.stubGlobal("fetch", fetcher);
  const view = render(<StrictMode><VisitTracker /></StrictMode>);
  expect(view.container).toBeEmptyDOMElement(); expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher).toHaveBeenCalledWith("/api/analytics/visit", { method: "POST", credentials: "same-origin", cache: "no-store", keepalive: true, referrerPolicy: "no-referrer" });
  await act(async () => {});
  pathname = "/zh/prompt/a"; view.rerender(<StrictMode><VisitTracker /></StrictMode>); expect(fetcher).toHaveBeenCalledTimes(2);
});
it("recovers on visibility/BFCache and removes listeners on unmount, swallowing failures", async () => {
  const fetcher = vi.fn().mockRejectedValue(new Error("offline")); vi.stubGlobal("fetch", fetcher);
  const view = render(<VisitTracker />);
  await act(async () => { document.dispatchEvent(new Event("visibilitychange")); window.dispatchEvent(new Event("pageshow")); });
  expect(fetcher).toHaveBeenCalledTimes(1);
  vi.spyOn(Date, "now").mockReturnValue(Date.now() + 31 * 60 * 1000);
  await act(async () => { document.dispatchEvent(new Event("visibilitychange")); }); expect(fetcher).toHaveBeenCalledTimes(2);
  view.unmount(); window.dispatchEvent(new Event("pageshow")); expect(fetcher).toHaveBeenCalledTimes(2);
});
it("skips admin, API and common crawler sessions", () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  pathname = "/api/admin"; const view = render(<VisitTracker />); pathname = "/zh/admin"; view.rerender(<VisitTracker />);
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Googlebot"); pathname = "/zh"; view.rerender(<VisitTracker />);
  expect(fetcher).not.toHaveBeenCalled();
});

it("reports again after Beijing midnight even inside the throttle window", async () => {
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-19T15:59:00Z"));
  const fetcher = vi.fn().mockResolvedValue(new Response()); vi.stubGlobal("fetch", fetcher);
  render(<VisitTracker />);
  await act(async () => {});
  vi.mocked(Date.now).mockReturnValue(Date.parse("2026-10-19T16:01:00Z"));
  await act(async () => { window.dispatchEvent(new Event("pageshow")); });
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("suppresses overlapping route reports until the first cookie response completes", async () => {
  let finish!: () => void;
  const fetcher = vi.fn().mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
  vi.stubGlobal("fetch", fetcher);
  const view = render(<VisitTracker />);
  pathname = "/en"; view.rerender(<VisitTracker />);
  expect(fetcher).toHaveBeenCalledTimes(1);
  await act(async () => { finish(); });
  window.dispatchEvent(new Event("pageshow"));
  expect(fetcher).toHaveBeenCalledTimes(2);
});
