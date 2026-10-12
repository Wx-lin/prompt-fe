import type { MetadataRoute } from "next";
import { getPromptFeed } from "@/lib/api/client";
import { defaultLocale, locales } from "@/i18n/routing";

/** Default locale is served unprefixed at "/" (localePrefix: "as-needed"); only
 * non-default locales carry an explicit "/{locale}" path segment. */
function localizedPath(locale: string, path: string): string {
  return locale === defaultLocale ? path || "/" : `/${locale}${path}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const urls: MetadataRoute.Sitemap = locales.map((locale) => ({
    url: `${siteUrl}${localizedPath(locale, "")}`,
    changeFrequency: "daily",
    priority: 1,
    alternates: { languages: Object.fromEntries(locales.map((l) => [l, `${siteUrl}${localizedPath(l, "")}`])) },
  }));
  try {
    for (let page = 1; page <= 5; page += 1) {
      const feed = await getPromptFeed({ page, pageSize: 50 });
      for (const item of feed.items) {
        urls.push(...locales.map((locale) => ({
          url: `${siteUrl}${localizedPath(locale, `/prompt/${item.id}`)}`,
          lastModified: new Date(item.created_at),
          changeFrequency: "weekly" as const,
          priority: 0.7,
          alternates: { languages: Object.fromEntries(locales.map((l) => [l, `${siteUrl}${localizedPath(l, `/prompt/${item.id}`)}`])) },
        })));
      }
      if (!feed.has_more) break;
    }
  } catch {
    // Keep the homepage discoverable even when the backend is temporarily offline.
  }
  return urls;
}
