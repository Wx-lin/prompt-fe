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
vi.mock("@/features/prompt-creation/components/creation-gallery", () => ({ CreationGallery: () => null, CreationGalleryFeed: () => null, CreationGallerySkeleton: () => null }));
vi.mock("./gallery-skeleton", () => ({ GalleryLoading: () => null }));

it("keeps the initial shell loading boundary stable across filter navigation", async () => {
  vi.stubEnv("AIGC_DEMO_MODE", "false");
  vi.mocked(getPromptFeed).mockClear();
  try {
    const first = await Home({ params: Promise.resolve({ locale: "zh" }), searchParams: Promise.resolve({}) });
    const filtered = await Home({ params: Promise.resolve({ locale: "zh" }), searchParams: Promise.resolve({ category: "portrait", q: "cat" }) });
    expect(first.type).toBe(Suspense);
    expect(first.props.fallback).toBeTruthy();
    expect(first.key).toBe(filtered.key);
    expect(getPromptFeed).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllEnvs();
  }
});

it("returns the usable shell while its feed remains pending behind a local boundary", async () => {
  vi.stubEnv("AIGC_DEMO_MODE", "false");
  let resolve!: (value: Awaited<ReturnType<typeof getPromptFeed>>) => void;
  vi.mocked(getPromptFeed).mockReturnValueOnce(new Promise(done => { resolve = done; }));
  const boundary = await Home({ params: Promise.resolve({ locale: "zh" }), searchParams: Promise.resolve({}) });
  const content = boundary.props.children;
  let ready = false;
  const shell = content.type(content.props).then((page: { props: { feedContent: { type: unknown; key: string; props: { fallback: unknown } } } }) => { ready = true; return page; });
  try {
    await vi.waitFor(() => expect(ready).toBe(true), { timeout: 100 });
    const page = await shell;
    expect(page.props.feedContent.type).toBe(Suspense);
    expect(page.props.feedContent.props.fallback).toBeTruthy();
  } finally {
    resolve({ items: [], total: 0, page: 1, page_size: 20, has_more: false });
    await shell;
    vi.unstubAllEnvs();
  }
});

it("keys only the local feed by normalized filters rather than query property order", async () => {
  vi.stubEnv("AIGC_DEMO_MODE", "false");
  try {
    const shell = async (search: Record<string, string>) => {
      const boundary = await Home({ params: Promise.resolve({ locale: "zh" }), searchParams: Promise.resolve(search) });
      return boundary.props.children.type(boundary.props.children.props);
    };
    const first = await shell({ category: "portrait", q: "cat" });
    const same = await shell({ q: " cat ", category: "portrait", page: "1", models: "all", sort: "latest" });
    const changed = await shell({ category: "avatar", q: "cat" });
    expect(first.props.feedContent.key).toBe(same.props.feedContent.key);
    expect(first.props.feedContent.key).not.toBe(changed.props.feedContent.key);
  } finally { vi.unstubAllEnvs(); }
});
