import { ApiError, isAbortError, promptAnalysisClient } from "@/features/image-to-prompt/lib/client";
import type { AnalysisAsset, ApiEnvelope } from "@/types/prompt-analysis";
import type { ConversationTurn, CreateConversationInput, PromptConversationDetail, PromptConversationHistory, SendConversationInput } from "@/types/prompt-conversation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validId = (id: unknown): id is string => typeof id === "string" && UUID.test(id);
function requireId(id: string) {
  if (!validId(id)) throw new ApiError(0, "INVALID_REQUEST");
  return id;
}
function inputBody(input: CreateConversationInput): CreateConversationInput {
  const message = typeof input.message === "string" ? input.message.trim() : undefined;
  if ((input.message !== undefined && (typeof input.message !== "string" || !message || Array.from(message).length > 500)) ||
    (input.mode !== undefined && input.mode !== "auto" && input.mode !== "generate") ||
    (input.asset_id !== undefined && !validId(input.asset_id)) || (!message && !input.asset_id)) {
    throw new ApiError(0, "INVALID_REQUEST");
  }
  return { ...(message ? { message } : {}), ...(input.asset_id ? { asset_id: input.asset_id } : {}), ...(input.mode ? { mode: input.mode } : {}) };
}
function keyed(key: string) {
  if (!validId(key)) throw new ApiError(0, "INVALID_IDEMPOTENCY_KEY");
  return { "Content-Type": "application/json", "Idempotency-Key": key };
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
  let body: ApiEnvelope<T> | null = null;
  try { body = await response.json(); } catch { /* Never display upstream HTML or provider bodies. */ }
  if (!response.ok || body?.success === false) {
    const code = body?.error?.code;
    throw new ApiError(response.status, typeof code === "string" && /^[A-Z][A-Z0-9_]{1,63}$/.test(code) ? code : response.status === 401 ? "UNAUTHORIZED" : "REQUEST_FAILED");
  }
  if (body?.success !== true || body.data == null) throw new ApiError(response.status, "INVALID_RESPONSE");
  return body.data;
}

const path = (id: string) => `/api/prompt-conversations/${requireId(id)}`;
const json = (body: unknown, signal?: AbortSignal): RequestInit => ({ method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" }, signal });

export const promptConversationClient = {
  async create(input: CreateConversationInput, key: string, signal?: AbortSignal): Promise<ConversationTurn> {
    return request("/api/prompt-conversations", { ...json(inputBody(input), signal), headers: keyed(key) });
  },
  async send(id: string, input: SendConversationInput, key: string, signal?: AbortSignal): Promise<ConversationTurn> {
    requireId(input.parent_analysis_id);
    if (!Number.isSafeInteger(input.parent_revision) || input.parent_revision < 0) throw new ApiError(0, "INVALID_REQUEST");
    return request(`${path(id)}/messages`, { ...json({ ...inputBody(input), parent_analysis_id: input.parent_analysis_id, parent_revision: input.parent_revision }, signal), headers: keyed(key) });
  },
  async retry(id: string, analysisId: string, key: string, signal?: AbortSignal): Promise<ConversationTurn> {
    return request(`${path(id)}/retry`, { ...json({ analysis_id: requireId(analysisId) }, signal), headers: keyed(key) });
  },
  async detail(id: string, signal?: AbortSignal): Promise<PromptConversationDetail> {
    return request(path(id), { signal });
  },
  history(cursor?: string, signal?: AbortSignal): Promise<PromptConversationHistory> {
    const query = new URLSearchParams({ limit: "20" });
    if (cursor) query.set("cursor", cursor);
    return request(`/api/prompt-conversations?${query}`, { signal });
  },
  async remove(id: string, signal?: AbortSignal): Promise<void> {
    return request(path(id), { method: "DELETE", signal });
  },
  upload: promptAnalysisClient.upload,
  async importReference(promptId: string, signal?: AbortSignal): Promise<AnalysisAsset> {
    return request("/api/prompt-assets/from-prompt", json({ prompt_id: requireId(promptId) }, signal));
  },
};

export type PromptConversationClient = typeof promptConversationClient;
