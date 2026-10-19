import { cookies } from "next/headers";
import { isSameOrigin, visitorIdentity, VISITOR_COOKIE } from "@/lib/analytics/identity";
import { boundedBody } from "@/lib/submissions/proxy";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
const failure = (status: number) => Response.json({ error: "request_failed" }, { status, headers });

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return failure(403);
  let body;
  try { body = await boundedBody(request, 64); }
  catch { return failure(400); }
  if (body === null) return failure(413);
  // The browser supplies no identifiers, URL, referrer or other analytics data.
  if (body.byteLength) return failure(400);
  const store = await cookies();
  const visitor = visitorIdentity(store.get(VISITOR_COOKIE)?.value);
  // Persist identity even if the upstream is unavailable, avoiding retry inflation.
  if (visitor.fresh) store.set(VISITOR_COOKIE, visitor.id, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 365 * 24 * 60 * 60,
  });
  const base = (process.env.API_BASE_URL ?? "http://localhost:8000").replace(/\/$/, "");
  try {
    const upstream = await fetch(`${base}/api/analytics/visit`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitor_hash: visitor.hash }), cache: "no-store", signal: AbortSignal.timeout(3000),
    });
    if (!upstream.ok) return failure(503);
    return new Response(null, { status: 204, headers });
  } catch { return failure(503); }
}
