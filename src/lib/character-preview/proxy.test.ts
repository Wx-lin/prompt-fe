// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/character-preview/route";
import { getSessionToken } from "@/lib/auth/session";

vi.mock("@/lib/auth/session", () => ({ getSessionToken: vi.fn(async () => "private-session") }));
const request = (body: unknown, origin = "http://localhost") => new Request("http://localhost/api/character-preview", {
  method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body),
});
beforeEach(() => vi.mocked(getSessionToken).mockResolvedValue("private-session"));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("character preview proxy", () => {
  it("forwards the authenticated session to the backend while returning a private image", async () => {
    const upstream = vi.fn().mockResolvedValue(Response.json({ success: true, data: { image_base64: "aGVsbG8=", mime_type: "image/png", secret: "hidden" }, error: null }));
    vi.stubGlobal("fetch", upstream);
    const response = await POST(request({ prompt: "角色描述" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toMatchObject({ success: true, data: { image_base64: "aGVsbG8=", mime_type: "image/png" }, error: null });
    expect(upstream.mock.calls[0][1]).toMatchObject({ method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer private-session" }, body: JSON.stringify({ prompt: "角色描述" }) });
  });
  it("forwards only an allowed picture aspect ratio", async () => {
    const upstream = vi.fn().mockResolvedValue(Response.json({ success: true, data: { image_base64: "aGVsbG8=", mime_type: "image/png" }, error: null }));
    vi.stubGlobal("fetch", upstream);
    expect((await POST(request({ prompt: "角色", aspect_ratio: "16:9" }))).status).toBe(200);
    expect(JSON.parse(upstream.mock.calls[0][1].body)).toEqual({ prompt: "角色", aspect_ratio: "16:9" });
    expect((await POST(request({ prompt: "角色", aspect_ratio: "5000:1" }))).status).toBe(422);
    expect(upstream).toHaveBeenCalledOnce();
  });
  it("routes character previews to the dedicated configured service", async () => {
    vi.stubEnv("CHARACTER_PREVIEW_API_BASE_URL", "http://127.0.0.1:8051");
    vi.stubEnv("PROMPT_CREATION_API_BASE_URL", "http://127.0.0.1:8040");
    const upstream = vi.fn().mockResolvedValue(Response.json({ success: true, data: { image_base64: "aGVsbG8=", mime_type: "image/png" }, error: null }));
    vi.stubGlobal("fetch", upstream);
    expect((await POST(request({ prompt: "角色" }))).status).toBe(200);
    expect(upstream.mock.calls[0][0]).toBe("http://127.0.0.1:8051/api/character-preview");
  });
  it("rejects anonymous visitors and cross-origin requests without contacting the backend", async () => {
    const upstream = vi.fn().mockResolvedValue(Response.json({ success: true, data: { image_base64: "aGVsbG8=", mime_type: "image/png" }, error: null })); vi.stubGlobal("fetch", upstream);
    expect((await POST(request({ prompt: "角色" }, "https://attacker.example"))).status).toBe(403);
    vi.mocked(getSessionToken).mockResolvedValue(null);
    expect((await POST(request({ prompt: "角色" }))).status).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
  });
  it.each([{ prompt: " " }, { prompt: "x", model: "other" }, { prompt: "x".repeat(12001) }])("rejects invalid payload %j", async payload => {
    const upstream = vi.fn(); vi.stubGlobal("fetch", upstream);
    expect((await POST(request(payload))).status).toBe(422);
    expect(upstream).not.toHaveBeenCalled();
  });
  it("sanitizes upstream errors and rejects malformed images", async () => {
    const upstream = vi.fn().mockResolvedValueOnce(Response.json({ error: { code: "RATE_LIMITED", message: "secret from upstream" } }, { status: 429 }))
      .mockResolvedValueOnce(Response.json({ success: true, data: { image_base64: "bad!", mime_type: "text/html" }, error: null }));
    vi.stubGlobal("fetch", upstream);
    const limited = await POST(request({ prompt: "角色" }));
    expect(limited.status).toBe(429);
    expect(JSON.stringify(await limited.json())).not.toContain("secret from upstream");
    expect((await POST(request({ prompt: "角色" }))).status).toBe(502);
  });
});
