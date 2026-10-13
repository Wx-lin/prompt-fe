import { getSessionToken } from "@/lib/auth/session";
export const failure = (status: number) => Response.json({ error: status === 401 ? "unauthorized" : "request_failed" }, { status });

export async function authorize(request: Request, write = true): Promise<string | Response> {
  if (write) {
    const url = new URL(request.url);
    // Next may use an internal URL hostname; Host remains the browser's destination.
    const host = request.headers.get("host") ?? url.host;
    const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ?? url.protocol.slice(0, -1);
    if (!["http", "https"].includes(protocol) || request.headers.get("origin") !== `${protocol}://${host}`)
      return failure(403);
  }
  return await getSessionToken() ?? failure(401);
}
/** Enforce the bound while streaming, including bodies without Content-Length. */

export async function boundedBody(request: Request, limit: number): Promise<Uint8Array | null> {
  const length = Number(request.headers.get("content-length"));
  if (length > limit)
    return null;
  const reader = request.body?.getReader();
  if (!reader)
    return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done)
        break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const result = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }
  finally {
    reader.releaseLock();
  }
}

export async function forward(path: string, token: string, body?: string | FormData) {
  const base = (process.env.API_BASE_URL ?? "http://localhost:8000").replace(/\/$/, "");
  try {
    const response = await fetch(`${base}/api/submissions${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(typeof body === "string" ? { "Content-Type": "application/json" } : {})
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok)
      return failure([400, 401, 403, 409, 413, 415, 422, 429].includes(response.status) ? response.status : 502);
    return Response.json(await response.json(), { status: response.status, headers: { "Cache-Control": "private, no-store" } });
  }
  catch {
    return failure(503);
  }
}
