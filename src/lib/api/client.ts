import "server-only";
import type { Category, CurrentUser, PromptDetail, PromptListItem, PromptListResponse } from "@/types/prompt";
import { fallbackCategories } from "@/features/gallery/data/categories";

const defaultApiBaseUrl = "http://localhost:8000";

function getApiBaseUrl(): string {
  return (process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? defaultApiBaseUrl).replace(/\/$/, "");
}

async function request<T>(path: string, accessToken?: string, fresh = false): Promise<T> {
  const headers: HeadersInit = { Accept: "application/json" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    // Personalized data and publication-sensitive details must bypass persistent caches.
    ...(accessToken || fresh ? { cache: "no-store" } : { next: { revalidate: 60 } }),
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
  const params = new URLSearchParams({ page: String(query.page ?? 1), page_size: String(query.pageSize ?? 20), sort: query.sort ?? "recommended" });
  if (query.category && query.category !== "all") params.set("category", query.category);
  if (query.model && query.model !== "all") params.append("models", query.model);
  return request<PromptListResponse>(`/api/prompts?${params.toString()}`);
}

export async function searchPrompts(query: string, filters: PromptQuery = {}): Promise<PromptListResponse> {
  const params = new URLSearchParams({
    q: query,
    page: String(filters.page ?? 1),
    page_size: String(filters.pageSize ?? 20),
    sort: filters.sort ?? "latest",
  });
  if (filters.category && filters.category !== "all") params.set("category", filters.category);
  if (filters.model && filters.model !== "all") params.append("models", filters.model);
  return request<PromptListResponse>(`/api/prompts/search?${params.toString()}`);
}

export interface ModelOption {
  key: string;
  label: string;
  group: string;
}

export async function getModels(): Promise<ModelOption[]> {
  return request<ModelOption[]>("/api/models");
}

export async function getPromptDetail(id: string, accessToken?: string): Promise<PromptDetail> {
  return request<PromptDetail>(`/api/prompts/${encodeURIComponent(id)}`, accessToken, true);
}

export async function getSimilarPrompts(id: string): Promise<PromptListItem[]> {
  return request<PromptListItem[]>(`/api/prompts/${encodeURIComponent(id)}/similar`);
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
