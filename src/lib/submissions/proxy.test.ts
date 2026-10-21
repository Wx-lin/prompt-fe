// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { POST, GET } from "@/app/api/submissions/route";
import { POST as upload } from "@/app/api/submissions/upload/route";
import { fallbackCategories, legacyCategoryKeys } from "@/features/gallery/data/categories";
vi.mock("@/lib/auth/session", () => ({ getSessionToken: vi.fn(async () => "secret-session") }));
import { getSessionToken } from "@/lib/auth/session";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const request = (body: unknown, origin = "http://localhost") => new Request("http://localhost/api/submissions", {
  method: "POST",
  headers: { origin, "content-type": "application/json" },
  body: JSON.stringify(body)
});

const submission = {
  title: "假如你家毛孩子也要上班",
  prompt_text: "一只正在花店工作的猫咪",
  description: "",
  models: ["GPT Image 2.0"],
  upload_ids: ["00000000-0000-4000-8000-000000000001"]
};

it.each(fallbackCategories)("forwards submissions in the current $key category", async ({ key }) => {
  const body = { ...submission, category: key };
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ id: "work-1" }, { status: 201 }));
  vi.stubGlobal("fetch", fetcher);

  expect((await POST(request(body))).status).toBe(201);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][1]).toMatchObject({ body: JSON.stringify(body) });
});

it.each([...legacyCategoryKeys, "all", "unknown"])("rejects the non-current %s category before forwarding", async (category) => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);

  expect((await POST(request({ ...submission, category }))).status).toBe(400);
  expect(fetcher).not.toHaveBeenCalled();
});

it("rejects missing or cross-site origin before upstream calls", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  expect((await POST(request({}, "https://evil.example"))).status).toBe(403);
  expect((await POST(request({}, ""))).status).toBe(403);
  expect(fetcher).not.toHaveBeenCalled();
});

it("requires a session for reads and writes", async () => {
  vi.mocked(getSessionToken).mockResolvedValueOnce(null).mockResolvedValueOnce(null);
  expect((await POST(request({}))).status).toBe(401);
  expect((await GET(new Request("http://localhost/api/submissions"))).status).toBe(401);
});

it("rejects unbounded JSON and invalid payloads", async () => {
  expect((await POST(request({ title: "x".repeat(140000) }))).status).toBe(413);
  expect((await POST(request({ title: "hello" }))).status).toBe(400);
});

it("forwards the cookie token without returning private upstream errors", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ detail: "private database error" }), { status: 500 }));
  vi.stubGlobal("fetch", fetcher);
  const result = await POST(request({
    title: "hello",
    prompt_text: "a cat",
    description: "",
    category: "illustration",
    models: ["Midjourney V7"],
    upload_ids: ["00000000-0000-4000-8000-000000000001"]
  }));
  expect(result.status).toBe(502);
  expect(await result.text()).not.toContain("database");
  expect(fetcher.mock.calls[0][1]).toMatchObject({ headers: expect.objectContaining({ Authorization: "Bearer secret-session" }), cache: "no-store" });
});

it("rejects SVG uploads", async () => {
  const form = new FormData();
  form.append("file", new File(["<svg/>"], "bad.svg", { type: "image/svg+xml" }));
  expect((await upload(new Request("http://localhost/api/submissions/upload", {
    method: "POST",
    headers: { origin: "http://localhost" },
    body: form
  }))).status).toBe(400);
});

it("forwards a valid upload and returns its public response without a token", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ id: "upload-1", image_url: "https://example.com/private.png" }));
  vi.stubGlobal("fetch", fetcher);
  const form = new FormData();
  form.append("file", new File(["png"], "good.png", { type: "image/png" }));
  const result = await upload(new Request("http://localhost/api/submissions/upload", {
    method: "POST",
    headers: { origin: "http://localhost" },
    body: form
  }));
  expect(result.status).toBe(200);
  expect(await result.text()).not.toContain("secret-session");
  expect(fetcher.mock.calls[0][1]).toMatchObject({ body: expect.any(FormData), headers: { Authorization: "Bearer secret-session" } });
});

it("rejects oversized uploads and invalid pagination without fetching upstream", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const body = new FormData();
  body.append("file", new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.png", { type: "image/png" }));
  expect((await upload(new Request("http://localhost/api/submissions/upload", {
    method: "POST",
    headers: { origin: "http://localhost" },
    body
  }))).status).toBe(400);
  expect((await GET(new Request("http://localhost/api/submissions?page_size=100000"))).status).toBe(400);
  expect(fetcher).not.toHaveBeenCalled();
});

it("accepts the browser origin when Next uses an internal URL host", async () => {
  const { authorize } = await import("@/lib/submissions/proxy");
  const request = new Request("http://localhost:3110/api/submissions/upload", { method: "POST", headers: { host: "127.0.0.1:3110", origin: "http://127.0.0.1:3110" } });
  expect(await authorize(request)).toBe("secret-session");
});
