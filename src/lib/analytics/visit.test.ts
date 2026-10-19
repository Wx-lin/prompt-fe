// @vitest-environment node
import { createHash } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
import { cookies } from "next/headers";
import { POST } from "@/app/api/analytics/visit/route";
const uuid = "b08465eb-b082-4f2b-9c9a-8fa341344765";
const cookieStore = { get: vi.fn(), set: vi.fn() };
const request = (headers = {}, body?: string) => new Request("http://internal:3000/api/analytics/visit", { method: "POST", headers: { host: "site.test", origin: "https://site.test", "x-forwarded-proto": "https", "sec-fetch-site": "same-origin", ...headers }, body });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); cookieStore.get.mockReset(); cookieStore.set.mockReset(); });
it("requires browser same origin and rejects client identifiers and oversized bodies", async () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  for (const headers of [{ origin: "" }, { origin: "https://evil.test" }, { "sec-fetch-site": "cross-site" }]) expect((await POST(request(headers))).status).toBe(403);
  expect((await POST(request({}, JSON.stringify({ visitor_hash: "a" })))).status).toBe(400);
  expect((await POST(request({}, "x".repeat(65)))).status).toBe(413);
  expect(fetcher).not.toHaveBeenCalled();
});
it("hashes a stable anonymous cookie and sends only that hash without login credentials", async () => {
  vi.mocked(cookies).mockResolvedValue(cookieStore as never); cookieStore.get.mockReturnValue({ value: uuid });
  vi.stubEnv("API_BASE_URL", "http://backend.test/");
  const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 })); vi.stubGlobal("fetch", fetcher);
  const result = await POST(request()); expect(result.status).toBe(204);
  expect(result.headers.get("cache-control")).toContain("no-store");
  expect(fetcher).toHaveBeenCalledWith("http://backend.test/api/analytics/visit", expect.objectContaining({ body: JSON.stringify({ visitor_hash: createHash("sha256").update(uuid).digest("hex") }), cache: "no-store", headers: { "Content-Type": "application/json" } }));
  expect(cookieStore.set).not.toHaveBeenCalled();
});
it("persists a private production cookie even when upstream fails, hiding details", async () => {
  vi.mocked(cookies).mockResolvedValue(cookieStore as never); cookieStore.get.mockReturnValue({ value: "invalid" }); vi.stubEnv("NODE_ENV", "production");
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("private backend secret")));
  const result = await POST(request()); expect(result.status).toBe(503); expect(await result.text()).not.toContain("secret");
  expect(cookieStore.set).toHaveBeenCalledWith("aigc_visitor", expect.stringMatching(/^[\da-f-]{36}$/), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 31536000 });
});
it("maps non-success upstream to a generic unavailable response", async () => {
  vi.mocked(cookies).mockResolvedValue(cookieStore as never); cookieStore.get.mockReturnValue({ value: uuid });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ detail: "database secret" }, { status: 500 })));
  const result = await POST(request()); expect(result.status).toBe(503); expect(await result.text()).not.toContain("database");
});
