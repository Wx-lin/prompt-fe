import { setRequestLocale } from "next-intl/server";
import { GalleryPage } from "@/features/gallery/components/gallery-page";
import { demoPrompts } from "@/features/gallery/data/demo-prompts";
import { sortGalleryItems } from "@/features/gallery/lib/sort-items";
import { getSessionUser } from "@/lib/auth/session";
import { getCategories, getModels, getPromptFeed, searchPrompts } from "@/lib/api/client";
import type { GalleryCard, PromptListItem } from "@/types/prompt";

type RouteParameters = Promise<{ locale: string }>;
type SearchParameters = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function toGalleryCard(prompt: PromptListItem): GalleryCard {
  return { ...prompt, image: prompt.thumbnail_url ?? "", imageWidth: 300, imageHeight: 400 };
}

export default async function Home({ params, searchParams }: { params: RouteParameters; searchParams: SearchParameters }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const resolvedSearchParams = await searchParams;
  const activeCategory = firstValue(resolvedSearchParams.category) ?? "all";
  const activeSort = firstValue(resolvedSearchParams.sort) ?? "latest";
  const activeModel = firstValue(resolvedSearchParams.models) ?? "all";
  const query = (firstValue(resolvedSearchParams.q) ?? "").trim();
  const useDemoContent = process.env.NODE_ENV !== "production" && process.env.AIGC_DEMO_MODE !== "false";
  const filters = { category: activeCategory, sort: activeSort, model: activeModel };
  const demoModels = [...new Set(demoPrompts.flatMap(item => item.models))].map(label => ({
    key: label, label, group: label.startsWith("DALL") ? "DALL·E" : label.startsWith("FLUX") ? "FLUX" : label,
  }));
  const [categories, feed, user, models] = await Promise.all([
    getCategories(),
    useDemoContent ? Promise.resolve(null) :
      (query ? searchPrompts(query, filters) : getPromptFeed(filters)).catch(() => null),
    getSessionUser(),
    useDemoContent ? Promise.resolve(demoModels) : getModels().catch(() => []),
  ]);
  const demoInVisualRowOrder = [0, 2, 4, 6, 8, 1, 3, 5, 7, 9].map((index) => demoPrompts[index]);
  const demoItems = demoInVisualRowOrder.filter((item) =>
    (activeCategory === "all" || item.category === activeCategory) &&
    (activeModel === "all" || item.models.includes(activeModel)) &&
    `${item.title} ${item.category} ${item.models.join(" ")} ${item.promptText ?? ""}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  // Keep the unfiltered reference composition; interactive views use real sorting.
  const keepReferenceOrder = !query && activeCategory === "all" && activeModel === "all" && activeSort === "latest";
  const items = useDemoContent
    ? keepReferenceOrder ? demoItems : sortGalleryItems(demoItems, activeSort)
    : (feed?.items ?? []).map(toGalleryCard);

  return (
    <GalleryPage
      items={items}
      categories={categories}
      activeCategory={activeCategory}
      activeSort={activeSort}
      activeModel={activeModel}
      models={models}
      query={query}
      loadError={!useDemoContent && !feed}
      hasMore={useDemoContent ? false : feed?.has_more ?? false}
      nextPage={2}
      user={user}
    />
  );
}
