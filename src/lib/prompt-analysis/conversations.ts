import "server-only";
import { promptAnalysisProxy as proxy } from "./proxy";
import type { ConversationTurn, CreateConversationInput, PromptConversationDetail, PromptConversationHistory, PromptConversationSummary } from "@/types/prompt-conversation";

type Context = { params: Promise<{ id: string }> };
type RecordValue = Record<string, unknown>;
const STATUSES = ["queued", "running", "succeeded", "failed", "unknown", "canceled"];
// At most 100 turns; generated and edited bilingual prompts are both returned.
// Only this private full-history response exceeds the ordinary 1MiB limit.
const MAX_CONVERSATION_RESPONSE = 32 * 1024 * 1024;

function responseFields(data: RecordValue): Pick<ConversationTurn, "response_type" | "assistant_reply" | "prompt_number"> | null {
  const keys = ["response_type", "assistant_reply", "prompt_number"];
  if (!keys.some(key => Object.hasOwn(data, key))) return {};
  if (!keys.every(key => Object.hasOwn(data, key))) return null;
  if (data.response_type === "assistant") {
    if (data.status !== "succeeded" || !proxy.text(data.assistant_reply, 4000) || data.result !== null || data.prompt !== null || data.revision !== 0 || data.saved_to_history !== true || data.prompt_number !== null) return null;
    return { response_type: "assistant", assistant_reply: data.assistant_reply, prompt_number: null };
  }
  if (data.response_type === "prompt") {
    if (data.status !== "succeeded" || data.assistant_reply !== null || !proxy.integer(data.prompt_number, 1) || data.result == null || data.prompt == null) return null;
    return { response_type: "prompt", assistant_reply: null, prompt_number: data.prompt_number };
  }
  if (data.response_type !== null || data.status === "succeeded" || data.assistant_reply !== null || data.prompt_number !== null || data.result !== null || data.prompt !== null) return null;
  return { response_type: null, assistant_reply: null, prompt_number: null };
}

function turn(value: unknown): ConversationTurn | null {
  const data = proxy.record(value);
  const response = data && responseFields(data);
  if (!response) return null;
  const result = proxy.detail(value);
  return result?.conversation_id && result.version && typeof result.user_message === "string" && result.parent_analysis_id !== undefined ? { ...result, ...response } as ConversationTurn : null;
}

function conversation(value: unknown): PromptConversationDetail | null {
  const data = proxy.record(value);
  if (!data || !proxy.uuid(data.id) || !proxy.text(data.title, 80) || !proxy.date(data.created_at) || !proxy.date(data.updated_at) || !Array.isArray(data.turns) || data.turns.length > 100) return null;
  const turns = data.turns.map(turn);
  if (turns.some(item => item === null || item.conversation_id !== data.id)) return null;
  return { id: data.id, title: data.title, created_at: data.created_at, updated_at: data.updated_at, turns: turns as ConversationTurn[] };
}

function summary(value: unknown): PromptConversationSummary | null {
  const data = proxy.record(value);
  if (!data || !proxy.uuid(data.id) || !proxy.text(data.title, 80) || !STATUSES.includes(data.status as string) || !proxy.date(data.created_at) || !proxy.date(data.updated_at) || !proxy.uuid(data.latest_analysis_id) || !proxy.integer(data.version, 1)) return null;
  return { id: data.id, title: data.title, status: data.status as PromptConversationSummary["status"], created_at: data.created_at, updated_at: data.updated_at, latest_analysis_id: data.latest_analysis_id, version: data.version };
}

function history(value: unknown): PromptConversationHistory | null {
  const data = proxy.record(value), pagination = proxy.record(data?.pagination);
  if (!data || !pagination || !Array.isArray(data.items) || !proxy.integer(pagination.limit, 1) || pagination.limit > 50 || data.items.length > pagination.limit || typeof pagination.has_more !== "boolean" || !(pagination.next_cursor === null || proxy.text(pagination.next_cursor, 512)) || (pagination.has_more && pagination.next_cursor === null)) return null;
  const items = data.items.map(summary);
  if (items.some(item => item === null)) return null;
  return { items: items as PromptConversationSummary[], pagination: { limit: pagination.limit, has_more: pagination.has_more, next_cursor: pagination.next_cursor } };
}

function input(data: RecordValue, followup: boolean): CreateConversationInput | null {
  const allowed = followup ? ["message", "asset_id", "mode", "parent_analysis_id", "parent_revision"] : ["message", "asset_id", "mode"];
  if (Object.keys(data).some(key => !allowed.includes(key))) return null;
  const message = typeof data.message === "string" ? data.message.trim() : undefined;
  if ((Object.hasOwn(data, "message") && (!message || !proxy.text(message, 500))) || (Object.hasOwn(data, "asset_id") && !proxy.uuid(data.asset_id)) || (Object.hasOwn(data, "mode") && data.mode !== "auto" && data.mode !== "generate") || (!message && !data.asset_id)) return null;
  return { ...(message ? { message } : {}), ...(proxy.uuid(data.asset_id) ? { asset_id: data.asset_id } : {}), ...(data.mode === "auto" || data.mode === "generate" ? { mode: data.mode } : {}) };
}

export async function createConversation(request: Request) {
  const token = await proxy.session(request, true);
  if (token instanceof Response) return token;
  const key = request.headers.get("idempotency-key");
  if (!proxy.uuid(key)) return proxy.failure(422, "INVALID_IDEMPOTENCY_KEY");
  const body = await proxy.jsonBody(request);
  if (body instanceof Response) return body;
  const normalized = input(body, false);
  if (!normalized) return proxy.failure(422);
  return proxy.forward("prompt-conversations", token, "POST", turn, [200, 202], JSON.stringify(normalized), key);
}

export async function sendConversationMessage(request: Request, context: Context) {
  const token = await proxy.session(request, true);
  if (token instanceof Response) return token;
  const { id } = await context.params;
  if (!proxy.uuid(id)) return proxy.failure(422);
  const key = request.headers.get("idempotency-key");
  if (!proxy.uuid(key)) return proxy.failure(422, "INVALID_IDEMPOTENCY_KEY");
  const body = await proxy.jsonBody(request);
  if (body instanceof Response) return body;
  const normalized = input(body, true);
  if (!normalized || !proxy.uuid(body.parent_analysis_id) || !proxy.integer(body.parent_revision)) return proxy.failure(422);
  return proxy.forward(`prompt-conversations/${id}/messages`, token, "POST", turn, [200, 202], JSON.stringify({ ...normalized, parent_analysis_id: body.parent_analysis_id, parent_revision: body.parent_revision }), key);
}

export async function retryConversationTurn(request: Request, context: Context) {
  const token = await proxy.session(request, true);
  if (token instanceof Response) return token;
  const { id } = await context.params;
  if (!proxy.uuid(id)) return proxy.failure(422);
  const key = request.headers.get("idempotency-key");
  if (!proxy.uuid(key)) return proxy.failure(422, "INVALID_IDEMPOTENCY_KEY");
  const body = await proxy.jsonBody(request);
  if (body instanceof Response) return body;
  if (!proxy.exact(body, ["analysis_id"]) || !proxy.uuid(body.analysis_id)) return proxy.failure(422);
  return proxy.forward(`prompt-conversations/${id}/retry`, token, "POST", turn, [200, 202], JSON.stringify({ analysis_id: body.analysis_id }), key);
}

export async function getConversation(request: Request, context: Context) {
  const token = await proxy.session(request);
  if (token instanceof Response) return token;
  const { id } = await context.params;
  return proxy.uuid(id) ? proxy.forward(`prompt-conversations/${id}`, token, "GET", conversation, [200], undefined, undefined, MAX_CONVERSATION_RESPONSE) : proxy.failure(422);
}

export async function listConversations(request: Request) {
  const token = await proxy.session(request);
  if (token instanceof Response) return token;
  const query = new URL(request.url).searchParams, limit = query.get("limit") ?? "20", cursor = query.get("cursor");
  if (query.getAll("limit").length > 1 || query.getAll("cursor").length > 1 || !/^(?:[1-9]|[1-4][0-9]|50)$/.test(limit) || (cursor !== null && cursor.length > 512)) return proxy.failure(422);
  const outgoing = new URLSearchParams({ limit });
  if (cursor !== null) outgoing.set("cursor", cursor);
  return proxy.forward(`prompt-conversations?${outgoing}`, token, "GET", history);
}

export async function deleteConversation(request: Request, context: Context) {
  const token = await proxy.session(request, true);
  if (token instanceof Response) return token;
  const { id } = await context.params;
  return proxy.uuid(id) ? proxy.forward(`prompt-conversations/${id}`, token, "DELETE", () => null, []) : proxy.failure(422);
}

export async function importPromptReference(request: Request) {
  const token = await proxy.session(request, true);
  if (token instanceof Response) return token;
  const body = await proxy.jsonBody(request);
  if (body instanceof Response) return body;
  if (!proxy.exact(body, ["prompt_id"]) || !proxy.uuid(body.prompt_id)) return proxy.failure(422);
  return proxy.forward("prompt-assets/from-prompt", token, "POST", proxy.asset, [201], JSON.stringify({ prompt_id: body.prompt_id }));
}
