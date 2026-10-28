import { parsePage } from "@/lib/seo/metadata";
import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { GalleryLoading } from "@/features/gallery/components/gallery-skeleton";
import { CreationGallery, CreationGalleryFeed, CreationGallerySkeleton } from "@/features/prompt-creation/components/creation-gallery";
import { demoPrompts } from "@/features/gallery/data/demo-prompts";
import { sortGalleryItems } from "@/features/gallery/lib/sort-items";
import { getSessionUser } from "@/lib/auth/session";
import { getCategories, getModels, getPromptFeed, searchPrompts } from "@/lib/api/client";
import type { GalleryCard, PromptListItem } from "@/types/prompt";
import type { GalleryFeedProps } from "./gallery-feed";

type RouteParameters = Promise<{ locale: string }>;
type SearchParameters = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function toGalleryCard(prompt: PromptListItem): GalleryCard {
  return { ...prompt, image: prompt.thumbnail_url ?? "", imageWidth: 300, imageHeight: 400 };
}

export default async function GalleryRoute({ params, searchParams, landingCategory }: { params: RouteParameters; searchParams: SearchParameters; landingCategory?: string }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const resolvedSearchParams = await searchParams;
  return (
    <Suspense key={locale} fallback={<GalleryLoading />}>
      <HomeContent locale={locale} resolvedSearchParams={resolvedSearchParams} landingCategory={landingCategory} />
    </Suspense>
  );
}

type Selection = { activeCategory: string; activeSort: string; activeModel: string; query: string; currentPage: number };
type FeedData = Pick<GalleryFeedProps, "items" | "loadError" | "hasMore" | "nextPage">;

function selection(params: Awaited<SearchParameters>): Selection {
  const query = (firstValue(params.q) ?? "").trim();
  return { activeCategory: firstValue(params.category) ?? "all", activeModel: firstValue(params.models) ?? "all",
    activeSort: firstValue(params.sort) ?? (query ? "latest" : "recommended"), query, currentPage: parsePage(firstValue(params.page)) };
}

function demoItems({ activeCategory, activeSort, activeModel, query }: Selection) {
  const ordered = [0, 2, 4, 6, 8, 1, 3, 5, 7, 9].map(index => demoPrompts[index]);
  const items = ordered.filter(item =>
    (activeCategory === "all" || item.category === activeCategory) &&
    (activeModel === "all" || item.models.includes(activeModel)) &&
    `${item.title} ${item.category} ${item.models.join(" ")} ${item.promptText ?? ""}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return !query && activeCategory === "all" && activeModel === "all" && activeSort === "recommended" ? items : sortGalleryItems(items, activeSort);
}

async function loadFeed(selected: Selection, useDemoContent: boolean): Promise<FeedData> {
  if (useDemoContent) return { items: demoItems(selected), loadError: false, hasMore: false, nextPage: selected.currentPage + 1 };
  const { activeCategory: category, activeSort: sort, activeModel: model, currentPage, query } = selected;
  const filters = { category, sort, model, ...(currentPage > 1 ? { page: currentPage } : {}) };
  const feed = await (query ? searchPrompts(query, filters) : getPromptFeed(filters)).catch(() => null);
  return { items: (feed?.items ?? []).map(toGalleryCard), loadError: !feed, hasMore: feed?.has_more ?? false, nextPage: currentPage + 1 };
}

async function FeedContent({ data, selected, landingCategory }: { data: Promise<FeedData>; selected: Selection; landingCategory?: string }) {
  const { activeCategory, activeSort, activeModel, query } = selected;
  return <CreationGalleryFeed {...await data} activeCategory={activeCategory} activeSort={activeSort} activeModel={activeModel} query={query} landingCategory={landingCategory} />;
}

async function HomeContent({ locale, resolvedSearchParams, landingCategory }: { locale: string; resolvedSearchParams: Awaited<SearchParameters>; landingCategory?: string }) {
  const selected = selection(resolvedSearchParams);
  const useDemoContent = process.env.NODE_ENV !== "production" && process.env.AIGC_DEMO_MODE !== "false";
  // Start public data concurrently, but let only the feed slot wait for it.
  const data = loadFeed(selected, useDemoContent);
  const demoModels = [...new Set(demoPrompts.flatMap(item => item.models))].map(label => ({
    key: label, label, group: label.startsWith("DALL") ? "DALL·E" : label.startsWith("FLUX") ? "FLUX" : label,
  }));
  const [categories, user, models] = await Promise.all([
    getCategories(), getSessionUser(), useDemoContent ? Promise.resolve(demoModels) : getModels().catch(() => []),
  ]);
  const key = JSON.stringify([locale, landingCategory ?? "", selected.activeCategory, selected.query, selected.activeModel, selected.activeSort, selected.currentPage]);
  return <CreationGallery items={[]} categories={categories} models={models} user={user} landingCategory={landingCategory}
    activeCategory={selected.activeCategory} activeSort={selected.activeSort} activeModel={selected.activeModel} query={selected.query}
    feedContent={<Suspense key={key} fallback={<CreationGallerySkeleton />}><FeedContent data={data} selected={selected} landingCategory={landingCategory} /></Suspense>} />;
}
