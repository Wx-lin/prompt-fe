import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { CollectionsPage } from "@/features/collections/components/collections-page";
import { getSessionToken, getSessionUser } from "@/lib/auth/session";
import { getMyCollects } from "@/lib/api/client";
import type { GalleryCard, PromptListItem } from "@/types/prompt";

type RouteParameters = Promise<{ locale: string }>;

function toGalleryCard(prompt: PromptListItem): GalleryCard {
  return { ...prompt, image: prompt.thumbnail_url ?? "", imageWidth: 300, imageHeight: 400 };
}

export async function generateMetadata({ params }: { params: RouteParameters }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "collections" });
  return { title: t("pageTitle"), robots: { index: false, follow: false } };
}

export default async function CollectionsRoute({ params }: { params: RouteParameters }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [user, token] = await Promise.all([getSessionUser(), getSessionToken()]);
  if (!user || !token) redirect("/login");

  const feed = await getMyCollects(token).catch(() => null);

  return (
    <CollectionsPage
      items={(feed?.items ?? []).map(toGalleryCard)}
      loadError={!feed}
      hasMore={feed?.has_more ?? false}
      nextPage={2}
      user={user}
    />
  );
}
