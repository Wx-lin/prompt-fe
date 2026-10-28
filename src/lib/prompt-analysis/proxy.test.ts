// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as upload } from "@/app/api/prompt-assets/route";
import { GET as asset } from "@/app/api/prompt-assets/[id]/route";
import { GET as history, POST as create } from "@/app/api/prompt-analyses/route";
import { DELETE as remove, GET as detail, PATCH as edit } from "@/app/api/prompt-analyses/[id]/route";
import { GET as examples } from "@/app/api/prompt-examples/route";
import { getSessionToken } from "@/lib/auth/session";

vi.mock("@/lib/auth/session", () => ({ getSessionToken: vi.fn(async () => "private-session") }));

const ID = "00000000-0000-4000-8000-000000000001";
const ASSET = "00000000-0000-4000-8000-000000000002";
const KEY = "00000000-0000-4000-8000-000000000003";
const DATE = "2026-10-22T12:00:00+00:00";
const context = (id = ID) => ({ params: Promise.resolve({ id }) });
const assetData = {
  id: ASSET, width: 1200, height: 800, byte_size: 1234,
  preview_url: "https://images.example.com/preview?signature=private",
  thumbnail_url: "https://images.example.com/thumbnail?signature=private", preview_expires_at: DATE,
};
const resultData = {
  schema_version: "1", title: "一只猫", prompt: { zh: "一只猫", en: "A cat" },
  breakdown: { subject: { zh: "猫", en: "cat" }, composition: { zh: "", en: "" }, lighting: { zh: "", en: "" }, style: { zh: "", en: "" } },
  uncertain_details: ["具体品种未知"],
};
const detailData = {
  id: ID, asset_id: ASSET, status: "succeeded", phase: "completed", revision: 0,
  created_at: DATE, finished_at: DATE, title: "一只猫", error_code: null, history_retain_until: DATE,
  image_available: true, preview_url: assetData.preview_url, thumbnail_url: assetData.thumbnail_url,
  preview_expires_at: DATE, result: resultData, prompt: resultData.prompt, saved_to_history: true,
};
const summaryData = {
  id: ID, asset_id: ASSET, status: "succeeded", phase: "completed", revision: 0,
  created_at: DATE, finished_at: DATE, title: "一只猫", error_code: null, history_retain_until: DATE,
  image_available: false, preview_url: null, thumbnail_url: null, preview_expires_at: null,
  summary: { zh: "一只猫", en: "A cat" },
};
const envelope = (data: unknown) => ({ success: true, data, error: null, request_id: "backend-request-1" });
const incoming = (method = "GET", body?: unknown, headers: HeadersInit = {}, path = "/api/prompt-analyses") => new Request(`http://localhost${path}`, {
  method, headers: { origin: "http://localhost", "content-type": "application/json", ...headers },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
function formRequest(file = new File(["png"], "cat.png", { type: "image/png" }), extra = false) {
  const form = new FormData();
  form.append("file", file);
  if (extra) form.append("private", "unexpected");
  return new Request("http://localhost/api/prompt-assets", { method: "POST", headers: { origin: "http://localhost" }, body: form });
}
function upstream(data: unknown, status = 200) {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(envelope(data), { status }));
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
async function expectError(response: Response, status: number, code?: string) {
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  const body = await response.json();
  expect(body).toMatchObject({ success: false, data: null, error: { code: code ?? expect.any(String), message: expect.any(String) }, request_id: expect.any(String) });
  return body;
}

beforeEach(() => { vi.mocked(getSessionToken).mockResolvedValue("private-session"); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("private image-to-prompt BFF", () => {
  it("preserves the safe conversation-managed guard on legacy single-turn deletion", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ success: false, data: null, error: { code: "CONVERSATION_MANAGED", message: "private conversation details" }, request_id: "backend-1" }, { status: 409 })));
    const body = await expectError(await remove(incoming("DELETE"), context()), 409, "CONVERSATION_MANAGED");
    expect(JSON.stringify(body)).not.toContain("private conversation details");
  });
  it("requires a cookie session for every private method", async () => {
    vi.mocked(getSessionToken).mockResolvedValue(null);
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    for (const response of await Promise.all([
      upload(formRequest()), asset(incoming(), context(ASSET)), create(incoming("POST", { asset_id: ASSET }, { "idempotency-key": KEY })),
      history(incoming()), detail(incoming(), context()), edit(incoming("PATCH", { revision: 0, prompt: resultData.prompt }), context()),
      remove(incoming("DELETE"), context()),
    ])) await expectError(response, 401, "UNAUTHENTICATED");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each(["", "https://evil.example"])("rejects a write origin of %s", async (origin) => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expectError(await create(incoming("POST", { asset_id: ASSET }, { origin, "idempotency-key": KEY })), 403, "FORBIDDEN");
    await expectError(await edit(incoming("PATCH", { revision: 0, prompt: resultData.prompt }, { origin }), context()), 403);
    await expectError(await remove(incoming("DELETE", undefined, { origin }), context()), 403);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("authorizes the browser Host when Next uses an internal host", async () => {
    const fetcher = upstream(detailData, 202);
    const response = await create(incoming("POST", { asset_id: ASSET }, { origin: "https://aigc-prompt.com", host: "aigc-prompt.com", "x-forwarded-proto": "https", "idempotency-key": KEY }));
    expect(response.status).toBe(202);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("uploads one bounded file with server-only authorization", async () => {
    const fetcher = upstream({ ...assetData, internal_key: "must-not-leak" }, 201);
    vi.stubEnv("API_BASE_URL", "http://backend.example/");
    const response = await upload(formRequest());
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual(envelope(assetData));
    expect(fetcher).toHaveBeenCalledWith("http://backend.example/api/prompt-assets", expect.objectContaining({
      method: "POST", body: expect.any(FormData), headers: { Authorization: "Bearer private-session" }, redirect: "manual", cache: "no-store", signal: expect.any(AbortSignal),
    }));
  });

  it.each(["image/svg+xml", "text/plain"])("rejects unsupported upload type %s", async (type) => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expectError(await upload(formRequest(new File(["x"], "bad", { type }))), 415, "UNSUPPORTED_IMAGE");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects oversized, empty, extra and malformed multipart bodies", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expectError(await upload(formRequest(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.png", { type: "image/png" }))), 413);
    await expectError(await upload(formRequest(new File([], "empty.png", { type: "image/png" }))), 422);
    await expectError(await upload(formRequest(undefined, true)), 422);
    await expectError(await upload(new Request("http://localhost/api/prompt-assets", { method: "POST", headers: { origin: "http://localhost", "content-type": "multipart/form-data; boundary=bad" }, body: "bad" })), 422);
    await expectError(await upload(incoming("POST", {})), 415);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("streams the multipart bound even without Content-Length", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(5 * 1024 * 1024 + 65537)); controller.close(); } });
    const request = new Request("http://localhost/api/prompt-assets", { method: "POST", headers: { origin: "http://localhost", "content-type": "multipart/form-data; boundary=x" }, body, duplex: "half" } as RequestInit);
    await expectError(await upload(request), 413, "PAYLOAD_TOO_LARGE");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("refreshes an owned asset by a validated UUID", async () => {
    const fetcher = upstream(assetData);
    expect((await asset(incoming(), context(ASSET))).status).toBe(200);
    expect(fetcher.mock.calls[0][0]).toContain(`/api/prompt-assets/${ASSET}`);
    await expectError(await asset(incoming(), context("../admin")), 422);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it.each([200, 202])("preserves analysis create status %s and its idempotency key", async (status) => {
    const fetcher = upstream(detailData, status);
    const response = await create(incoming("POST", { asset_id: ASSET }, { "idempotency-key": KEY }));
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual(envelope(detailData));
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: "POST", body: JSON.stringify({ asset_id: ASSET }), headers: { Authorization: "Bearer private-session", "Content-Type": "application/json", "Idempotency-Key": KEY } });
  });

  it.each([
    [{ asset_id: ASSET }, ""], [{ asset_id: ASSET }, "invalid"], [{ asset_id: "bad" }, KEY],
    [{ asset_id: ASSET, url: "https://evil.example" }, KEY], [{}, KEY], [null, KEY],
  ])("rejects invalid create payload or idempotency key", async (body, key) => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expectError(await create(incoming("POST", body, { "idempotency-key": key })), 422);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects malformed, wrong-type and bounded JSON bodies", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const headers = { origin: "http://localhost", "content-type": "application/json", "idempotency-key": KEY };
    await expectError(await create(new Request("http://localhost/api/prompt-analyses", { method: "POST", headers, body: "{" })), 422);
    await expectError(await create(incoming("POST", { asset_id: ASSET }, { "idempotency-key": KEY, "content-type": "text/plain" })), 415);
    await expectError(await create(incoming("POST", { asset_id: "x".repeat(140000) }, { "idempotency-key": KEY })), 413);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("forwards bounded cursor history without carrying extra query parameters", async () => {
    const data = { items: [summaryData], pagination: { limit: 20, has_more: true, next_cursor: "next==" } };
    const fetcher = upstream(data);
    const response = await history(incoming("GET", undefined, {}, "/api/prompt-analyses?cursor=abc%2B%3D&limit=20&token=never"));
    expect(await response.json()).toEqual(envelope(data));
    expect(fetcher.mock.calls[0][0]).toMatch(/\/api\/prompt-analyses\?limit=20&cursor=abc%2B%3D$/);
  });

  it("accepts a backend history summary of 160 Unicode code points", async () => {
    const summary = { zh: "😊" + "猫".repeat(159), en: "😊" + "a".repeat(159) };
    const data = { items: [{ ...summaryData, summary }], pagination: { limit: 20, has_more: false, next_cursor: null } };
    upstream(data);
    const response = await history(incoming());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(envelope(data));
  });

  it("accepts a backend title of 80 Unicode code points", async () => {
    const title = "😊" + "猫".repeat(79);
    const data = { ...detailData, title, result: { ...resultData, title } };
    upstream(data);
    const response = await detail(incoming(), context());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(envelope(data));
  });

  it.each(["limit=0", "limit=51", "limit=1.5", "limit=1e1", "limit=", "limit=1&limit=2", `cursor=${"x".repeat(513)}`, "cursor=a&cursor=b"])("rejects invalid pagination %s", async (query) => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expectError(await history(incoming("GET", undefined, {}, `/api/prompt-analyses?${query}`)), 422);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("returns detail and can retain text after the image expires", async () => {
    const data = { ...detailData, image_available: false, preview_url: null, thumbnail_url: null, preview_expires_at: null };
    upstream(data);
    expect(await (await detail(incoming(), context())).json()).toEqual(envelope(data));
  });

  it("preserves the explicit temporarily unavailable preview state", async () => {
    const data = { ...detailData, preview_url: null, thumbnail_url: null, preview_expires_at: null, preview_status: "temporarily_unavailable" };
    upstream(data);
    expect(await (await detail(incoming(), context())).json()).toEqual(envelope(data));
  });

  it("forwards an edit with the existing revision and bilingual prompt", async () => {
    const fetcher = upstream({ ...detailData, revision: 1 });
    const body = { revision: 0, prompt: { zh: "新提示词", en: "New prompt" } };
    expect((await edit(incoming("PATCH", body), context())).status).toBe(200);
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: "PATCH", body: JSON.stringify(body) });
  });

  it("accepts emoji prompts at the backend Unicode character limits", async () => {
    const prompt = { zh: "😊".repeat(6000), en: "😊".repeat(12000) };
    const data = { ...detailData, prompt, revision: 1 };
    const fetcher = upstream(data);
    const response = await edit(incoming("PATCH", { revision: 0, prompt }), context());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(envelope(data));
    expect(fetcher.mock.calls[0][1]).toMatchObject({ body: JSON.stringify({ revision: 0, prompt }) });
  });

  it.each([
    { zh: "😊".repeat(6001), en: "cat" },
    { zh: "猫", en: "😊".repeat(12001) },
  ])("rejects emoji edits beyond the backend Unicode character limits", async (prompt) => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expectError(await edit(incoming("PATCH", { revision: 0, prompt }), context()), 422);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    { revision: -1, prompt: resultData.prompt }, { revision: 0.5, prompt: resultData.prompt },
    { revision: "0", prompt: resultData.prompt }, { revision: 0, prompt: { zh: " ", en: "cat" } },
    { revision: 0, prompt: { zh: "猫", en: " " } }, { revision: 0, prompt: { zh: "x".repeat(6001), en: "cat" } },
    { revision: 0, prompt: { zh: "猫", en: "x".repeat(12001) } }, { revision: 0, prompt: { ...resultData.prompt, internal: true } },
    { revision: 0, prompt: resultData.prompt, extra: true },
  ])("rejects invalid edits before forwarding", async (body) => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expectError(await edit(incoming("PATCH", body), context()), 422);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("deletes a UUID and returns a private empty 204", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 })); vi.stubGlobal("fetch", fetcher);
    const response = await remove(incoming("DELETE"), context());
    expect(response.status).toBe(204); expect(await response.text()).toBe("");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: "DELETE", redirect: "manual" });
    await expectError(await remove(incoming("DELETE"), context("bad")), 422);
    await expectError(await detail(incoming(), context("bad")), 422);
  });

  it.each([
    [409, "REVISION_CONFLICT"], [409, "IDEMPOTENCY_CONFLICT"], [409, "ANALYSIS_IN_PROGRESS"],
    [429, "QUOTA_EXCEEDED"], [429, "RATE_LIMITED"], [503, "MODEL_UNAVAILABLE"],
    [503, "QUEUE_FULL"], [503, "FEATURE_UNAVAILABLE"], [503, "STORAGE_UNAVAILABLE"],
    [404, "NOT_FOUND"], [422, "INVALID_CURSOR"],
  ])("preserves safe business code %s %s with a local message", async (status, code) => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(Response.json({ success: false, data: null, error: { code, message: "secret provider stack trace" }, request_id: "safe-id" }, { status })));
    const body = await expectError(await detail(incoming(), context()), status, code);
    expect(JSON.stringify(body)).not.toContain("secret"); expect(body.request_id).toBe("safe-id");
  });

  it.each([301, 302, 307, 500, 502, 504])("maps unsafe upstream status %s without leaking its body", async (status) => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response("secret database hostname", { status, headers: { location: "https://evil.example" } })));
    const body = await expectError(await detail(incoming(), context()), 502);
    expect(JSON.stringify(body)).not.toContain("secret");
  });

  it("sanitizes unknown error codes and upstream request IDs", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(Response.json({ success: false, error: { code: "secret-internal-error", message: "password" }, request_id: "<script>secret</script>" }, { status: 503 })));
    const body = await expectError(await detail(incoming(), context()), 503, "SERVICE_UNAVAILABLE");
    expect(body.request_id).toMatch(/^[a-zA-Z0-9_-]{1,128}$/);
    expect(JSON.stringify(body)).not.toMatch(/secret|password/);
  });

  it("maps a network failure to a safe private 503", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("secret TLS details")));
    await expectError(await detail(incoming(), context()), 503, "SERVICE_UNAVAILABLE");
  });

  it.each([
    { ...detailData, status: "invented" }, { ...detailData, revision: -1 }, { ...detailData, preview_url: "javascript:alert(1)" },
    { ...detailData, result: { ...resultData, schema_version: "2" } }, { ...detailData, result: { ...resultData, prompt: { zh: "", en: "cat" } } },
    { ...detailData, result: { ...resultData, uncertain_details: Array(9).fill("unknown") } },
  ])("rejects invalid upstream detail structures", async (data) => {
    upstream(data); await expectError(await detail(incoming(), context()), 502, "BAD_GATEWAY");
  });

  it("rejects invalid upstream envelopes and non-JSON content types", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ success: false, data: detailData, error: null }))
      .mockResolvedValueOnce(new Response(JSON.stringify(envelope(detailData)), { headers: { "content-type": "text/html" } }))
      .mockResolvedValueOnce(new Response("{", { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetcher);
    for (let i = 0; i < 3; i++) await expectError(await detail(incoming(), context()), 502);
  });

  it("bounds an upstream response stream without trusting Content-Length", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(1024 * 1024 + 1)); controller.close(); } }), { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetcher);
    await expectError(await detail(incoming(), context()), 502);
  });

  it("rejects a malformed success history instead of inventing empty data", async () => {
    upstream({ items: [detailData], pagination: { limit: 20, has_more: false, next_cursor: null } });
    await expectError(await history(incoming()), 502);
  });

  it("returns truthful public empty examples without authentication or a model call", async () => {
    vi.mocked(getSessionToken).mockResolvedValue(null);
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const response = await examples();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, data: { items: [] }, error: null, request_id: expect.any(String) });
    expect(response.headers.get("cache-control")).toBe("public, max-age=300");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
