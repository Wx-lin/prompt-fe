import { defineRouting } from "next-intl/routing";

export const locales = ["zh", "en"] as const;
export const defaultLocale = "zh" as const;

export const routing = defineRouting({
  locales,
  defaultLocale,
  // Default locale (zh) is served unprefixed at "/" for a clean address bar; only the
  // non-default locale (en) carries an explicit "/en" prefix. Each locale still resolves
  // to its own crawlable URL, so SEO (per-language indexing, hreflang alternates) keeps
  // working — this is a middle ground between "always prefixed" and "no URL distinction".
  localePrefix: "as-needed",
});

export type AppLocale = (typeof locales)[number];
