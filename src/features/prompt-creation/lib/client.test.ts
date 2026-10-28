import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/features/image-to-prompt/lib/client";
import { promptConversationClient } from "./client";

const ID = "00000000-0000-4000-8000-000000000001";
const PARENT = "00000000-0000-4000-8000-000000000002";
const ASSET = "00000000-0000-4000-8000-000000000003";
const KEY = "00000000-0000-4000-8000-000000000004";
const ok = (data: unknown, status = 200) => Response.json({ success: true, data, error: null, request_id: "request" }, { status });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("private prompt conversation browser client", () => {
  it("preserves explicit response modes and rejects unknown modes before fetching", async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(ok({ id: ID }, 202)));
    vi.stubGlobal("fetch", fetcher);
    await promptConversationClient.create({ message: "  你好  ", mode: "auto" }, KEY);
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ message: "你好", mode: "auto" });
    await promptConversationClient.send(ID, { message: "生成上面的想法", mode: "generate", parent_analysis_id: PARENT, parent_revision: 0 }, KEY);
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ message: "生成上面的想法", mode: "generate", parent_analysis_id: PARENT, parent_revision: 0 });
    await expect(promptConversationClient.create({ message: "你好", mode: "system" } as never, KEY)).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("creates text, image and combined turns with a stable idempotency key", async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(ok({ id: PARENT }, 202)));
    vi.stubGlobal("fetch", fetcher);
    const signal = new AbortController().signal;
    for (const input of [{ message: "雨夜的小猫" }, { asset_id: ASSET }, { message: "保留构图", asset_id: ASSET }]) {
      await promptConversationClient.create(input, KEY, signal);
      const [path, options] = fetcher.mock.calls.at(-1)!;
      expect(path).toBe("/api/prompt-conversations");
      expect(options).toMatchObject({ method: "POST", signal, body: JSON.stringify(input), credentials: "same-origin", cache: "no-store", redirect: "error", referrerPolicy: "no-referrer" });
      expect(options.headers.get("Idempotency-Key")).toBe(KEY);
    }
  });

  it("sends a refinement tied to its exact parent and revision", async () => {
    const fetcher = vi.fn().mockResolvedValue(ok({ id: "next" }, 202));
    vi.stubGlobal("fetch", fetcher);
    const input = { message: "改成白天", parent_analysis_id: PARENT, parent_revision: 3 };
    await promptConversationClient.send(ID, input, KEY);
    expect(fetcher.mock.calls[0]).toEqual([`/api/prompt-conversations/${ID}/messages`, expect.objectContaining({ method: "POST", body: JSON.stringify(input) })]);
    expect(fetcher.mock.calls[0][1].headers.get("Idempotency-Key")).toBe(KEY);
  });

  it("retries the latest failed turn with its own analysis id and a fresh key", async () => {
    const fetcher = vi.fn().mockResolvedValue(ok({ id: "next" }, 202));
    vi.stubGlobal("fetch", fetcher);
    await promptConversationClient.retry(ID, PARENT, KEY);
    expect(fetcher.mock.calls[0]).toEqual([`/api/prompt-conversations/${ID}/retry`, expect.objectContaining({ method: "POST", body: JSON.stringify({ analysis_id: PARENT }) })]);
    expect(fetcher.mock.calls[0][1].headers.get("Idempotency-Key")).toBe(KEY);
    await expect(promptConversationClient.retry(ID, "bad", KEY)).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("loads private detail/history with escaped cursors and deletes a whole conversation", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(ok({ id: ID, turns: [] })).mockResolvedValueOnce(ok({ items: [] })).mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetcher);
    await promptConversationClient.detail(ID);
    await promptConversationClient.history("a+/=");
    await promptConversationClient.remove(ID);
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([`/api/prompt-conversations/${ID}`, "/api/prompt-conversations?limit=20&cursor=a%2B%2F%3D", `/api/prompt-conversations/${ID}`]);
    expect(fetcher.mock.calls[2][1].method).toBe("DELETE");
  });

  it("uploads a local image and imports only a public prompt id", async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(ok({ id: ASSET }, 201)));
    vi.stubGlobal("fetch", fetcher);
    const file = new File(["image"], "source.png", { type: "image/png" });
    await promptConversationClient.upload(file);
    expect(fetcher.mock.calls[0][0]).toBe("/api/prompt-assets");
    expect(fetcher.mock.calls[0][1].body.get("file")).toBe(file);
    await promptConversationClient.importReference(ID);
    expect(fetcher.mock.calls[1]).toEqual(["/api/prompt-assets/from-prompt", expect.objectContaining({ method: "POST", body: JSON.stringify({ prompt_id: ID }) })]);
  });

  it("normalizes trimmed input and counts Unicode code points", async () => {
    const fetcher = vi.fn().mockResolvedValue(ok({ id: ID }));
    vi.stubGlobal("fetch", fetcher);
    await promptConversationClient.create({ message: `  ${"😊".repeat(500)}  ` }, KEY);
    expect(JSON.parse(fetcher.mock.calls[0][1].body).message).toHaveLength(1000);
    await expect(promptConversationClient.create({ message: "😊".repeat(501) }, KEY)).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(promptConversationClient.create({ message: "  " }, KEY)).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("rejects empty input, invalid identifiers and unsupported revision before a network request", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expect(promptConversationClient.create({}, KEY)).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(promptConversationClient.create({ message: 7 } as never, KEY)).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(promptConversationClient.create({ asset_id: "https://untrusted.example/image.png" }, KEY)).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(promptConversationClient.create({ message: "valid" }, "bad")).rejects.toMatchObject({ code: "INVALID_IDEMPOTENCY_KEY" });
    await expect(promptConversationClient.send(ID, { message: "valid", parent_analysis_id: PARENT, parent_revision: -1 }, KEY)).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(promptConversationClient.send("../admin", { message: "valid", parent_analysis_id: PARENT, parent_revision: 0 }, KEY)).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(promptConversationClient.detail("../admin")).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(promptConversationClient.remove("bad")).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(promptConversationClient.importReference("https://untrusted.example")).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([401, 409, 429, 503])("returns safe structured errors without forwarding private details for %s", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ success: false, error: { code: "PARENT_REVISION_CONFLICT", message: "private provider body" } }, { status })));
    await expect(promptConversationClient.detail(ID)).rejects.toMatchObject({ status, code: "PARENT_REVISION_CONFLICT", message: "The request could not be completed." });
  });

  it("handles malformed envelopes, network failures and aborts without losing their meaning", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ success: true }))
      .mockResolvedValueOnce(new Response("private upstream HTML", { status: 502 }))
      .mockRejectedValueOnce(new TypeError("private host"))
      .mockRejectedValueOnce(new DOMException("Aborted", "AbortError"));
    vi.stubGlobal("fetch", fetcher);
    await expect(promptConversationClient.detail(ID)).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    await expect(promptConversationClient.detail(ID)).rejects.toBeInstanceOf(ApiError);
    await expect(promptConversationClient.detail(ID)).rejects.toMatchObject({ status: 0, code: "NETWORK_ERROR" });
    await expect(promptConversationClient.detail(ID)).rejects.toHaveProperty("name", "AbortError");
  });
});
