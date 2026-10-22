import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, promptAnalysisClient, PROMPT_LIMITS } from "./client";

afterEach(() => vi.unstubAllGlobals());
const ok = (data: unknown, status = 200) => Response.json({ success: true, data, error: null, request_id: "request" }, { status });
const image = () => new File(["image"], "one.png", { type: "image/png" });

describe("prompt analysis browser client", () => {
  it("uploads multipart without setting its boundary and uses same-origin private requests", async () => {
    const fetcher = vi.fn().mockResolvedValue(ok({ id: "asset" }));
    vi.stubGlobal("fetch", fetcher);
    const file = image();
    await promptAnalysisClient.upload(file);
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe("/api/prompt-assets");
    expect(options.body.get("file")).toBe(file);
    expect(options.headers.get("Content-Type")).toBeNull();
    expect(options).toMatchObject({ method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error", referrerPolicy: "no-referrer" });
  });

  it("preserves idempotency keys and edit revisions exactly", async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(ok({ id: "job" }, 202)));
    vi.stubGlobal("fetch", fetcher);
    const signal = new AbortController().signal;
    await promptAnalysisClient.create("asset", "same-key", signal);
    expect(fetcher.mock.calls[0]).toEqual(["/api/prompt-analyses", expect.objectContaining({ method: "POST", signal, body: JSON.stringify({ asset_id: "asset" }) })]);
    expect(fetcher.mock.calls[0][1].headers.get("Idempotency-Key")).toBe("same-key");
    await promptAnalysisClient.update("job", 4, { zh: "中文", en: "English" }, signal);
    expect(fetcher.mock.calls[1]).toEqual(["/api/prompt-analyses/job", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ revision: 4, prompt: { zh: "中文", en: "English" } }) })]);
  });

  it("reads fresh detail/history and accepts deletion without a JSON body", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(ok({ id: "job" })).mockResolvedValueOnce(ok({ items: [] })).mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetcher);
    await promptAnalysisClient.detail("job");
    await promptAnalysisClient.history("a+/=");
    await promptAnalysisClient.remove("job");
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual(["/api/prompt-analyses/job", "/api/prompt-analyses?limit=20&cursor=a%2B%2F%3D", "/api/prompt-analyses/job"]);
    expect(fetcher.mock.calls[2][1].method).toBe("DELETE");
  });

  it.each([401, 409, 429, 503])("returns safe status/code without exposing upstream messages for %s", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(Response.json({ success: false, data: null, error: { code: "REVISION_CONFLICT", message: "secret provider body" }, request_id: "trace" }, { status }))));
    await expect(promptAnalysisClient.detail("job")).rejects.toMatchObject({ status, code: "REVISION_CONFLICT" });
    await expect(promptAnalysisClient.detail("job")).rejects.not.toHaveProperty("message", "secret provider body");
  });

  it("reports network, malformed JSON and malformed envelopes as safe errors", async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new TypeError("secret host"))
      .mockResolvedValueOnce(new Response("private html", { status: 502 }))
      .mockResolvedValueOnce(Response.json({ success: true }))
      .mockResolvedValueOnce(Response.json({ success: false, error: { code: "private credential string" } }, { status: 500 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(promptAnalysisClient.detail("job")).rejects.toMatchObject({ status: 0, code: "NETWORK_ERROR" });
    await expect(promptAnalysisClient.detail("job")).rejects.toMatchObject({ status: 502, code: "REQUEST_FAILED" });
    await expect(promptAnalysisClient.detail("job")).rejects.toMatchObject({ status: 200, code: "INVALID_RESPONSE" });
    await expect(promptAnalysisClient.detail("job")).rejects.toMatchObject({ status: 500, code: "REQUEST_FAILED" });
  });

  it("validates file bytes/type and prompt limits before any request", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(promptAnalysisClient.upload(new File(["x"], "bad.svg", { type: "image/svg+xml" }))).rejects.toMatchObject({ code: "INVALID_IMAGE" });
    await expect(promptAnalysisClient.upload(new File([], "empty.png", { type: "image/png" }))).rejects.toBeInstanceOf(ApiError);
    await expect(promptAnalysisClient.update("job", 0, { zh: " ", en: "valid" })).rejects.toMatchObject({ code: "INVALID_PROMPT" });
    await expect(promptAnalysisClient.update("job", 0, { zh: "x".repeat(PROMPT_LIMITS.zh + 1), en: "valid" })).rejects.toMatchObject({ code: "INVALID_PROMPT" });
    await expect(promptAnalysisClient.update("job", 0, { zh: "valid", en: "x".repeat(PROMPT_LIMITS.en + 1) })).rejects.toMatchObject({ code: "INVALID_PROMPT" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("leaves request cancellation recognizable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("Aborted", "AbortError")));
    await expect(promptAnalysisClient.detail("job")).rejects.toHaveProperty("name", "AbortError");
  });

  it("counts Unicode codepoints like the server at both prompt limits", async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(ok({ id: "job" })));
    vi.stubGlobal("fetch", fetcher);
    await promptAnalysisClient.update("job", 0, { zh: "🌏".repeat(6000), en: "🌏".repeat(12000) });
    expect(fetcher).toHaveBeenCalledOnce();
    await expect(promptAnalysisClient.update("job", 0, { zh: "🌏".repeat(6001), en: "valid" })).rejects.toMatchObject({ code: "INVALID_PROMPT" });
  });
});
