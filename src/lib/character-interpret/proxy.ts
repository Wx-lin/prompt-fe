import "server-only";
import { GROUPS } from "@/features/character-builder/character-data";
import { authorize, boundedBody } from "@/lib/submissions/proxy";

const PRIVATE = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const MAX_REQUEST = 32 * 1024;
const MAX_RESPONSE = 128 * 1024;
const FIELDS = new Set(GROUPS.flatMap((group) => group.fields.map((field) => field.id)));
const MESSAGES: Record<number, [string, string]> = {
  401: ["UNAUTHENTICATED", "请先登录后创建角色"],
  403: ["FORBIDDEN", "当前操作不可用"],
  413: ["PAYLOAD_TOO_LARGE", "角色描述过长"],
  415: ["UNSUPPORTED_MEDIA_TYPE", "请求格式不支持"],
  422: ["INVALID_REQUEST", "角色描述不符合要求"],
  429: ["RATE_LIMITED", "操作过于频繁，请稍后再试"],
  502: ["BAD_GATEWAY", "角色解析服务响应异常，请稍后重试"],
  503: ["SERVICE_UNAVAILABLE", "角色解析服务暂不可用，请稍后重试"],
  504: ["TIMEOUT", "角色解析超时，请稍后重试"],
};

function failure(status: number): Response {
  const [code, message] = MESSAGES[status] ?? MESSAGES[502];
  return Response.json({ success: false, data: null, error: { code, message } }, { status, headers: PRIVATE });
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export async function interpretCharacter(request: Request): Promise<Response> {
  const token = await authorize(request, true);
  if (token instanceof Response) return failure(token.status === 401 ? 401 : 403);
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) return failure(415);
  const bytes = await boundedBody(request, MAX_REQUEST).catch(() => null);
  if (!bytes) return failure(413);
  let body: Record<string, unknown> | null;
  try { body = record(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))); }
  catch { return failure(422); }
  if (!body || Object.keys(body).some((key) => key !== "description" && key !== "current_details") || typeof body.description !== "string" || !body.description.trim() || Array.from(body.description.trim()).length > 2000 || ("current_details" in body && (typeof body.current_details !== "string" || body.current_details.length > 2000))) return failure(422);

  const base = (process.env.CHARACTER_PREVIEW_API_BASE_URL?.trim() || process.env.PROMPT_CREATION_API_BASE_URL?.trim() || (process.env.API_BASE_URL ?? "http://localhost:8000")).replace(/\/$/, "");
  let upstream: Response;
  try {
    upstream = await fetch(`${base}/api/character-interpret`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ description: body.description.trim(), ...("current_details" in body ? { current_details: (body.current_details as string).trim() } : {}) }), cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(60000),
    });
  } catch { return failure(503); }
  if (!upstream.ok) {
    await upstream.body?.cancel().catch(() => undefined);
    return failure(Object.hasOwn(MESSAGES, upstream.status) ? upstream.status : 502);
  }
  if (!/^application\/json(?:\s*;|$)/i.test(upstream.headers.get("content-type") ?? "")) {
    await upstream.body?.cancel().catch(() => undefined);
    return failure(502);
  }
  try {
    const resultBytes = await boundedBody(upstream as unknown as Request, MAX_RESPONSE);
    if (!resultBytes) return failure(502);
    const envelope = record(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(resultBytes)));
    const data = record(envelope?.data), values = record(data?.values);
    if (envelope?.success !== true || envelope.error !== null || !values || typeof data?.unmapped !== "string" || data.unmapped.length > 2000 || Object.entries(values).some(([key, value]) => !FIELDS.has(key) || typeof value !== "string" || value.length > 2000)) return failure(502);
    return Response.json({ success: true, data: { values, unmapped: data.unmapped }, error: null }, { headers: PRIVATE });
  } catch { return failure(502); }
}
