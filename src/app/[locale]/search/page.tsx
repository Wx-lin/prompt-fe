import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

type RouteParameters = Promise<{ locale: string }>;
type SearchParameters = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: RouteParameters }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  return { title: t("searchTitle"), robots: { index: false, follow: true } };
}

/** Legacy /search links now resolve to the homepage; the search UI lives inline in the header. */
export default async function SearchRoute({ params, searchParams }: { params: RouteParameters; searchParams: SearchParameters }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const q = (first(query.q) ?? first(query.edit) ?? "").trim();
  const filters = new URLSearchParams();
  for (const name of ["category", "sort", "models"]) {
    const value = first(query[name]);
    if (value) filters.set(name, value);
  }
  if (q) filters.set("q", q);

  redirect({ href: filters.size ? `/?${filters}` : "/", locale });
}
