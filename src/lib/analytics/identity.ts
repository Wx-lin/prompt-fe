import { createHash, randomUUID } from "node:crypto";

export const VISITOR_COOKIE = "aigc_visitor";
export function visitorIdentity(value?: string) {
  const valid = !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  const id = valid ? value.toLowerCase() : randomUUID();
  return { id, fresh: !valid, hash: createHash("sha256").update(id).digest("hex") };
}

export function isSameOrigin(request: Request): boolean {
  const url = new URL(request.url);
  const host = request.headers.get("host") ?? url.host;
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ?? url.protocol.slice(0, -1);
  const fetchSite = request.headers.get("sec-fetch-site");
  return ["http", "https"].includes(protocol)
    && request.headers.get("origin") === `${protocol}://${host}`
    && (fetchSite === null || fetchSite === "same-origin");
}
