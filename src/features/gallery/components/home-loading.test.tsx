import { Suspense } from "react";
import { expect, it, vi } from "vitest";
import Home from "@/app/[locale]/page";
import { getPromptFeed } from "@/lib/api/client";

vi.mock("next-intl/server", () => ({ setRequestLocale: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getSessionUser: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/api/client", () => ({
  getCategories: vi.fn().mockResolvedValue([]),
  getModels: vi.fn().mockResolvedValue([]),
  getPromptFeed: vi.fn().mockResolvedValue({ items: [], has_more: false }),
  searchPrompts: vi.fn().mockResolvedValue({ items: [], has_more: false }),
}));
vi.mock("./gallery-page", () => ({ GalleryPage: () => null }));
vi.mock("./gallery-skeleton", () => ({ GalleryLoading: () => null }));

it("returns a loading boundary before fetching feed and resets it when filters change", async () => {
  vi.stubEnv("AIGC_DEMO_MODE", "false");
  vi.mocked(getPromptFeed).mockClear();
  try {
    const first = await Home({ params: Promise.resolve({ locale: "zh" }), searchParams: Promise.resolve({}) });
    const filtered = await Home({ params: Promise.resolve({ locale: "zh" }), searchParams: Promise.resolve({ category: "portrait", q: "cat" }) });
    expect(first.type).toBe(Suspense);
    expect(first.props.fallback).toBeTruthy();
    expect(first.key).not.toBe(filtered.key);
    expect(getPromptFeed).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllEnvs();
  }
});
