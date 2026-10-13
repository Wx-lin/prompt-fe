import { describe, expect, it } from "vitest";
import { sortGalleryItems } from "./sort-items";

describe("sortGalleryItems", () => {
  const items = [
    { id: "older", like_count: 5, view_count: 30, created_at: "2026-10-06T08:00:00Z" },
    { id: "newest", like_count: 2, view_count: 50, created_at: "2026-10-08T08:00:00Z" },
    { id: "popular", like_count: 20, view_count: 10, created_at: "2026-10-07T08:00:00Z" },
  ];

  it.each([
    ["popular", ["popular", "older", "newest"]],
    ["hot", ["newest", "older", "popular"]],
    ["latest", ["newest", "popular", "older"]],
    ["unknown", ["newest", "popular", "older"]],
  ])("orders %s descending by the appropriate field", (sort, expected) => {
    expect(sortGalleryItems(items, sort).map((item) => item.id)).toEqual(expected);
  });

  it("returns a new array without mutating the input or its items", () => {
    const immutableItems = Object.freeze(items.map((item) => Object.freeze({ ...item })));
    const result = sortGalleryItems(immutableItems, "popular");
    expect(result).not.toBe(immutableItems);
    expect(immutableItems.map((item) => item.id)).toEqual(["older", "newest", "popular"]);
    expect(result[0]).toBe(immutableItems[2]);
  });

  it.each(["popular", "hot"])("keeps missing or invalid %s counts last and ties stable", (sort) => {
    const field = sort === "popular" ? "like_count" : "view_count";
    const candidates: Array<{ id: string; like_count?: number | null; view_count?: number | null }> = [
      { id: "missing", [field]: undefined },
      { id: "first", [field]: 7 },
      { id: "invalid", [field]: Number.NaN },
      { id: "second", [field]: 7 },
      { id: "zero", [field]: 0 },
      { id: "null", [field]: null },
    ];
    expect(sortGalleryItems(candidates, sort).map((item) => item.id))
      .toEqual(["first", "second", "zero", "missing", "invalid", "null"]);
  });

  it("keeps missing or invalid dates last and equal timestamps stable", () => {
    const candidates = [
      { id: "missing" },
      { id: "first", created_at: "2026-10-08T08:00:00Z" },
      { id: "invalid", created_at: "not-a-date" },
      { id: "second", created_at: "2026-10-08T16:00:00+08:00" },
      { id: "epoch", created_at: "1970-01-01T00:00:00Z" },
    ];
    expect(sortGalleryItems(candidates, "latest").map((item) => item.id))
      .toEqual(["first", "second", "epoch", "missing", "invalid"]);
  });

  it("handles an empty list", () => {
    expect(sortGalleryItems([], "latest")).toEqual([]);
  });
});
it("preserves curated recommended order and returns a new array", () => {
  const items = [{ id: "curated", like_count: 1 }, { id: "popular", like_count: 10 }];
  const result = sortGalleryItems(items, "recommended");
  expect(result).toEqual(items);
  expect(result).not.toBe(items);
});
