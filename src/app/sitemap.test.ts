import { beforeEach, expect, it, vi } from "vitest";
import sitemap from "./sitemap";
const api = vi.hoisted(() => ({ getPromptFeed: vi.fn(), getCategories: vi.fn() }));
vi.mock("@/lib/api/client", () => api);
beforeEach(() => { vi.clearAllMocks(); api.getCategories.mockResolvedValue([{ key: "avatar", count: 2 }]); });
it("includes more than 250 works, only populated categories and stable latest ordering", async () => {
  api.getPromptFeed.mockImplementation(async ({ page }) => ({ items: Array.from({ length: 50 }, (_, i) => ({ id: `${page}-${i}`, created_at: "2026-10-16" })), has_more: page < 6 }));
  const entries = await sitemap();
  expect(entries.filter(item => item.url.includes("/prompt/"))).toHaveLength(600);
  expect(entries.some(item => item.url.endsWith("/category/avatar"))).toBe(true);
  expect(api.getPromptFeed).toHaveBeenCalledWith({ page: 6, pageSize: 50, sort: "latest" });
});
it("rejects failed upstream requests instead of caching an incomplete sitemap", async () => {
  api.getPromptFeed.mockRejectedValue(new Error("offline"));
  await expect(sitemap()).rejects.toThrow("offline");
});
it("rejects non-progressing pagination", async () => {
  api.getPromptFeed.mockResolvedValue({ items: [{ id: "same", created_at: "2026-10-16" }], has_more: true });
  await expect(sitemap()).rejects.toThrow("pagination");
});
