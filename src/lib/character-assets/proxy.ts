import "server-only";
import { authorize, boundedBody } from "@/lib/submissions/proxy";

type Context = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRIVATE = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const MAX_JSON = 21 * 1024 * 1024;
const MAX_IMAGE = 15 * 1024 * 1024;
const messages: Record<number, string> = { 401: "请先登录", 403: "当前操作不可用", 404: "角色不存在", 409: "角色数据已变化，请重试", 413: "图片或角色数据过大", 415: "请求格式不支持", 422: "角色数据不符合要求", 429: "操作过于频繁，请稍后重试", 502: "角色服务响应异常", 503: "角色服务暂不可用" };

function failure(status: number, code = `HTTP_${status}`, message = messages[status] ?? messages[502]) {
  return Response.json({ success: false, data: null, error: { code, message } }, { status, headers: PRIVATE });
}

async function proxy(request: Request, path: string, binary = false): Promise<Response> {
  const write = request.method !== "GET";
  const token = await authorize(request, write);
  if (token instanceof Response) return failure(token.status === 401 ? 401 : 403);
  let body: string | undefined;
  if (request.method === "POST" || request.method === "PUT") {
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) return failure(415);
    const bytes = await boundedBody(request, MAX_JSON).catch(() => null);
    if (!bytes) return failure(413);
    try {
      body = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      const data: unknown = JSON.parse(body);
      if (!data || typeof data !== "object" || Array.isArray(data)) return failure(422);
    } catch { return failure(422); }
  }
  const base = (process.env.API_BASE_URL ?? "http://localhost:8000").replace(/\/$/, "");
  try {
    const upstream = await fetch(`${base}/api/character-assets${path}`, {
      method: request.method, headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      body, cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(30000),
    });
    if (!upstream.ok) {
      const errorBytes = await boundedBody(upstream as unknown as Request, 16 * 1024).catch(() => null);
      try {
        const errorBody = errorBytes && JSON.parse(new TextDecoder().decode(errorBytes));
        if (upstream.status === 429 && errorBody?.error?.code === "ASSET_LIMIT_REACHED") return failure(429, "ASSET_LIMIT_REACHED", "角色数量已达上限，请删除不需要的角色后再保存。");
        if (upstream.status === 413 && errorBody?.error?.code === "ASSET_STORAGE_LIMIT") return failure(413, "ASSET_STORAGE_LIMIT", "角色图片空间已满，请删除不需要的角色或图片后再保存。");
      } catch { /* Never forward untrusted error details. */ }
      return failure(Object.hasOwn(messages, upstream.status) ? upstream.status : 502);
    }
    if (upstream.status === 204) return new Response(null, { status: 204, headers: PRIVATE });
    const type = upstream.headers.get("content-type") ?? "";
    if (binary ? !/^image\/png(?:\s*;|$)/i.test(type) : !/^application\/json(?:\s*;|$)/i.test(type)) return failure(502);
    const bytes = await boundedBody(upstream as unknown as Request, binary ? MAX_IMAGE : MAX_JSON);
    if (!bytes) return failure(502);
    if (binary) {
      const png = [137, 80, 78, 71, 13, 10, 26, 10];
      if (bytes.length < png.length || !png.every((value, index) => bytes[index] === value)) return failure(502);
      return new Response(bytes as BodyInit, { status: upstream.status, headers: { ...PRIVATE, "Content-Type": "image/png" } });
    }
    const envelope: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!envelope || typeof envelope !== "object" || Array.isArray(envelope) || !("success" in envelope) || envelope.success !== true || !("data" in envelope)) return failure(502);
    return Response.json(envelope, { status: upstream.status, headers: PRIVATE });
  } catch { return failure(503); }
}

export async function collection(request: Request): Promise<Response> {
  if (request.method !== "GET") return proxy(request, "");
  const query = new URL(request.url).searchParams;
  if ([...query.keys()].some((key) => !["limit", "offset"].includes(key)) || query.getAll("limit").length > 1 || query.getAll("offset").length > 1) return failure(422);
  const limit = query.get("limit"), offset = query.get("offset");
  if ((limit !== null && (!/^[1-9]\d{0,2}$/.test(limit) || Number(limit) > 100)) || (offset !== null && (!/^(0|[1-9]\d{0,5})$/.test(offset) || Number(offset) > 100000))) return failure(422);
  const outgoing = new URLSearchParams();
  if (limit !== null) outgoing.set("limit", limit);
  if (offset !== null) outgoing.set("offset", offset);
  return proxy(request, outgoing.size ? `?${outgoing}` : "");
}
export async function item(request: Request, context: Context): Promise<Response> {
  const { id } = await context.params;
  return UUID.test(id) ? proxy(request, `/${id}`) : failure(422);
}
export async function image(request: Request, context: Context): Promise<Response> {
  const { id } = await context.params;
  return UUID.test(id) ? proxy(request, `/${id}/image`, true) : failure(422);
}
