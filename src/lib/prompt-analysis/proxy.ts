import "server-only";
import { authorize, boundedBody } from "@/lib/submissions/proxy";
import type { AnalysisAsset, AnalysisDetail, AnalysisHistory, AnalysisResult, AnalysisStatus, AnalysisSummary, BilingualPrompt } from "@/types/prompt-analysis";

type Context = { params: Promise<{ id: string }> };
type Parser<T> = (value: unknown) => T | null;
type RecordValue = Record<string, unknown>;
const PRIVATE = { "Cache-Control": "private, no-store" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IMAGE = 5 * 1024 * 1024;
const MAX_JSON = 128 * 1024;
const MAX_RESPONSE = 1024 * 1024;
const STATUSES: AnalysisStatus[] = ["queued", "running", "succeeded", "failed", "unknown", "canceled"];
const JOB_ERRORS = new Set([
  "queue_expired", "image_unavailable", "configuration_changed", "execution_timeout", "worker_lost",
  "dispatch_fenced", "provider_timeout", "image_timeout", "worker_error", "model_not_configured",
  "model_refused", "model_invalid_output", "model_invalid_input", "model_timeout", "model_connection_error", "model_upstream_error",
]);
const ERRORS: Record<string, { status: number; message: string }> = {
  INVALID_REQUEST: { status: 422, message: "请求参数不合法" },
  INVALID_IDEMPOTENCY_KEY: { status: 422, message: "请提供有效的请求标识" },
  UNAUTHENTICATED: { status: 401, message: "请先登录" },
  FORBIDDEN: { status: 403, message: "当前操作不可用" },
  NOT_FOUND: { status: 404, message: "记录不存在或已过期" },
  PAYLOAD_TOO_LARGE: { status: 413, message: "请求内容过大，图片不能超过 5 MiB" },
  UNSUPPORTED_IMAGE: { status: 415, message: "请上传 JPEG、PNG 或 WebP 图片" },
  UNSUPPORTED_MEDIA_TYPE: { status: 415, message: "请求内容格式不支持" },
  INVALID_IMAGE: { status: 422, message: "图片无法读取或尺寸不符合要求" },
  INVALID_CURSOR: { status: 422, message: "分页标识无效" },
  IDEMPOTENCY_CONFLICT: { status: 409, message: "请为新的解析请求使用新的请求标识" },
  ANALYSIS_IN_PROGRESS: { status: 409, message: "已有任务正在解析，请稍后再试" },
  NOT_EDITABLE: { status: 409, message: "解析完成后才能编辑" },
  REVISION_CONFLICT: { status: 409, message: "记录已更新，请重新打开后编辑" },
  QUOTA_EXCEEDED: { status: 429, message: "今日解析次数已用完" },
  RATE_LIMITED: { status: 429, message: "操作太频繁，请稍后重试" },
  FEATURE_UNAVAILABLE: { status: 503, message: "图片转提示词暂未开放" },
  MODEL_UNAVAILABLE: { status: 503, message: "图片解析暂不可用，请稍后再试" },
  QUEUE_FULL: { status: 503, message: "当前解析任务较多，请稍后重试" },
  STORAGE_UNAVAILABLE: { status: 503, message: "图片存储暂不可用，请稍后重试" },
  UPLOAD_BUSY: { status: 503, message: "图片处理中，请稍后重试" },
  LIMITER_UNAVAILABLE: { status: 503, message: "服务暂不可用，请稍后重试" },
  SERVICE_UNAVAILABLE: { status: 503, message: "服务暂不可用，请稍后重试" },
  BAD_GATEWAY: { status: 502, message: "服务响应异常，请稍后重试" },
  REQUEST_FAILED: { status: 400, message: "请求未能完成" },
};

const record = (value: unknown): RecordValue | null => value !== null && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : null;
// Pydantic limits Unicode code points; UTF-16 length would count emoji twice.
const text = (value: unknown, maximum: number, nonblank = true): value is string => typeof value === "string" && Array.from(value).length <= maximum && (!nonblank || value.trim().length > 0);
const integer = (value: unknown, minimum = 0): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= minimum;
const uuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value);
const date = (value: unknown): value is string => text(value, 64) && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
const exact = (value: RecordValue, keys: string[]) => Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const requestId = (value?: unknown) => typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value) ? value : crypto.randomUUID();

function failure(status: number, code = "INVALID_REQUEST", id?: unknown) {
  return Response.json({ success: false, data: null, error: { code, message: ERRORS[code].message }, request_id: requestId(id) }, { status, headers: PRIVATE });
}

async function session(request: Request, write = false) {
  const authorized = await authorize(request, write);
  return authorized instanceof Response ? failure(authorized.status, authorized.status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN") : authorized;
}

function imageUrl(value: unknown): value is string {
  if (!text(value, 8192)) return false;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}

function bilingual(value: unknown, zhLimit = 6000, enLimit = 12000): BilingualPrompt | null {
  const pair = record(value);
  return pair && exact(pair, ["zh", "en"]) && text(pair.zh, zhLimit) && text(pair.en, enLimit) ? { zh: pair.zh, en: pair.en } : null;
}

function breakdownPair(value: unknown): BilingualPrompt | null {
  const pair = record(value);
  return pair && exact(pair, ["zh", "en"]) && pair.zh === "" && pair.en === "" ? { zh: "", en: "" } : bilingual(value, 600, 1200);
}

function result(value: unknown): AnalysisResult | null {
  const data = record(value), breakdown = record(data?.breakdown);
  if (!data || !breakdown || data.schema_version !== "1" || !text(data.title, 80)) return null;
  const prompt = bilingual(data.prompt);
  const subject = breakdownPair(breakdown.subject), composition = breakdownPair(breakdown.composition);
  const lighting = breakdownPair(breakdown.lighting), style = breakdownPair(breakdown.style);
  if (!prompt || !subject || !composition || !lighting || !style || !Array.isArray(data.uncertain_details) || data.uncertain_details.length > 8 || !data.uncertain_details.every((item) => text(item, 240))) return null;
  return { schema_version: "1", title: data.title, prompt, breakdown: { subject, composition, lighting, style }, uncertain_details: [...data.uncertain_details] as string[] };
}

function asset(value: unknown): AnalysisAsset | null {
  const data = record(value);
  if (!data || !uuid(data.id) || !integer(data.width, 1) || !integer(data.height, 1) || !integer(data.byte_size, 1) || !imageUrl(data.preview_url) || !imageUrl(data.thumbnail_url) || !date(data.preview_expires_at)) return null;
  return { id: data.id, width: data.width, height: data.height, byte_size: data.byte_size, preview_url: data.preview_url, thumbnail_url: data.thumbnail_url, preview_expires_at: data.preview_expires_at };
}

function common(value: unknown): Omit<AnalysisDetail, "result" | "prompt" | "saved_to_history"> | null {
  const data = record(value);
  if (!data || !uuid(data.id) || !uuid(data.asset_id) || !STATUSES.includes(data.status as AnalysisStatus) || !text(data.phase, 40) || !/^[a-z_]+$/.test(data.phase) || !integer(data.revision) || !date(data.created_at) || !(data.finished_at === null || date(data.finished_at)) || !(data.title === null || text(data.title, 80)) || !(data.error_code === null || text(data.error_code, 80)) || !date(data.history_retain_until) || typeof data.image_available !== "boolean") return null;
  if (!(data.preview_url === null || imageUrl(data.preview_url)) || !(data.thumbnail_url === null || imageUrl(data.thumbnail_url)) || !(data.preview_expires_at === null || date(data.preview_expires_at))) return null;
  return {
    id: data.id, asset_id: data.asset_id, status: data.status as AnalysisStatus, phase: data.phase,
    revision: data.revision, created_at: data.created_at, finished_at: data.finished_at,
    title: data.title, error_code: data.error_code === null ? null : JOB_ERRORS.has(data.error_code) ? data.error_code : "analysis_failed",
    history_retain_until: data.history_retain_until, image_available: data.image_available,
    preview_url: data.preview_url, thumbnail_url: data.thumbnail_url, preview_expires_at: data.preview_expires_at,
    ...(data.preview_status === "temporarily_unavailable" ? { preview_status: "temporarily_unavailable" as const } : {}),
  };
}

function detail(value: unknown): AnalysisDetail | null {
  const data = record(value), base = common(value);
  if (!data || !base || typeof data.saved_to_history !== "boolean") return null;
  const generated = data.result === null ? null : result(data.result);
  const prompt = data.prompt === null ? null : bilingual(data.prompt);
  if ((data.result !== null && !generated) || (data.prompt !== null && !prompt)) return null;
  return { ...base, result: generated, prompt, saved_to_history: data.saved_to_history };
}

function summary(value: unknown): AnalysisSummary | null {
  const data = record(value), base = common(value), snippets = record(data?.summary);
  if (!data || !base || !snippets || Object.keys(snippets).some((key) => !["zh", "en"].includes(key)) || Object.values(snippets).some((item) => !text(item, 160, false))) return null;
  return { ...base, summary: { ...(typeof snippets.zh === "string" ? { zh: snippets.zh } : {}), ...(typeof snippets.en === "string" ? { en: snippets.en } : {}) } };
}

function history(value: unknown): AnalysisHistory | null {
  const data = record(value), pagination = record(data?.pagination);
  if (!data || !pagination || !Array.isArray(data.items) || !integer(pagination.limit, 1) || pagination.limit > 50 || data.items.length > pagination.limit || typeof pagination.has_more !== "boolean" || !(pagination.next_cursor === null || text(pagination.next_cursor, 512)) || (pagination.has_more && pagination.next_cursor === null)) return null;
  const items = data.items.map(summary);
  if (items.some((item) => item === null)) return null;
  return { items: items as AnalysisSummary[], pagination: { limit: pagination.limit, has_more: pagination.has_more, next_cursor: pagination.next_cursor } };
}

async function responseBody(response: Response): Promise<unknown> {
  if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get("content-type") ?? "")) return null;
  // boundedBody only consumes these shared Request/Response fields; no URL or cookies are used.
  const bytes = await boundedBody(response as unknown as Request, MAX_RESPONSE);
  return bytes ? JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) : null;
}

function upstreamError(status: number, body: RecordValue | null) {
  const safeStatus = [400, 401, 403, 404, 409, 413, 415, 422, 429, 503].includes(status) ? status : 502;
  const error = record(body?.error), code = typeof error?.code === "string" ? error.code : "";
  if (Object.hasOwn(ERRORS, code) && ERRORS[code].status === safeStatus) return failure(safeStatus, code, body?.request_id);
  const fallback: Record<number, string> = { 400: "REQUEST_FAILED", 401: "UNAUTHENTICATED", 403: "FORBIDDEN", 404: "NOT_FOUND", 413: "PAYLOAD_TOO_LARGE", 415: "UNSUPPORTED_MEDIA_TYPE", 422: "INVALID_REQUEST", 503: "SERVICE_UNAVAILABLE" };
  return failure(safeStatus, fallback[safeStatus] ?? (safeStatus === 502 ? "BAD_GATEWAY" : "REQUEST_FAILED"), body?.request_id);
}

async function forward<T>(path: string, token: string, method: string, parse: Parser<T>, statuses = [200], body?: string | FormData, idempotencyKey?: string) {
  const base = (process.env.API_BASE_URL ?? "http://localhost:8000").replace(/\/$/, "");
  try {
    const response = await fetch(`${base}/api/${path}`, {
      method, body, headers: { Authorization: `Bearer ${token}`, ...(typeof body === "string" ? { "Content-Type": "application/json" } : {}), ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) },
      cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(30000),
    });
    if (method === "DELETE" && response.status === 204) return new Response(null, { status: 204, headers: PRIVATE });
    const payload = record(await responseBody(response).catch(() => null));
    if (!response.ok) return upstreamError(response.status, payload);
    if (!statuses.includes(response.status) || payload?.success !== true || payload.error !== null) return failure(502, "BAD_GATEWAY");
    const data = parse(payload.data);
    if (data === null) return failure(502, "BAD_GATEWAY", payload.request_id);
    return Response.json({ success: true, data, error: null, request_id: requestId(payload.request_id) }, { status: response.status, headers: PRIVATE });
  } catch { return failure(503, "SERVICE_UNAVAILABLE"); }
}

async function jsonBody(request: Request): Promise<RecordValue | Response> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) return failure(415, "UNSUPPORTED_MEDIA_TYPE");
  const bytes = await boundedBody(request, MAX_JSON).catch(() => null);
  if (!bytes) return failure(413, "PAYLOAD_TOO_LARGE");
  try { return record(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))) ?? failure(422); }
  catch { return failure(422); }
}

export async function uploadAsset(request: Request) {
  const token = await session(request, true);
  if (token instanceof Response) return token;
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data\s*;/i.test(contentType)) return failure(415, "UNSUPPORTED_MEDIA_TYPE");
  const bytes = await boundedBody(request, MAX_IMAGE + 64 * 1024).catch(() => null);
  if (!bytes) return failure(413, "PAYLOAD_TOO_LARGE");
  try {
    const form = await new Response(bytes as BodyInit, { headers: { "Content-Type": contentType } }).formData();
    const file = form.get("file");
    if (!(file instanceof File) || [...form.keys()].length !== 1 || file.size === 0) return failure(422, "INVALID_IMAGE");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return failure(415, "UNSUPPORTED_IMAGE");
    if (file.size > MAX_IMAGE) return failure(413, "PAYLOAD_TOO_LARGE");
    const outgoing = new FormData(); outgoing.append("file", file);
    return forward("prompt-assets", token, "POST", asset, [201], outgoing);
  } catch { return failure(422, "INVALID_IMAGE"); }
}

export async function getAsset(request: Request, context: Context) {
  const token = await session(request);
  if (token instanceof Response) return token;
  const { id } = await context.params;
  return uuid(id) ? forward(`prompt-assets/${id}`, token, "GET", asset) : failure(422);
}

export async function createAnalysis(request: Request) {
  const token = await session(request, true);
  if (token instanceof Response) return token;
  const key = request.headers.get("idempotency-key");
  if (!uuid(key)) return failure(422, "INVALID_IDEMPOTENCY_KEY");
  const body = await jsonBody(request);
  if (body instanceof Response) return body;
  if (!exact(body, ["asset_id"]) || !uuid(body.asset_id)) return failure(422);
  return forward("prompt-analyses", token, "POST", detail, [200, 202], JSON.stringify({ asset_id: body.asset_id }), key);
}

export async function listAnalyses(request: Request) {
  const token = await session(request);
  if (token instanceof Response) return token;
  const query = new URL(request.url).searchParams, limit = query.get("limit") ?? "20", cursor = query.get("cursor");
  if (query.getAll("limit").length > 1 || query.getAll("cursor").length > 1 || !/^(?:[1-9]|[1-4][0-9]|50)$/.test(limit) || (cursor !== null && cursor.length > 512)) return failure(422);
  const outgoing = new URLSearchParams({ limit });
  if (cursor !== null) outgoing.set("cursor", cursor);
  return forward(`prompt-analyses?${outgoing}`, token, "GET", history);
}

export async function getAnalysis(request: Request, context: Context) {
  const token = await session(request);
  if (token instanceof Response) return token;
  const { id } = await context.params;
  return uuid(id) ? forward(`prompt-analyses/${id}`, token, "GET", detail) : failure(422);
}

export async function editAnalysis(request: Request, context: Context) {
  const token = await session(request, true);
  if (token instanceof Response) return token;
  const { id } = await context.params;
  if (!uuid(id)) return failure(422);
  const body = await jsonBody(request);
  if (body instanceof Response) return body;
  const prompt = bilingual(body.prompt);
  if (!exact(body, ["revision", "prompt"]) || !integer(body.revision) || !prompt) return failure(422);
  return forward(`prompt-analyses/${id}`, token, "PATCH", detail, [200], JSON.stringify({ revision: body.revision, prompt }));
}

export async function deleteAnalysis(request: Request, context: Context) {
  const token = await session(request, true);
  if (token instanceof Response) return token;
  const { id } = await context.params;
  return uuid(id) ? forward(`prompt-analyses/${id}`, token, "DELETE", () => null, []) : failure(422);
}

export async function getExamples() {
  return Response.json({ success: true, data: { items: [] }, error: null, request_id: requestId() }, { headers: { "Cache-Control": "public, max-age=300" } });
}
