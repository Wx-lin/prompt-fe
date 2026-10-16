import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ComponentProps, Ref } from "react";
import type { GalleryCard } from "@/types/prompt";
import { GalleryPage } from "./gallery-page";
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("./site-header", () => ({ SiteHeader: () => null }));
vi.mock("@/i18n/navigation", () => ({ Link: (props: ComponentProps<"a">) => <a {...props} /> }));
vi.mock("./gallery-grid", () => ({ GalleryGrid: ({ items, sentinelRef, loadingMore, endOfList }: { items: GalleryCard[]; sentinelRef: Ref<HTMLDivElement>; loadingMore: boolean; endOfList: boolean }) => <div><div ref={sentinelRef} />{items.map(item => <span key={item.id}>{item.id}</span>)}{loadingMore && <span>pending</span>}{endOfList && <span>end</span>}</div> }));
let notify: () => void;
const props = { items: [{ id: "first" } as GalleryCard], categories: [], activeCategory: "all", activeSort: "latest", activeModel: "all", models: [], hasMore: true };
beforeEach(() => { vi.stubGlobal("IntersectionObserver", class { constructor(callback: (entries: unknown[]) => void) { notify = () => callback([{ isIntersecting: true }]); } observe() {} disconnect() {} }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });
it("allows retry of the same page after failure without claiming the list ended", async () => {
 const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 502 })).mockResolvedValueOnce(Response.json({ items: [{ id: "next" }], has_more: false })); vi.stubGlobal("fetch", fetchMock);
 render(<GalleryPage {...props} />); await act(async () => notify());
 expect(screen.queryByText("end")).not.toBeInTheDocument();
 await act(async () => fireEvent.click(screen.getByRole("button", { name: "retryLoadMore" })));
 expect(screen.getByText("next")).toBeInTheDocument(); expect(fetchMock.mock.calls[1][0]).toContain("page=2");
});
it("times out a stalled request and releases loading state", async () => {
 vi.useFakeTimers(); vi.stubGlobal("fetch", (_url: string, options: RequestInit) => new Promise((_resolve, reject) => options.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))));
 render(<GalleryPage {...props} />); await act(async () => notify());
 expect(screen.getByText("pending")).toBeInTheDocument();
 await act(async () => vi.advanceTimersByTimeAsync(15000));
 expect(screen.queryByText("pending")).not.toBeInTheDocument(); expect(screen.getByRole("button", { name: "retryLoadMore" })).toBeInTheDocument();
});
it("ignores a stale response after changing filters", async () => {
 let resolve!: (value: Response) => void; vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(done => { resolve = done; })));
 const view = render(<GalleryPage {...props} />); await act(async () => notify());
 view.rerender(<GalleryPage {...props} activeCategory="art" items={[{ id: "new" } as GalleryCard]} />);
 await act(async () => resolve(Response.json({ items: [{ id: "stale" }], has_more: false })));
 expect(screen.queryByText("stale")).not.toBeInTheDocument(); expect(screen.getByText("new")).toBeInTheDocument();
});

it("starts only one request for repeated intersection notifications", async () => {
 const fetchMock = vi.fn(() => new Promise<Response>(() => {})); vi.stubGlobal("fetch", fetchMock);
 render(<GalleryPage {...props} />); await act(async () => { notify(); notify(); });
 expect(fetchMock).toHaveBeenCalledTimes(1);
});

it.each(["recommended", "latest", "popular", "hot"])("preserves %s ordering and every filter during search pagination and clearing search", async sort => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ items: [], has_more: false }));
  vi.stubGlobal("fetch", fetcher);
  render(<GalleryPage {...props} query="cat" activeSort={sort} activeCategory="portrait" activeModel="FLUX" />);
  await act(async () => notify());
  const url = new URL(fetcher.mock.calls[0][0], "http://test");
  expect(Object.fromEntries(url.searchParams)).toEqual({ category: "portrait", models: "FLUX", sort, page: "2", q: "cat" });
  const cleared = new URL(screen.getByRole("link", { name: "clearSearchAriaLabel" }).getAttribute("href")!, "http://test");
  expect(cleared.searchParams.get("sort")).toBe(sort === "recommended" ? null : sort);
  expect(cleared.searchParams.get("category")).toBe("portrait");
  expect(cleared.searchParams.get("models")).toBe("FLUX");
  expect(cleared.searchParams.has("q")).toBe(false);
});

it.each(["photography", "image_edit", "workflow"])("explains legacy %s links while retaining their pagination filter", async category => {
 const fetcher = vi.fn().mockResolvedValue(Response.json({items: [], has_more: false}));
 vi.stubGlobal("fetch", fetcher);
 render(<GalleryPage {...props} activeCategory={category} query="cat" activeModel="FLUX" activeSort="hot" />);
 expect(screen.getByRole("status")).toHaveTextContent("categoryAdjusted");
 await act(async () => notify());
 expect(new URL(fetcher.mock.calls[0][0], "http://test").searchParams.get("category")).toBe(category);
});
it("offers clearing combined filters on an empty category search without losing the keyword", () => {
 render(<GalleryPage {...props} items={[]} hasMore={false} query="cat" activeCategory="portrait" activeModel="FLUX" activeSort="hot" />);
 expect(screen.getByRole("link", {name:"clearFilters"})).toHaveAttribute("href", "/?q=cat");
});
it("renders crawlable next-page links while retaining infinite scrolling", () => {
 render(<GalleryPage {...props} nextPage={4} />);
 expect(screen.getByRole("link", {name: "nextPageLink"})).toHaveAttribute("href", "/?sort=latest&page=4");
 expect(screen.getByRole("heading", {level: 1})).toHaveTextContent("seoHeading");
});
it("links populated categories and paginates within a category landing", () => {
 render(<GalleryPage {...props} activeCategory="avatar" landingCategory="avatar" categories={[{key:"avatar",label:"头像",count:2},{key:"poster",label:"海报",count:0}]} />);
 expect(screen.getByRole("link", {name:"avatar"})).toHaveAttribute("href", "/category/avatar");
 expect(screen.queryByRole("link", {name:"poster"})).not.toBeInTheDocument();
 expect(screen.getByRole("link", {name:"nextPageLink"})).toHaveAttribute("href", "/category/avatar?sort=latest&page=2");
});
