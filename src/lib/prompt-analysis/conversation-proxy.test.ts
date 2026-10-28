// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as list, POST as create } from "@/app/api/prompt-conversations/route";
import { GET as detail, DELETE as remove } from "@/app/api/prompt-conversations/[id]/route";
import { POST as send } from "@/app/api/prompt-conversations/[id]/messages/route";
import { POST as retry } from "@/app/api/prompt-conversations/[id]/retry/route";
import { POST as importReference } from "@/app/api/prompt-assets/from-prompt/route";
import { GET as analysis } from "@/app/api/prompt-analyses/[id]/route";
import { getSessionToken } from "@/lib/auth/session";

vi.mock("@/lib/auth/session", () => ({ getSessionToken: vi.fn(async () => "private-session") }));
const ID = "00000000-0000-4000-8000-000000000001";
const TURN = "00000000-0000-4000-8000-000000000002";
const ASSET = "00000000-0000-4000-8000-000000000003";
const KEY = "00000000-0000-4000-8000-000000000004";
const DATE = "2026-10-26T12:00:00+00:00";
const context = (id = ID) => ({ params: Promise.resolve({ id }) });
const turn = {
  id: TURN, asset_id: null, input_type: "text", idea_text: "一只猫", purpose: null, style: null,
  status: "succeeded", phase: "completed", revision: 0, created_at: DATE, finished_at: DATE,
  title: "一只猫", error_code: null, history_retain_until: DATE, image_available: false,
  preview_url: null, thumbnail_url: null, preview_expires_at: null,
  result: { schema_version: "1", title: "一只猫", prompt: { zh: "一只猫", en: "A cat" }, breakdown: Object.fromEntries(["subject", "composition", "lighting", "style"].map(key => [key, { zh: "", en: "" }])), uncertain_details: [] },
  prompt: { zh: "一只猫", en: "A cat" }, saved_to_history: true,
  conversation_id: ID, parent_analysis_id: null, user_message: "一只猫", version: 1,
};
const conversation = { id: ID, title: "一只猫", created_at: DATE, updated_at: DATE, turns: [turn] };
const summary = { id: ID, title: "一只猫", status: "succeeded", created_at: DATE, updated_at: DATE, latest_analysis_id: TURN, version: 1 };
const asset = { id: ASSET, width: 800, height: 600, byte_size: 1234, preview_url: "https://images.example.com/private", thumbnail_url: "https://images.example.com/thumb", preview_expires_at: DATE };
const envelope = (data: unknown) => ({ success: true, data, error: null, request_id: "backend-1" });
const incoming = (method = "GET", body?: unknown, headers: HeadersInit = {}, path = "/api/prompt-conversations") => new Request(`http://localhost${path}`, {
  method, headers: { origin: "http://localhost", "content-type": "application/json", ...headers },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
function upstream(data: unknown, status = 200) {
  const fetcher = vi.fn().mockImplementation(() => Promise.resolve(Response.json(envelope(data), { status })));
  vi.stubGlobal("fetch", fetcher); return fetcher;
}
async function expectError(response: Response, status: number, code?: string) {
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  const body = await response.json();
  expect(body).toMatchObject({ success: false, data: null, error: { code: code ?? expect.any(String), message: expect.any(String) } });
  return body;
}
beforeEach(() => vi.mocked(getSessionToken).mockResolvedValue("private-session"));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("private prompt conversation BFF", () => {
  it("forwards explicit auto/generate modes without accepting provider instructions", async () => {
    for (const mode of ["auto", "generate"]) {
      const fetcher = upstream(turn, 202);
      const body = { message: "  你好  ", mode };
      expect((await create(incoming("POST", body, { "idempotency-key": KEY }))).status).toBe(202);
      expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ message: "你好", mode });
    }
    for (const mode of [null, "system", "", 1]) {
      const fetcher = upstream(turn, 202);
      await expectError(await create(incoming("POST", { message: "你好", mode }, { "idempotency-key": KEY })), 422);
      expect(fetcher).not.toHaveBeenCalled();
    }
  });

  it("preserves bounded assistant text and strips unknown provider fields", async () => {
    const assistant = { ...turn, response_type: "assistant", assistant_reply: '<img src=x onerror="alert(1)">\n你好', prompt_number: null, prompt: null, result: null };
    upstream({ ...assistant, system_prompt: "private", raw_provider: { secret: "private" } });
    const response = await create(incoming("POST", { message: "你好" }, { "idempotency-key": KEY }));
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual(assistant);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("preserves mixed message history and distinct prompt numbering", async () => {
    const first = { ...turn, response_type: "assistant", assistant_reply: "你好，我可以帮你构思。", prompt_number: null, result: null, prompt: null };
    const second = { ...turn, id: ASSET, version: 2, parent_analysis_id: TURN, response_type: "prompt", assistant_reply: null, prompt_number: 1 };
    upstream({ ...conversation, turns: [first, second] });
    const response = await detail(incoming(), context());
    expect(response.status).toBe(200);
    expect((await response.json()).data.turns).toEqual([first, second]);
    const queued = { ...turn, status: "queued", phase: "queued", result: null, prompt: null, saved_to_history: false, response_type: null, assistant_reply: null, prompt_number: null };
    upstream(queued, 202);
    const pending = await create(incoming("POST", { message: "你好" }, { "idempotency-key": KEY }));
    expect(pending.status).toBe(202);
    expect((await pending.json()).data).toEqual(queued);
  });

  it.each([
    { response_type: "unknown" }, { assistant_reply: " " }, { assistant_reply: "字".repeat(4001) },
    { revision: 1 }, { saved_to_history: false }, { prompt: turn.prompt }, { result: turn.result },
    { prompt_number: 1 }, { status: "queued" }, { response_type: null },
  ])("rejects invalid assistant field combinations %j", async change => {
    upstream({ ...turn, response_type: "assistant", assistant_reply: "你好", prompt_number: null, result: null, prompt: null, ...change });
    await expectError(await create(incoming("POST", { message: "你好" }, { "idempotency-key": KEY })), 502, "BAD_GATEWAY");
  });

  it.each([
    { response_type: "prompt", assistant_reply: null, prompt_number: 0 },
    { response_type: "prompt", assistant_reply: "不能混合", prompt_number: 1 },
    { response_type: null, assistant_reply: null, prompt_number: null },
    { response_type: "assistant" },
  ])("rejects unknown or incomplete new response metadata %j", async change => {
    upstream({ ...turn, ...change });
    await expectError(await create(incoming("POST", { message: "你好" }, { "idempotency-key": KEY })), 502, "BAD_GATEWAY");
  });
  it("requires authentication on all private operations", async () => {
    vi.mocked(getSessionToken).mockResolvedValue(null);
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    for (const response of await Promise.all([
      list(incoming()), detail(incoming(), context()), remove(incoming("DELETE"), context()),
      create(incoming("POST", { message: "猫" }, { "idempotency-key": KEY })),
      send(incoming("POST", { message: "白天", parent_analysis_id: TURN, parent_revision: 0 }, { "idempotency-key": KEY }), context()),
      retry(incoming("POST", { analysis_id: TURN }, { "idempotency-key": KEY }), context()),
      importReference(incoming("POST", { prompt_id: ID })),
    ])) await expectError(response, 401, "UNAUTHENTICATED");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each(["POST", "DELETE"])("requires same-origin for conversation writes %s", async (method) => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const request = incoming(method, method === "POST" ? { message: "猫" } : undefined, { origin: "https://foreign.example", "idempotency-key": KEY });
    await expectError(await (method === "POST" ? create(request) : remove(request, context())), 403, "FORBIDDEN");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([200, 202])("creates text or combined image turns with exact private forwarding (%s)", async status => {
    const fetcher = upstream(turn, status);
    const response = await create(incoming("POST", { message: "  一只猫  " }, { "idempotency-key": KEY }));
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual(envelope(turn));
    expect(fetcher.mock.calls[0][0]).toMatch(/\/api\/prompt-conversations$/);
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: "POST", body: JSON.stringify({ message: "一只猫" }), cache: "no-store", redirect: "manual", headers: { Authorization: "Bearer private-session", "Idempotency-Key": KEY, "Content-Type": "application/json" } });
    const imageTurn = { ...turn, input_type: "image", asset_id: ASSET, idea_text: null };
    upstream(imageTurn, status);
    expect((await create(incoming("POST", { asset_id: ASSET, message: "保留构图" }, { "idempotency-key": KEY }))).status).toBe(status);
  });

  it("sends a follow-up with validated parent id and revision", async () => {
    const data = { ...turn, parent_analysis_id: TURN, version: 2 };
    const fetcher = upstream(data, 202);
    const body = { message: "白天", parent_analysis_id: TURN, parent_revision: 3 };
    const response = await send(incoming("POST", body, { "idempotency-key": KEY }), context());
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual(envelope(data));
    expect(fetcher.mock.calls[0][0]).toContain(`/api/prompt-conversations/${ID}/messages`);
    expect(fetcher.mock.calls[0][1].body).toBe(JSON.stringify(body));
  });

  it("retries an identified turn without accepting browser-supplied context", async () => {
    const fetcher = upstream({ ...turn, parent_analysis_id: TURN, version: 2 }, 202);
    expect((await retry(incoming("POST", { analysis_id: TURN }, { "idempotency-key": KEY }), context())).status).toBe(202);
    expect(fetcher.mock.calls[0][0]).toContain(`/api/prompt-conversations/${ID}/retry`);
    expect(fetcher.mock.calls[0][1].body).toBe(JSON.stringify({ analysis_id: TURN }));
    for (const body of [{ analysis_id: "bad" }, { analysis_id: TURN, message: "new context" }, {}]) await expectError(await retry(incoming("POST", body, { "idempotency-key": KEY }), context()), 422);
    await expectError(await retry(incoming("POST", { analysis_id: TURN }), context()), 422, "INVALID_IDEMPOTENCY_KEY");
    await expectError(await retry(incoming("POST", { analysis_id: TURN }, { "idempotency-key": KEY }), context("bad")), 422);
    await expectError(await retry(incoming("POST", { analysis_id: TURN }, { "origin": "https://foreign.example", "idempotency-key": KEY }), context()), 403);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it.each([
    {}, { message: " " }, { message: "猫".repeat(501) }, { message: 1 }, { asset_id: "bad" },
    { message: "猫", source_url: "https://untrusted.example" }, { message: "猫", parent_analysis_id: TURN },
  ])("rejects unsupported create input %j", async body => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expectError(await create(incoming("POST", body, { "idempotency-key": KEY })), 422);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    { message: "猫" }, { message: "猫", parent_analysis_id: "bad", parent_revision: 0 },
    { message: "猫", parent_analysis_id: TURN, parent_revision: -1 },
    { message: "猫", parent_analysis_id: TURN, parent_revision: 1.5 },
    { message: "猫", parent_analysis_id: TURN, parent_revision: 0, context: "client-supplied" },
  ])("rejects invalid follow-up input %j", async body => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expectError(await send(incoming("POST", body, { "idempotency-key": KEY }), context()), 422);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("validates keys, media types, body bounds and ids before forwarding", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expectError(await create(incoming("POST", { message: "猫" })), 422, "INVALID_IDEMPOTENCY_KEY");
    await expectError(await create(incoming("POST", { message: "猫" }, { "idempotency-key": KEY, "content-type": "text/plain" })), 415);
    await expectError(await create(incoming("POST", { message: "x".repeat(140000) }, { "idempotency-key": KEY })), 413);
    await expectError(await detail(incoming(), context("../admin")), 422);
    await expectError(await remove(incoming("DELETE"), context("bad")), 422);
    await expectError(await send(incoming("POST", { message: "猫" }, { "idempotency-key": KEY }), context("bad")), 422);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("returns detailed versioned history without credentials or unknown upstream fields", async () => {
    upstream({ ...conversation, secret: "private", turns: [{ ...turn, credential: "private" }] });
    const response = await detail(incoming(), context());
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual(envelope(conversation));
  });

  it("allows valid bounded conversation history larger than the legacy 1MiB response cap", async () => {
    const prompt = { zh: "猫".repeat(6000), en: "a".repeat(12000) };
    const turns = Array.from({ length: 24 }, (_, index) => ({ ...turn, id: `00000000-0000-4000-8000-${String(index + 100).padStart(12, "0")}`, version: index + 1, result: { ...turn.result, prompt }, prompt }));
    const data = { ...conversation, turns };
    const serialized = JSON.stringify(envelope(data));
    expect(new TextEncoder().encode(serialized).byteLength).toBeGreaterThan(1024 * 1024);
    upstream(data);
    const response = await detail(incoming(), context());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.turns).toHaveLength(24);
    expect(body.data.turns[23].version).toBe(24);
    expect(body.data.turns[23].prompt.zh).toHaveLength(6000);
  });

  it("rejects oversized conversation response Content-Length before reading it", async () => {
    let read = false, canceled = false;
    const stream = new ReadableStream<Uint8Array>({ pull(controller) { read = true; controller.close(); }, cancel() { canceled = true; } }, { highWaterMark: 0 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(stream, { headers: { "content-type": "application/json", "content-length": String(32 * 1024 * 1024 + 1) } })));
    await expectError(await detail(incoming(), context()), 502, "BAD_GATEWAY");
    expect(read).toBe(false);
    expect(canceled).toBe(true);
  });

  it("enforces conversation response bounds while streaming without Content-Length", async () => {
    let canceled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new Uint8Array(32 * 1024 * 1024 + 1)); },
      cancel() { canceled = true; },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(stream, { headers: { "content-type": "application/json" } })));
    await expectError(await detail(incoming(), context()), 502, "BAD_GATEWAY");
    expect(canceled).toBe(true);
  });

  it("keeps the smaller response limit for conversation lists", async () => {
    const body = JSON.stringify(envelope({ padding: "x".repeat(1024 * 1024 + 1) }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { headers: { "content-type": "application/json" } })));
    await expectError(await list(incoming()), 502, "BAD_GATEWAY");
  });

  it("lists bounded cursor history and forwards only safe pagination", async () => {
    const data = { items: [summary], pagination: { limit: 20, has_more: true, next_cursor: "next==" } };
    const fetcher = upstream(data);
    expect(await (await list(incoming("GET", undefined, {}, "/api/prompt-conversations?cursor=a%2B%3D&limit=20&token=never"))).json()).toEqual(envelope(data));
    expect(fetcher.mock.calls[0][0]).toMatch(/\/api\/prompt-conversations\?limit=20&cursor=a%2B%3D$/);
  });

  it.each(["limit=0", "limit=51", "limit=1.5", "limit=1&limit=2", "cursor=a&cursor=b", `cursor=${"x".repeat(513)}`])("rejects invalid conversation history query %s", async query => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expectError(await list(incoming("GET", undefined, {}, `/api/prompt-conversations?${query}`)), 422);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("deletes all turns via the owned conversation endpoint", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 })); vi.stubGlobal("fetch", fetcher);
    const response = await remove(incoming("DELETE"), context());
    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(fetcher.mock.calls[0][0]).toContain(`/api/prompt-conversations/${ID}`);
    expect(fetcher.mock.calls[0][1].method).toBe("DELETE");
  });

  it("imports a gallery image by a controlled public prompt id only", async () => {
    const fetcher = upstream(asset, 201);
    expect(await (await importReference(incoming("POST", { prompt_id: ID }))).json()).toEqual(envelope(asset));
    expect(fetcher.mock.calls[0][0]).toMatch(/\/api\/prompt-assets\/from-prompt$/);
    expect(fetcher.mock.calls[0][1].body).toBe(JSON.stringify({ prompt_id: ID }));
    for (const body of [{ prompt_id: "bad" }, { prompt_id: ID, url: "https://untrusted.example" }, { url: "https://untrusted.example" }]) await expectError(await importReference(incoming("POST", body)), 422);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("keeps a gallery source rejection actionable while sanitizing unavailable storage", async () => {
    const fetcher = vi.fn().mockImplementationOnce(() => Promise.resolve(Response.json({ success: false, data: null, error: { code: "SOURCE_IMAGE_UNAVAILABLE", message: "private object key" }, request_id: "backend-1" }, { status: 422 })))
      .mockImplementationOnce(() => Promise.resolve(Response.json({ success: false, data: null, error: { code: "STORAGE_UNAVAILABLE", message: "private storage host" }, request_id: "backend-1" }, { status: 503 })));
    vi.stubGlobal("fetch", fetcher);
    await expectError(await importReference(incoming("POST", { prompt_id: ID })), 422, "SOURCE_IMAGE_UNAVAILABLE");
    await expectError(await importReference(incoming("POST", { prompt_id: ID })), 503, "STORAGE_UNAVAILABLE");
  });

  it.each(["PARENT_REVISION_CONFLICT", "CONVERSATION_CHANGED", "NOT_RETRYABLE", "CONVERSATION_UNKNOWN"])("preserves safe conflict code %s without leaking backend messages", async code => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ success: false, data: null, error: { code, message: "private content" }, request_id: "backend-1" }, { status: 409 })));
    const body = await expectError(await send(incoming("POST", { message: "白天", parent_analysis_id: TURN, parent_revision: 0 }, { "idempotency-key": KEY }), context()), 409, code);
    expect(JSON.stringify(body)).not.toContain("private content");
  });

  it("preserves the bounded conversation limit without forwarding backend details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ success: false, data: null, error: { code: "CONVERSATION_LIMIT", message: "private content" }, request_id: "backend-1" }, { status: 429 })));
    await expectError(await create(incoming("POST", { message: "cat" }, { "idempotency-key": KEY })), 429, "CONVERSATION_LIMIT");
  });

  it.each(["framework", "html"])("reports a missing upstream route as service unavailable, not an expired record (%s)", async format => {
    const missingRoute = () => format === "framework"
      ? Response.json({ detail: "Not Found", internal: "private deployment path" }, { status: 404 })
      : new Response("<html>private gateway route</html>", { status: 404, headers: { "content-type": "text/html" } });
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(missingRoute())));
    for (const response of await Promise.all([
      create(incoming("POST", { message: "cat" }, { "idempotency-key": KEY })),
      list(incoming()), detail(incoming(), context()),
      importReference(incoming("POST", { prompt_id: ID })),
    ])) {
      const body = await expectError(response, 503, "SERVICE_UNAVAILABLE");
      expect(JSON.stringify(body)).not.toContain("private");
    }
  });

  it("preserves an explicit missing-record response from the conversation service", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ success: false, data: null, error: { code: "NOT_FOUND", message: "private record" }, request_id: "backend-1" }, { status: 404 })));
    await expectError(await detail(incoming(), context()), 404, "NOT_FOUND");
  });

  it.each([
    { ...conversation, turns: [{ ...turn, version: 0 }] },
    { ...conversation, turns: [{ ...turn, conversation_id: "bad" }] },
    { ...conversation, turns: [{ ...turn, conversation_id: ASSET }] },
    { ...conversation, turns: Array.from({ length: 101 }, () => turn) },
    { ...conversation, turns: [{ ...turn, user_message: "x".repeat(501) }] },
    { ...conversation, turns: [{ ...turn, asset_id: ASSET, input_type: "text" }] },
    { ...conversation, turns: [{ ...turn, prompt: { zh: "cat" } }] },
  ])("rejects malformed private upstream results", async data => {
    upstream(data);
    await expectError(await detail(incoming(), context()), 502, "BAD_GATEWAY");
  });

  it("preserves text inputs and conversation metadata when editing or polling legacy analysis route", async () => {
    upstream(turn);
    expect(await (await analysis(incoming(), context(TURN))).json()).toEqual(envelope(turn));
  });
});
