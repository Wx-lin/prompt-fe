import "server-only";
import { authorize, boundedBody } from "@/lib/submissions/proxy";

const PRIVATE = { "Cache-Control": "private, no-store" };
const MAX_REFERENCE_BASE64 = Math.ceil((5 * 1024 * 1024) / 3) * 4;
const MAX_REQUEST = MAX_REFERENCE_BASE64 + 128 * 1024;
const MAX_RESPONSE = 20 * 1024 * 1024;
const RATIOS = new Set(["1:1", "3:4", "4:3", "9:16", "16:9", "21:9"]);
const MESSAGES: Record<number, [string, string]> = {
  401: ["UNAUTHENTICATED", "请先登录后生成预览图"],
  403: ["FORBIDDEN", "当前操作不可用"],
  413: ["PAYLOAD_TOO_LARGE", "角色描述过长"],
  415: ["UNSUPPORTED_MEDIA_TYPE", "请求格式不支持"],
  422: ["INVALID_REQUEST", "角色描述不符合要求"],
  429: ["RATE_LIMITED", "生成次数已达上限，请稍后再试"],
  502: ["BAD_GATEWAY", "生成服务暂时异常，请稍后再试"],
  503: ["SERVICE_UNAVAILABLE", "预览服务暂不可用，请稍后再试"],
  504: ["TIMEOUT", "生成超时，请稍后再试"],
};

function failure(status: number): Response {
  const [code, message] = MESSAGES[status] ?? MESSAGES[502];
  return Response.json({ success: false, data: null, error: { code, message } }, { status, headers: PRIVATE });
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export async function createCharacterPreview(request: Request): Promise<Response> {
  const token = await authorize(request, true);
  if (token instanceof Response) return failure(token.status === 401 ? 401 : 403);
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) return failure(415);
  const bytes = await boundedBody(request, MAX_REQUEST).catch(() => null);
  if (!bytes) return failure(413);
  let body: Record<string, unknown> | null;
  try { body = record(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))); }
  catch { return failure(422); }
  if (!body || Object.keys(body).some((key) => !["prompt", "aspect_ratio", "reference_image_base64"].includes(key)) || typeof body.prompt !== "string" || !body.prompt.trim() || Array.from(body.prompt).length > 12000 || (body.aspect_ratio !== undefined && (typeof body.aspect_ratio !== "string" || !RATIOS.has(body.aspect_ratio))) || (body.reference_image_base64 !== undefined && (typeof body.reference_image_base64 !== "string" || !body.reference_image_base64 || body.reference_image_base64.length > MAX_REFERENCE_BASE64 || body.reference_image_base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(body.reference_image_base64)))) return failure(422);

  const base = (process.env.CHARACTER_PREVIEW_API_BASE_URL?.trim() || process.env.PROMPT_CREATION_API_BASE_URL?.trim() || (process.env.API_BASE_URL ?? "http://localhost:8000")).replace(/\/$/, "");
  try {
    const upstream = await fetch(`${base}/api/character-preview`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ prompt: body.prompt, ...(body.aspect_ratio === undefined ? {} : { aspect_ratio: body.aspect_ratio }), ...(body.reference_image_base64 === undefined ? {} : { reference_image_base64: body.reference_image_base64 }) }), cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(180000),
    });
    if (!upstream.ok) {
      await upstream.body?.cancel().catch(() => undefined);
      return failure(Object.hasOwn(MESSAGES, upstream.status) ? upstream.status : 502);
    }
    if (!/^application\/json(?:\s*;|$)/i.test(upstream.headers.get("content-type") ?? "")) {
      await upstream.body?.cancel().catch(() => undefined);
      return failure(502);
    }
    const resultBytes = await boundedBody(upstream as unknown as Request, MAX_RESPONSE);
    if (!resultBytes) return failure(502);
    const envelope = record(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(resultBytes)));
    const data = record(envelope?.data);
    if (envelope?.success !== true || envelope.error !== null || !data || data.mime_type !== "image/png" || typeof data.image_base64 !== "string" || !data.image_base64 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data.image_base64)) return failure(502);
    return Response.json({ success: true, data: { image_base64: data.image_base64, mime_type: "image/png" }, error: null }, { headers: PRIVATE });
  } catch { return failure(503); }
}
