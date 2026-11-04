// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSessionToken } from "@/lib/auth/session";
import { collection, item, image } from "./proxy";

vi.mock("@/lib/auth/session", () => ({ getSessionToken: vi.fn() }));
const id = "5ec362f8-f693-4e51-b064-4d3800fb2d91";
const context = { params: Promise.resolve({ id }) };
const req = (method: string, body?: object, origin = "http://localhost") => new Request(`http://localhost/api/character-assets/${id}`, {
  method, headers: { origin, ...(body ? { "content-type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}),
});
beforeEach(() => vi.mocked(getSessionToken).mockResolvedValue("private-session"));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("character asset proxy", () => {
  it("requires a session and rejects cross-origin changes before reaching the backend", async () => {
    const upstream = vi.fn(); vi.stubGlobal("fetch", upstream);
    expect((await collection(req("POST", { name: "角色" }, "https://evil.example"))).status).toBe(403);
    vi.mocked(getSessionToken).mockResolvedValue(null);
    expect((await collection(req("GET"))).status).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
  });
  it("forwards a private authenticated asset write and returns the response without caching", async () => {
    const upstream = vi.fn().mockResolvedValue(Response.json({ success: true, data: { id }, error: null })); vi.stubGlobal("fetch", upstream);
    const body = { name: "角色", values: { name: "角色" }, template: "basic", model: "通用", preview_image_base64: null, preview_signature: null };
    const response = await collection(req("POST", body));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(upstream.mock.calls[0][1].headers.Authorization).toBe("Bearer private-session");
    expect(JSON.parse(upstream.mock.calls[0][1].body)).toEqual(body);
  });
  it("rejects invalid ids and sanitizes backend failures", async () => {
    const upstream = vi.fn().mockResolvedValue(Response.json({ detail: "secret diagnostic" }, { status: 500 })); vi.stubGlobal("fetch", upstream);
    expect((await item(req("GET"), { params: Promise.resolve({ id: "../escape" }) })).status).toBe(422);
    const response = await item(req("GET"), context);
    expect(response.status).toBe(502);
    expect(JSON.stringify(await response.json())).not.toContain("secret diagnostic");
  });
  it("forwards bounded pagination and rejects invalid offsets", async () => {
    const upstream = vi.fn().mockResolvedValue(Response.json({ success: true, data: [], error: null })); vi.stubGlobal("fetch", upstream);
    expect((await collection(new Request("http://localhost/api/character-assets?limit=25&offset=100"))).status).toBe(200);
    expect(upstream.mock.calls[0][0]).toContain("?limit=25&offset=100");
    expect((await collection(new Request("http://localhost/api/character-assets?offset=-1"))).status).toBe(422);
    expect(upstream).toHaveBeenCalledOnce();
  });
  it("returns an authenticated private image with fixed PNG content type", async () => {
    const upstream = vi.fn().mockResolvedValue(new Response(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), { headers: { "content-type": "image/png" } })); vi.stubGlobal("fetch", upstream);
    const response = await image(req("GET"), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(upstream.mock.calls[0][1].headers.Authorization).toBe("Bearer private-session");
  });
  it("reports asset quota errors without exposing other backend diagnostics", async () => {
    const upstream = vi.fn().mockResolvedValue(Response.json({ error: { code: "ASSET_LIMIT_REACHED", message: "private diagnostic" } }, { status: 429 }));
    vi.stubGlobal("fetch", upstream);
    const response = await collection(req("POST", { name: "角色" }));
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ error: { code: "ASSET_LIMIT_REACHED", message: expect.stringContaining("角色数量") } });
  });
  it("accepts a generated image payload larger than 5 MiB while bounding excessive requests", async () => {
    const upstream = vi.fn().mockResolvedValue(Response.json({ success: true, data: { id }, error: null })); vi.stubGlobal("fetch", upstream);
    const response = await collection(req("POST", { name: "角色", preview_image_base64: "a".repeat(9 * 1024 * 1024) }));
    expect(response.status).toBe(200);
    const oversized = new Request("http://localhost/api/character-assets", { method: "POST", headers: { origin: "http://localhost", "content-type": "application/json", "content-length": String(21 * 1024 * 1024 + 1) }, body: "{}" });
    expect((await collection(oversized)).status).toBe(413);
    expect(upstream).toHaveBeenCalledOnce();
  });
});
