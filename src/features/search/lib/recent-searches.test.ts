import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearRecentSearches, readRecentSearches, saveRecentSearch, subscribeToRecentSearches } from "@/features/search/lib/recent-searches";

describe("recent searches", () => {
  beforeEach(() => window.localStorage.clear());

  it("reads only string terms and tolerates malformed stored data", () => {
    window.localStorage.setItem("aigc-recent-searches", JSON.stringify(["portrait", 2, null]));
    expect(readRecentSearches()).toEqual(["portrait"]);
    window.localStorage.setItem("aigc-recent-searches", "not-json");
    expect(readRecentSearches()).toEqual([]);
  });

  it("normalizes terms, puts repeated searches first, and caps the list", () => {
    for (let index = 0; index < 9; index += 1) saveRecentSearch(`term-${index}`);
    expect(saveRecentSearch(" term-4 ")).toEqual(["term-4", "term-8", "term-7", "term-6", "term-5", "term-3", "term-2", "term-1"]);
    expect(saveRecentSearch("   ")).toHaveLength(8);
  });

  it("notifies subscribers when history changes and removes listeners on cleanup", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToRecentSearches(listener);
    saveRecentSearch("cinematic portrait");
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    clearRecentSearches();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(readRecentSearches()).toEqual([]);
  });
});
