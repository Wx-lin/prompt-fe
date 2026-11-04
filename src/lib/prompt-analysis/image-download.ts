import "server-only";
import { boundedBody } from "@/lib/submissions/proxy";
import { promptAnalysisProxy as proxy } from "./proxy";

type Context = { params: Promise<{ id: string; imageId: string }> };
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const FORMATS: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export async function downloadConversationImage(request: Request, context: Context) {
  const token = await proxy.session(request);
  if (token instanceof Response) return token;
  const { id, imageId } = await context.params;
  if (!proxy.uuid(id) || !proxy.uuid(imageId)) return proxy.failure(422);
  const base = (process.env.PROMPT_CREATION_API_BASE_URL?.trim() || (process.env.API_BASE_URL ?? "http://localhost:8000")).replace(/\/$/, "");
  try {
    const upstream = await fetch(`${base}/api/prompt-conversations/${id}/images/${imageId}/download`, {
      method: "GET", headers: { Authorization: `Bearer ${token}` }, cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(30000),
    });
    if (!upstream.ok) {
      await upstream.body?.cancel().catch(() => undefined);
      return proxy.failure(upstream.status === 401 ? 401 : upstream.status === 403 ? 403 : upstream.status === 404 ? 404 : 502, upstream.status === 401 ? "UNAUTHENTICATED" : upstream.status === 403 ? "FORBIDDEN" : upstream.status === 404 ? "NOT_FOUND" : "BAD_GATEWAY");
    }
    const type = (upstream.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!FORMATS[type]) { await upstream.body?.cancel().catch(() => undefined); return proxy.failure(502, "BAD_GATEWAY"); }
    const bytes = await boundedBody(upstream as unknown as Request, MAX_IMAGE_BYTES);
    if (!bytes || bytes.length === 0) return proxy.failure(502, "BAD_GATEWAY");
    return new Response(bytes as BodyInit, { headers: { "Content-Type": type, "Content-Disposition": `attachment; filename="generated-image.${FORMATS[type]}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch { return proxy.failure(503, "SERVICE_UNAVAILABLE"); }
}
