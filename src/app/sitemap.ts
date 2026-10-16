import type { MetadataRoute } from "next";
import { getCategories, getPromptFeed } from "@/lib/api/client";
import { locales } from "@/i18n/routing";
import { isCurrentCategory } from "@/features/gallery/data/categories";
import { languageAlternates, localizedPath, siteUrl } from "@/lib/seo/metadata";

// Generate against live availability, never persist a homepage-only fallback after an outage.
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  function entries(path: string, lastModified?: Date): MetadataRoute.Sitemap {
    return locales.map(locale => ({ url: `${base}${localizedPath(locale, path)}`, ...(lastModified && !Number.isNaN(lastModified.getTime()) ? { lastModified } : {}), alternates: { languages: Object.fromEntries(Object.entries(languageAlternates(path)).map(([language, url]) => [language, `${base}${url}`])) } }));
  }
  const categories = await getCategories();
  const urls = [...entries(""), ...categories.filter(category => category.count > 0 && isCurrentCategory(category.key)).flatMap(category => entries(`/category/${category.key}`))];
  const seen = new Set<string>();
  for (let page = 1; ; page += 1) {
    const feed = await getPromptFeed({ page, pageSize: 50, sort: "latest" });
    const newItems = feed.items.filter(item => !seen.has(item.id));
    if (!newItems.length && feed.has_more) throw new Error("Sitemap pagination made no progress");
    for (const item of newItems) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      urls.push(...entries(`/prompt/${encodeURIComponent(item.id)}`, new Date(item.created_at)));
    }
    // Fail explicitly rather than publish an invalid/truncated XML once splitting is needed.
    if (urls.length > 50000) throw new Error("Sitemap exceeds 50000 URLs; split into sitemap index files");
    if (!feed.has_more) break;
  }
  return urls;
}
