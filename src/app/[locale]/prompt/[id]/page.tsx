import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { DetailPage } from "@/features/prompt-detail/components/detail-page";
import { demoPrompts } from "@/features/gallery/data/demo-prompts";
import { defaultLocale } from "@/i18n/routing";
import { getSessionToken } from "@/lib/auth/session";
import { getPromptDetail } from "@/lib/api/client";
import type { GalleryCard, PromptDetail } from "@/types/prompt";

type RouteParameters = Promise<{ locale: string; id: string }>;

async function loadPrompt(id: string, accessToken?: string): Promise<PromptDetail | GalleryCard | null> {
  try {
    return await getPromptDetail(id, accessToken);
  } catch {
    return process.env.NODE_ENV === "production" ? null : demoPrompts.find((item) => item.id === id) ?? null;
  }
}

export async function generateMetadata({ params }: { params: RouteParameters }): Promise<Metadata> {
  const { locale, id } = await params;
  const prompt = await loadPrompt(id);
  if (!prompt) {
    const t = await getTranslations({ locale, namespace: "metadata" });
    return { title: t("promptNotFound"), robots: { index: false, follow: false } };
  }
  return {
    title: prompt.title,
    description: "prompt_text" in prompt ? prompt.description ?? prompt.prompt_text : prompt.promptText,
    alternates: { canonical: locale === defaultLocale ? `/prompt/${id}` : `/${locale}/prompt/${id}` },
    openGraph: { title: prompt.title, images: prompt.thumbnail_url ? [prompt.thumbnail_url] : [] },
  };
}

export default async function PromptRoute({ params }: { params: RouteParameters }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const token = await getSessionToken();
  const prompt = await loadPrompt(id, token ?? undefined);
  if (!prompt) notFound();
  const recommendations = demoPrompts.filter((item) => item.id !== id);
  return <DetailPage prompt={prompt} recommendations={recommendations} />;
}
