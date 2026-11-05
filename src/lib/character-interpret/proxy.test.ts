// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/character-interpret/route";
import { getSessionToken } from "@/lib/auth/session";

vi.mock("@/lib/auth/session", () => ({ getSessionToken: vi.fn(async () => "private-session") }));
const request = (body: unknown, origin = "http://localhost") => new Request("http://localhost/api/character-interpret", {
  method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body),
});
beforeEach(() => vi.mocked(getSessionToken).mockResolvedValue("private-session"));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("character interpretation proxy", () => {
  it("forwards existing details to the model while keeping the old request format valid", async () => {
    const upstream = vi.fn().mockResolvedValue(Response.json({ success: true, data: { values: {}, unmapped: "左手有疤；戴银戒" }, error: null }));
    vi.stubGlobal("fetch", upstream);
    const response = await POST(request({ description: "戴银戒", current_details: "左手有疤" }));
    expect(response.status).toBe(200);
    expect(JSON.parse(upstream.mock.calls[0][1].body)).toEqual({ description: "戴银戒", current_details: "左手有疤" });
    expect((await response.json()).data.unmapped).toBe("左手有疤；戴银戒");
  });

  it.each([{ current_details: 10 }, { current_details: null }, { current_details: "字".repeat(2001) }])("rejects invalid existing details %j", async (extra) => {
    const upstream = vi.fn(); vi.stubGlobal("fetch", upstream);
    expect((await POST(request({ description: "角色", ...extra }))).status).toBe(422);
    expect(upstream).not.toHaveBeenCalled();
  });
  it("forwards the authenticated description and returns the parsed configuration privately", async () => {
    vi.stubEnv("CHARACTER_PREVIEW_API_BASE_URL", "http://127.0.0.1:8051");
    const upstream = vi.fn().mockResolvedValue(Response.json({ success: true, data: { values: { age: "25岁", hairColor: "黑色" }, unmapped: "左手拿着一束花", secret: "hidden" }, error: null }));
    vi.stubGlobal("fetch", upstream);
    const response = await POST(request({ description: "25岁黑发女性，手拿花" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ success: true, data: { values: { age: "25岁", hairColor: "黑色" }, unmapped: "左手拿着一束花" }, error: null });
    expect(upstream.mock.calls[0][0]).toBe("http://127.0.0.1:8051/api/character-interpret");
    expect(upstream.mock.calls[0][1]).toMatchObject({ method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer private-session" }, body: JSON.stringify({ description: "25岁黑发女性，手拿花" }) });
  });

  it("rejects anonymous and cross-origin requests without reaching the backend", async () => {
    const upstream = vi.fn(); vi.stubGlobal("fetch", upstream);
    expect((await POST(request({ description: "角色" }, "https://attacker.example"))).status).toBe(403);
    vi.mocked(getSessionToken).mockResolvedValue(null);
    expect((await POST(request({ description: "角色" }))).status).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
  });

  it.each([{ description: " " }, { description: "角色", model: "other" }, { description: 12 }, { description: "角".repeat(2001) }])("rejects invalid input %j", async (body) => {
    const upstream = vi.fn(); vi.stubGlobal("fetch", upstream);
    expect((await POST(request(body))).status).toBe(422);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("rejects malformed upstream results and sanitizes upstream errors", async () => {
    const upstream = vi.fn().mockResolvedValueOnce(Response.json({ error: { message: "upstream secret" } }, { status: 429 }))
      .mockResolvedValueOnce(Response.json({ success: true, data: { values: { age: 25 }, unmapped: "" }, error: null }));
    vi.stubGlobal("fetch", upstream);
    const limited = await POST(request({ description: "角色" }));
    expect(limited.status).toBe(429);
    expect(JSON.stringify(await limited.json())).not.toContain("upstream secret");
    expect((await POST(request({ description: "角色" }))).status).toBe(502);
  });

  it("does not return unknown response fields or oversized values", async () => {
    const upstream = vi.fn().mockResolvedValueOnce(Response.json({ success: true, data: { values: { unexpected: "value" }, unmapped: "" }, error: null }))
      .mockResolvedValueOnce(Response.json({ success: true, data: { values: { age: "a".repeat(2001) }, unmapped: "" }, error: null }))
      .mockResolvedValueOnce(new Response("not json", { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", upstream);
    expect((await POST(request({ description: "角色" }))).status).toBe(502);
    expect((await POST(request({ description: "角色" }))).status).toBe(502);
    expect((await POST(request({ description: "角色" }))).status).toBe(502);
  });
});
