import "server-only";
import type { Category, CurrentUser, PromptDetail, PromptListResponse } from "@/types/prompt";
import { fallbackCategories } from "@/features/gallery/data/categories";
import { sortGalleryItems } from "@/features/gallery/lib/sort-items";

const defaultApiBaseUrl = "http://localhost:8000";

function getApiBaseUrl(): string {
  return (process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? defaultApiBaseUrl).replace(/\/$/, "");
}

async function request<T>(path: string, accessToken?: string): Promise<T> {
  const headers: HeadersInit = { Accept: "application/json" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    // Personalized (token-bearing) requests must never be cached/shared across users.
    ...(accessToken ? { cache: "no-store" } : { next: { revalidate: 60 } }),
    headers,
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    throw new Error(`API request failed (${response.status}) for ${path}`);
  }

  return (await response.json()) as T;
}

export interface PromptQuery {
  category?: string;
  sort?: string;
  model?: string;
  page?: number;
  pageSize?: number;
}

export async function getPromptFeed(query: PromptQuery = {}): Promise<PromptListResponse> {
  const params = new URLSearchParams({ page: String(query.page ?? 1), page_size: String(query.pageSize ?? 20), sort: query.sort ?? "latest" });
  if (query.category && query.category !== "all") params.set("category", query.category);
  if (query.model && query.model !== "all") params.append("models", query.model);
  return request<PromptListResponse>(`/api/prompts?${params.toString()}`);
}

function requestSearchPage(query: string, page: number, pageSize: number): Promise<PromptListResponse> {
  const params = new URLSearchParams({ q: query, page: String(page), page_size: String(pageSize) });
  return request<PromptListResponse>(`/api/prompts/search?${params.toString()}`);
}

export async function searchPrompts(query: string, filters: PromptQuery = {}): Promise<PromptListResponse> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const category = filters.category === "all" ? undefined : filters.category;
  const model = filters.model === "all" ? undefined : filters.model;
  const sort = filters.sort ?? "latest";
  if (!category && !model && sort !== "popular" && sort !== "hot") {
    return requestSearchPage(query, page, pageSize);
  }

  // Temporary server adapter: replace with native backend search filters/sort later.
  // Filtering one upstream page would incorrectly hide matches on later pages.
  let response = await requestSearchPage(query, 1, 50);
  let allItems = response.items;
  for (let nextPage = 2; response.has_more; nextPage += 1) {
    response = await requestSearchPage(query, nextPage, 50);
    allItems = [...allItems, ...response.items];
  }

  const matchingItems = allItems.filter((item) =>
    (!category || item.category === category) && (!model || item.models.includes(model)),
  );
  const sortedItems = sortGalleryItems(matchingItems, sort);
  return {
    items: sortedItems.slice((page - 1) * pageSize, page * pageSize),
    total: sortedItems.length,
    page,
    page_size: pageSize,
    has_more: page * pageSize < sortedItems.length,
  };
}

export async function getPromptDetail(id: string, accessToken?: string): Promise<PromptDetail> {
  return request<PromptDetail>(`/api/prompts/${encodeURIComponent(id)}`, accessToken);
}

export async function getCategories(): Promise<Category[]> {
  try {
    return await request<Category[]>("/api/categories");
  } catch {
    return fallbackCategories;
  }
}

export async function getCurrentUser(accessToken: string): Promise<CurrentUser | null> {
  try {
    return await request<CurrentUser>("/api/auth/me", accessToken);
  } catch {
    return null;
  }
}

export async function getMyCollects(accessToken: string, query: { page?: number; pageSize?: number } = {}): Promise<PromptListResponse> {
  const params = new URLSearchParams({ page: String(query.page ?? 1), page_size: String(query.pageSize ?? 20) });
  return request<PromptListResponse>(`/api/users/me/collects?${params.toString()}`, accessToken);
}
