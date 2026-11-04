import { afterEach, expect, it, vi } from "vitest";
import { getPromptDetail } from "@/lib/api/client";
import { GET } from "./route";

vi.mock("@/lib/api/client", () => ({ getPromptDetail: vi.fn() }));
afterEach(() => vi.resetAllMocks());

const id = "00000000-0000-4000-8000-000000000001";
const request = new Request("http://localhost/api/prompts/test");

it("returns only the public prompt text for a valid artwork id", async () => {
  vi.mocked(getPromptDetail).mockResolvedValue({ id, prompt_text: "原始提示词", author_name: "not included" } as Awaited<ReturnType<typeof getPromptDetail>>);
  const response = await GET(request, { params: Promise.resolve({ id }) });
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toEqual({ prompt_text: "原始提示词" });
  expect(getPromptDetail).toHaveBeenCalledExactlyOnceWith(id);
});

it("rejects an invalid id without calling the upstream", async () => {
  const response = await GET(request, { params: Promise.resolve({ id: "../other" }) });
  expect(response.status).toBe(400);
  expect(getPromptDetail).not.toHaveBeenCalled();
});

it("returns a generic error if the upstream fails", async () => {
  vi.mocked(getPromptDetail).mockRejectedValue(new Error("internal upstream details"));
  const response = await GET(request, { params: Promise.resolve({ id }) });
  expect(response.status).toBe(502);
  expect(await response.json()).toEqual({ error: "Failed to load prompt" });
});
