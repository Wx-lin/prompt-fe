import { describe, expect, it } from "vitest";
import { distributeItems } from "@/features/gallery/lib/distribute-items";

describe("distributeItems", () => {
  it("distributes cards into the requested number of stable columns", () => {
    const items = ["portrait", "mountain", "perfume", "citrus", "ramen", "ink"];

    expect(distributeItems(items, 3)).toEqual([
      ["portrait", "citrus"],
      ["mountain", "ramen"],
      ["perfume", "ink"],
    ]);
  });

  it("returns no columns when the requested column count is invalid", () => {
    expect(distributeItems([1, 2], 0)).toEqual([]);
    expect(distributeItems([1, 2], -1)).toEqual([]);
  });

  it("preserves all items when there are more columns than cards", () => {
    expect(distributeItems(["only"], 3)).toEqual([["only"], [], []]);
  });
});
