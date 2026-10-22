import { validImage } from "@/lib/submissions/validation";
import type { AnalysisAsset, AnalysisDetail, AnalysisHistory, ApiEnvelope, BilingualPrompt } from "@/types/prompt-analysis";

export const PROMPT_LIMITS = { zh: 6000, en: 12000 } as const;

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string) {
    super("The request could not be completed.");
    this.name = "ApiError";
  }
}

export function isAbortError(error: unknown) {
  return error !== null && typeof error === "object" && "name" in error && error.name === "AbortError";
}

export function asApiError(error: unknown) {
  return error instanceof ApiError ? error : new ApiError(0, "NETWORK_ERROR");
}

function safeCode(value: unknown, fallback: string) {
  return typeof value === "string" && /^[A-Z][A-Z0-9_]{1,63}$/.test(value) ? value : fallback;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      credentials: "same-origin", cache: "no-store", redirect: "error", referrerPolicy: "no-referrer",
      ...init, headers: new Headers(init.headers),
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new ApiError(0, "NETWORK_ERROR");
  }
  if (response.status === 204 && response.ok) return undefined as T;
  let envelope: ApiEnvelope<T> | null = null;
  try {
    envelope = await response.json();
  } catch {
    // Never expose an HTML error page or provider response in the editor.
  }
  if (!response.ok || envelope?.success === false) {
    throw new ApiError(response.status, safeCode(envelope?.error?.code, response.status === 401 ? "UNAUTHORIZED" : "REQUEST_FAILED"));
  }
  if (envelope?.success !== true || envelope.data == null) throw new ApiError(response.status, "INVALID_RESPONSE");
  return envelope.data;
}

const detailPath = (id: string) => `/api/prompt-analyses/${encodeURIComponent(id)}`;
const json = (value: unknown, signal?: AbortSignal): RequestInit => ({
  headers: { "Content-Type": "application/json" }, body: JSON.stringify(value), signal,
});

export const promptAnalysisClient = {
  async upload(file: File, signal?: AbortSignal): Promise<AnalysisAsset> {
    if (!validImage(file)) throw new ApiError(0, "INVALID_IMAGE");
    const body = new FormData();
    body.append("file", file);
    return request("/api/prompt-assets", { method: "POST", body, signal });
  },
  create(assetId: string, key: string, signal?: AbortSignal): Promise<AnalysisDetail> {
    return request("/api/prompt-analyses", {
      ...json({ asset_id: assetId }, signal), method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": key },
    });
  },
  detail(id: string, signal?: AbortSignal): Promise<AnalysisDetail> {
    return request(detailPath(id), { signal });
  },
  async update(id: string, revision: number, prompt: BilingualPrompt, signal?: AbortSignal): Promise<AnalysisDetail> {
    if (!(Object.keys(PROMPT_LIMITS) as (keyof BilingualPrompt)[]).every(language =>
      typeof prompt[language] === "string" && prompt[language].trim().length > 0 && Array.from(prompt[language]).length <= PROMPT_LIMITS[language])) {
      throw new ApiError(0, "INVALID_PROMPT");
    }
    return request(detailPath(id), { ...json({ revision, prompt }, signal), method: "PATCH" });
  },
  history(cursor?: string, signal?: AbortSignal): Promise<AnalysisHistory> {
    const query = new URLSearchParams({ limit: "20" });
    if (cursor) query.set("cursor", cursor);
    return request(`/api/prompt-analyses?${query}`, { signal });
  },
  remove(id: string, signal?: AbortSignal): Promise<void> {
    return request(detailPath(id), { method: "DELETE", signal });
  },
};

export type PromptAnalysisClient = typeof promptAnalysisClient;
