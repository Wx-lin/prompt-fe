import { expect, it, vi, afterEach } from "vitest";
import { GET } from "./route";
import { getPromptFeed, searchPrompts } from "@/lib/api/client";
vi.mock("@/lib/api/client", () => ({ getPromptFeed: vi.fn().mockResolvedValue({items: []}), searchPrompts: vi.fn().mockResolvedValue({items: []}) }));
afterEach(() => vi.clearAllMocks());
it("uses recommended for feed pages and latest for search pages", async () => {
  await GET(new Request("http://test/api/prompts?page=2"));
  expect(getPromptFeed).toHaveBeenCalledWith(expect.objectContaining({ sort: "recommended", page: 2 }));
  await GET(new Request("http://test/api/prompts?q=cat&page=3"));
  expect(searchPrompts).toHaveBeenCalledWith("cat", expect.objectContaining({ sort: "latest", page: 3 }));
});
it("forwards explicit recommended ordering after all search filters", async () => {
  await GET(new Request("http://test/api/prompts?q=cat&sort=recommended&category=art&models=FLUX&page=2"));
  expect(searchPrompts).toHaveBeenCalledWith("cat", { sort: "recommended", category: "art", model: "FLUX", page: 2, pageSize: 20 });
});
