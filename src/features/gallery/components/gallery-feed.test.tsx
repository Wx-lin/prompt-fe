import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps, Ref } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { GalleryCard, PromptListResponse } from "@/types/prompt";
import { GalleryFeed } from "./gallery-feed";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string, values?: { count?: number; query?: string }) => key === "searchResultsCount" ? `count:${values?.count}` : key === "searchResultsHeading" ? `results:${values?.query}` : key }));
vi.mock("@/i18n/navigation", () => ({ Link: (props: ComponentProps<"a">) => <a {...props} /> }));
vi.mock("./gallery-grid", () => ({ GalleryGrid: ({ items, sentinelRef, loadingMore, endOfList, compact, emptyMessage, onUseReference, activeReferenceId }: {
  items: GalleryCard[]; sentinelRef?: Ref<HTMLDivElement>; loadingMore: boolean; endOfList: boolean; compact: boolean; emptyMessage?: string; onUseReference?: (prompt: GalleryCard) => void; activeReferenceId?: string;
}) => <div data-testid="feed-grid" data-compact={compact} data-reference={activeReferenceId}>
  {sentinelRef && <div ref={sentinelRef} />}{items.map(item => <span key={item.id}>{item.id}</span>)}
  {loadingMore && <span>pending</span>}{endOfList && <span>end</span>}{!items.length && <span>{emptyMessage}</span>}
  {onUseReference && <button onClick={() => onUseReference(items[0])}>use reference</button>}
</div> }));

let notify: () => void;
const items = [{ id: "first" } as GalleryCard];
const props = { items, activeCategory: "all", activeSort: "latest", activeModel: "all", hasMore: true };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
const feed = (id: string, hasMore = false) => ({ items: [{ id }], has_more: hasMore });
beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: IntersectionObserverCallback) { notify = () => callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver); }
    observe() {} disconnect() {}
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it("aborts old pagination when filters change even if the server items have the same reference", async () => {
  const body = deferred<PromptListResponse>();
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: () => body.promise });
  vi.stubGlobal("fetch", fetcher);
  const view = render(<GalleryFeed {...props} />);
  await act(async () => notify());
  const signal = fetcher.mock.calls[0][1].signal as AbortSignal;
  view.rerender(<GalleryFeed {...props} activeCategory="avatar" />);
  expect(signal.aborted).toBe(true);
  await act(async () => body.resolve(feed("stale") as PromptListResponse));
  expect(screen.queryByText("stale")).not.toBeInTheDocument();
  expect(screen.getByText("first")).toBeInTheDocument();
  expect(screen.queryByText("pending")).not.toBeInTheDocument();
});

it("aborts and replaces a same-filter server snapshot before its old body can arrive", async () => {
  const body = deferred<PromptListResponse>();
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: () => body.promise });
  vi.stubGlobal("fetch", fetcher);
  const view = render(<GalleryFeed {...props} />);
  await act(async () => notify());
  const signal = fetcher.mock.calls[0][1].signal as AbortSignal;
  view.rerender(<GalleryFeed {...props} items={[{ id: "fresh" } as GalleryCard]} />);
  expect(signal.aborted).toBe(true);
  await act(async () => body.resolve(feed("stale") as PromptListResponse));
  expect(screen.queryByText("stale")).not.toBeInTheDocument();
  expect(screen.queryByText("first")).not.toBeInTheDocument();
  expect(screen.getByText("fresh")).toBeInTheDocument();
});

it("keeps already-loaded pages and the next page number while the chat compacts the gallery", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json(feed("second", true))).mockResolvedValueOnce(Response.json(feed("third")));
  vi.stubGlobal("fetch", fetcher);
  const select = vi.fn();
  const view = render(<GalleryFeed {...props} onUseReference={select} activeReferenceId="first" />);
  const grid = screen.getByTestId("feed-grid");
  await act(async () => notify());
  expect(screen.getByText("second")).toBeInTheDocument();
  view.rerender(<GalleryFeed {...props} compact onUseReference={select} activeReferenceId="first" />);
  expect(screen.getByTestId("feed-grid")).toBe(grid);
  expect(grid).toHaveAttribute("data-compact", "true");
  expect(grid).toHaveAttribute("data-reference", "first");
  expect(screen.getByText("second")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "use reference" }));
  expect(select).toHaveBeenCalledWith(items[0]);
  await act(async () => notify());
  expect(fetcher.mock.calls[1][0]).toContain("page=3");
  expect(screen.getByText("third")).toBeInTheDocument();
  expect(screen.getByText("end")).toBeInTheDocument();
});

it.each(["recommended", "latest", "popular", "hot"])("keeps %s ordering, filters and search summary through pagination", async sort => {
  const fetcher = vi.fn().mockResolvedValue(Response.json(feed("second")));
  vi.stubGlobal("fetch", fetcher);
  render(<GalleryFeed {...props} activeCategory="portrait" activeModel="FLUX" activeSort={sort} query=" cat " />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("results:cat");
  expect(screen.getByText("count:1")).toBeInTheDocument();
  expect(new URL(screen.getByRole("link", { name: "nextPageLink" }).getAttribute("href")!, "http://test").searchParams.get("sort")).toBe(sort);
  await act(async () => notify());
  expect(Object.fromEntries(new URL(fetcher.mock.calls[0][0], "http://test").searchParams)).toEqual({ category: "portrait", models: "FLUX", sort, page: "2", q: "cat" });
  expect(screen.getByText("count:2")).toBeInTheDocument();
  const cleared = new URL(screen.getByRole("link", { name: "clearSearchAriaLabel" }).getAttribute("href")!, "http://test");
  expect(Object.fromEntries(cleared.searchParams)).toEqual({ category: "portrait", models: "FLUX", ...(sort === "recommended" ? {} : { sort }) });
});

it("retries the same page after an error without describing the feed as finished", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(null, { status: 502 })).mockResolvedValueOnce(Response.json(feed("second")));
  vi.stubGlobal("fetch", fetcher);
  render(<GalleryFeed {...props} />);
  await act(async () => notify());
  expect(screen.getByRole("alert")).toHaveTextContent("loadMoreError");
  expect(screen.queryByText("end")).not.toBeInTheDocument();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "retryLoadMore" })));
  expect(fetcher.mock.calls[1][0]).toContain("page=2");
  expect(screen.getByText("second")).toBeInTheDocument();
});

it("times out stalled pagination, clears pending state and allows explicit retry", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", (_url: string, options: RequestInit) => new Promise((_resolve, reject) => options.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))));
  render(<GalleryFeed {...props} />);
  await act(async () => { notify(); notify(); });
  expect(screen.getByText("pending")).toBeInTheDocument();
  await act(async () => vi.advanceTimersByTimeAsync(15000));
  expect(screen.queryByText("pending")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "retryLoadMore" })).toBeInTheDocument();
});

it("keeps clearing links and empty/error states without taking over non-search SEO headings", () => {
  const empty: GalleryCard[] = [];
  const view = render(<GalleryFeed {...props} items={empty} hasMore={false} query="cat" activeCategory="portrait" />);
  expect(screen.getByRole("link", { name: "clearFilters" })).toHaveAttribute("href", "/?q=cat");
  expect(screen.getByText("searchEmpty")).toBeInTheDocument();
  view.rerender(<GalleryFeed {...props} items={empty} hasMore={false} loadError />);
  expect(screen.getByText("loadError")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "clearFilters" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
});

it("renders category next-page anchors without redundant category parameters", () => {
  render(<GalleryFeed {...props} activeCategory="avatar" landingCategory="avatar" nextPage={4} query="cat" />);
  expect(screen.getByRole("link", { name: "nextPageLink" })).toHaveAttribute("href", "/category/avatar?sort=latest&q=cat&page=4");
});
