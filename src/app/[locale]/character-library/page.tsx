import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/features/gallery/components/site-header";
import { CharacterLibrary } from "@/features/character-library/character-library";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "角色库", description: "选择或创建你的角色设定。" };

export default async function CharacterLibraryPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [user, query] = await Promise.all([getSessionUser(), searchParams]);
  return <><SiteHeader categories={[]} activeCategory="all" activeSort="latest" activeModel="all" models={[]} user={user} showNavigationRow={false} showCharacterLink={false} /><CharacterLibrary locale={locale} authenticated={Boolean(user)} initialTab={query.tab === "mine" ? "mine" : "official"} /></>;
}
