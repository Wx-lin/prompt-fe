import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Home from "./page";
const api = vi.hoisted(() => ({
  getCategories: vi.fn(), getModels: vi.fn(), getPromptFeed: vi.fn(), searchPrompts: vi.fn(),
}));
vi.mock("@/lib/api/client", () => api);
vi.mock("@/lib/auth/session", () => ({ getSessionUser: async () => null }));
vi.mock("next-intl/server", () => ({ setRequestLocale: vi.fn() }));
vi.mock("@/features/gallery/components/gallery-page", () => ({ GalleryPage: () => null }));
beforeEach(() => {
  api.getCategories.mockResolvedValue([]);
  api.getPromptFeed.mockResolvedValue({ items: [], has_more: false });
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
it("uses the shared catalog with full versions in production", async () => {
  vi.stubEnv("NODE_ENV", "production");
  const models = [{ key: "Midjourney V7", label: "Midjourney V7", group: "Midjourney" }];
  api.getModels.mockResolvedValue(models);
  const page = await Home({ params: Promise.resolve({ locale: "zh" }), searchParams: Promise.resolve({}) });
  expect(page.props.models).toEqual(models);
  expect(api.getModels).toHaveBeenCalledTimes(1);
});
it("keeps the fixture model options in demo mode", async () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("AIGC_DEMO_MODE", "true");
  const page = await Home({ params: Promise.resolve({ locale: "zh" }), searchParams: Promise.resolve({}) });
  expect(api.getModels).not.toHaveBeenCalled();
  expect(page.props.models).toContainEqual({ key: "FLUX.1", label: "FLUX.1", group: "FLUX" });
});
it("does not substitute demo labels when the production catalog is unavailable", async () => {
  vi.stubEnv("NODE_ENV", "production");
  api.getModels.mockRejectedValue(new Error("unavailable"));
  const page = await Home({ params: Promise.resolve({ locale: "zh" }), searchParams: Promise.resolve({}) });
  expect(page.props.models).toEqual([]);
});
it("defaults home to recommended but keyword search to latest", async () => {
  vi.stubEnv("NODE_ENV", "production");
  api.getModels.mockResolvedValue([]);
  api.searchPrompts.mockResolvedValue({ items: [], has_more: false });
  const home = await Home({ params: Promise.resolve({ locale: "zh" }), searchParams: Promise.resolve({}) });
  expect(home.props.activeSort).toBe("recommended");
  expect(api.getPromptFeed).toHaveBeenCalledWith(expect.objectContaining({ sort: "recommended" }));
  const search = await Home({ params: Promise.resolve({ locale: "zh" }), searchParams: Promise.resolve({ q: "cat" }) });
  expect(search.props.activeSort).toBe("latest");
  expect(api.searchPrompts).toHaveBeenCalledWith("cat", expect.objectContaining({ sort: "latest" }));
});
it.each(["recommended", "latest", "popular", "hot"])("passes explicit %s with category and model to the backend", async sort => {
  vi.stubEnv("NODE_ENV", "production");
  api.getModels.mockResolvedValue([]);
  const page = await Home({ params: Promise.resolve({ locale: "zh" }), searchParams: Promise.resolve({ sort, category: "art", models: "FLUX" }) });
  expect(page.props.activeSort).toBe(sort);
  expect(api.getPromptFeed).toHaveBeenCalledWith({ sort, category: "art", model: "FLUX" });
});
it("preserves reference demo composition for recommended while popular sorts by likes", async () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("AIGC_DEMO_MODE", "true");
  const recommended = await Home({ params: Promise.resolve({ locale: "zh" }), searchParams: Promise.resolve({}) });
  const popular = await Home({ params: Promise.resolve({ locale: "zh" }), searchParams: Promise.resolve({ sort: "popular" }) });
  expect(recommended.props.activeSort).toBe("recommended");
  expect(popular.props.items.map((item: {like_count: number}) => item.like_count)).toEqual([...popular.props.items.map((item: {like_count: number}) => item.like_count)].sort((a, b) => b - a));
  expect(recommended.props.items.map((item: {id: string}) => item.id)).not.toEqual(popular.props.items.map((item: {id: string}) => item.id));
});
