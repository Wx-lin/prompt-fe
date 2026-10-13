import { expect, it, vi, afterEach } from "vitest";
import { getSimilarPrompts } from "@/lib/api/client";
import { getRecommendations } from "./recommendations";
vi.mock("@/lib/api/client", () => ({ getSimilarPrompts: vi.fn() }));
afterEach(() => vi.clearAllMocks());
const item = (id: string, thumbnail_url: string | null = `/image/${id}`) => ({ id, title: id, thumbnail_url, category: "art", models: [], like_count: 1, view_count: 2, author_name: null, created_at: "2026-10-13" });
it("keeps real API order, excludes self duplicates and missing images, and limits to three", async () => {
  vi.mocked(getSimilarPrompts).mockResolvedValue([item("self"), item("a"), item("a"), item("missing", null), item("blank", "  "), item("b"), item("c"), item("d")]);
  const result = await getRecommendations("self");
  expect(getSimilarPrompts).toHaveBeenCalledWith("self");
  expect(result.map(value => value.id)).toEqual(["a", "b", "c"]);
  expect(result[0]).toEqual({ ...item("a"), image: "/image/a", imageWidth: 300, imageHeight: 400 });
});
it("renders no fixture recommendations when API returns empty or fails", async () => {
  vi.mocked(getSimilarPrompts).mockResolvedValueOnce([]).mockRejectedValueOnce(new Error("offline"));
  expect(await getRecommendations("id")).toEqual([]);
  expect(await getRecommendations("id")).toEqual([]);
});
