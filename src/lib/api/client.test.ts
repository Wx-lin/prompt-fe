import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PromptListItem, PromptListResponse } from "@/types/prompt";
import { getCategories, getModels, getPromptDetail, getPromptFeed, searchPrompts } from "./client";
import { fallbackCategories } from "@/features/gallery/data/categories";

vi.mock("server-only", () => ({}));

function prompt(index: number, overrides: Partial<PromptListItem> = {}): PromptListItem {
  return {
    id: String(index),
    title: `猫咪 ${index}`,
    category: "illustration",
    models: ["Midjourney"],
    thumbnail_url: null,
    like_count: index,
    view_count: index * 10,
    author_name: null,
    created_at: "2026-10-08T08:00:00Z",
    ...overrides,
  };
}

/** Mock the HTTP boundary with the backend's real pagination contract. */
function mockSearchApi(items: PromptListItem[]) {
  const fetchMock = vi.fn(async (url: string) => {
    const params = new URL(url).searchParams;
    const page = Number(params.get("page"));
    const pageSize = Number(params.get("page_size"));
    const body: PromptListResponse = {
      items: items.slice((page - 1) * pageSize, page * pageSize),
      total: items.length,
      page,
      page_size: pageSize,
      has_more: page * pageSize < items.length,
    };
    return Response.json(body);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("searchPrompts", () => {
  beforeEach(() => vi.stubEnv("API_BASE_URL", "http://api.test"));
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("uses one upstream request for ordinary latest search", async () => {
    const fetchMock = mockSearchApi(Array.from({ length: 51 }, (_, index) => prompt(index)));
    const result = await searchPrompts("猫咪");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ total: 51, page: 1, page_size: 20, has_more: true });
    expect(result.items).toHaveLength(20);
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get("q")).toBe("猫咪");
  });

  it("forwards pagination with no active category or model filter", async () => {
    const fetchMock = mockSearchApi(Array.from({ length: 25 }, (_, index) => prompt(index)));
    const result = await searchPrompts("猫咪", { category: "all", model: "all", sort: "latest", page: 2, pageSize: 10 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ total: 25, page: 2, page_size: 10, has_more: true });
    expect(result.items[0].id).toBe("10");
  });

  it.each(["popular", "hot"])("forwards %s search filters and pagination in one request", async (sort) => {
    const body = { items: [prompt(51, { models: ["FLUX.1"] })], total: 7, page: 2, page_size: 1, has_more: true };
    const fetchMock = vi.fn().mockResolvedValue(Response.json(body));
    vi.stubGlobal("fetch", fetchMock);
    expect(await searchPrompts("猫咪", { category: "portrait", model: "FLUX.1", sort, page: 2, pageSize: 1 })).toEqual(body);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(Object.fromEntries(new URL(fetchMock.mock.calls[0][0]).searchParams)).toEqual({
      q: "猫咪", category: "portrait", models: "FLUX.1", sort, page: "2", page_size: "1",
    });
  });

  it("propagates upstream failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    await expect(searchPrompts("猫咪", { sort: "popular" })).rejects.toThrow("API request failed (503)");
  });

  it("loads version-specific models from the shared catalog", async () => {
    const models = [{ key: "Midjourney V6", label: "Midjourney V6", group: "Midjourney" }];
    const fetchMock = vi.fn().mockResolvedValue(Response.json(models));
    vi.stubGlobal("fetch", fetchMock);
    expect(await getModels()).toEqual(models);
    expect(fetchMock.mock.calls[0][0]).toBe("http://api.test/api/models");
  });

});

describe("existing API request contracts", () => {
  beforeEach(() => vi.stubEnv("API_BASE_URL", "http://api.test/"));
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("keeps feed defaults and passes category, model, sort, and pagination to the backend", async () => {
    const fetchMock = mockSearchApi([]);
    await getPromptFeed();
    expect(fetchMock.mock.calls[0][0]).toBe("http://api.test/api/prompts?page=1&page_size=20&sort=recommended");
    await getPromptFeed({ category: "food", model: "FLUX.1", sort: "hot", page: 2, pageSize: 10 });
    const params = new URL(fetchMock.mock.calls[1][0]).searchParams;
    expect(Object.fromEntries(params)).toEqual({ category: "food", models: "FLUX.1", sort: "hot", page: "2", page_size: "10" });
    await getPromptFeed({ category: "all", model: "all" });
    expect(new URL(fetchMock.mock.calls[2][0]).searchParams.has("models")).toBe(false);
  });

  it("encodes detail IDs as a single URL segment", async () => {
    const fetchMock = mockSearchApi([]);
    await getPromptDetail("id/with space");
    expect(fetchMock.mock.calls[0][0]).toBe("http://api.test/api/prompts/id%2Fwith%20space");
  });

  it("returns categories from the API and preserves the offline fallback", async () => {
    const categories = [{ key: "food", label: "美食", count: 1 }];
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json(categories)).mockResolvedValueOnce(new Response(null, { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await getCategories()).toEqual(categories);
    expect(await getCategories()).toEqual(fallbackCategories);
  });
});

describe("upstream request deadline", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  it("bounds feed and detail requests with an abort signal", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const fetchMock = vi.fn(async (url: string, options: RequestInit) => {
      void url; void options;
      return Response.json({ items: [] });
    });
    vi.stubGlobal("fetch", fetchMock);
    await getPromptFeed();
    await getPromptDetail("example");
    expect(timeout).toHaveBeenNthCalledWith(1, 12000);
    expect(timeout).toHaveBeenNthCalledWith(2, 12000);
    for (const [, options] of fetchMock.mock.calls) {
      expect(options.signal).toBeInstanceOf(AbortSignal);
    }
  });
});

describe("getSimilarPrompts", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  it("requests encoded similar ID as a publicly cached request without auth", async () => {
    vi.stubEnv("API_BASE_URL", "http://api.test/");
    const fetcher = vi.fn().mockResolvedValue(Response.json([prompt(1)]));
    vi.stubGlobal("fetch", fetcher);
    const { getSimilarPrompts } = await import("./client");
    expect(await getSimilarPrompts("a/b ?")).toEqual([prompt(1)]);
    expect(fetcher).toHaveBeenCalledWith("http://api.test/api/prompts/a%2Fb%20%3F/similar", expect.objectContaining({ headers: { Accept: "application/json" }, next: { revalidate: 60 } }));
  });
});
