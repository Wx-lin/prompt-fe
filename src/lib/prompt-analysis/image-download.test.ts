// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { GET } from "@/app/api/prompt-conversations/[id]/images/[imageId]/download/route";
import { getSessionToken } from "@/lib/auth/session";
vi.mock("@/lib/auth/session", () => ({ getSessionToken: vi.fn(async () => "private-token") }));
const id = "00000000-0000-4000-8000-000000000001";
const imageId = "00000000-0000-4000-8000-000000000002";
const context = { params: Promise.resolve({ id, imageId }) };
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it("downloads only an owned image through the fixed backend path", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response("png", { status: 200, headers: { "content-type": "image/png" } }));
  vi.stubGlobal("fetch", fetcher);
  const response = await GET(new Request("http://localhost/download"), context);
  expect(response.status).toBe(200);
  expect(response.headers.get("content-disposition")).toContain("attachment");
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(fetcher.mock.calls[0][0]).toContain(`/api/prompt-conversations/${id}/images/${imageId}/download`);
  expect(fetcher.mock.calls[0][1].headers.Authorization).toBe("Bearer private-token");
});
it("rejects unauthenticated and unsafe image downloads", async () => {
  vi.mocked(getSessionToken).mockResolvedValueOnce(null);
  expect((await GET(new Request("http://localhost/download"), context)).status).toBe(401);
  const fetcher = vi.fn().mockResolvedValue(new Response("oops", { headers: { "content-type": "text/html" } }));
  vi.stubGlobal("fetch", fetcher);
  expect((await GET(new Request("http://localhost/download"), context)).status).toBe(502);
});
