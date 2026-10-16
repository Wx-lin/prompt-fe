import type { Metadata } from "next";
import { fallbackCategories } from "@/features/gallery/data/categories";
import { defaultLocale, locales } from "@/i18n/routing";

export type SearchValues = Record<string, string | string[] | undefined>;
export function firstValue(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
export function parsePage(value?: string): number {
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}
export function localizedPath(locale: string, path = ""): string {
  return locale === defaultLocale ? path || "/" : `/${locale}${path}`;
}
export function languageAlternates(path: string) {
  return Object.fromEntries([...locales.map(locale => [locale, localizedPath(locale, path)]), ["x-default", localizedPath(defaultLocale, path)]]);
}
export function siteUrl() { return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://aigc-prompt.com").replace(/\/$/, ""); }
export function serializeJsonLd(value: unknown): string { return JSON.stringify(value).replace(/</g, "\\u003c"); }
export function galleryMetadata(locale: string, search: SearchValues, category?: string): Metadata {
  const chinese = locale === "zh";
  const entry = fallbackCategories.find(item => item.key === category);
  const label = chinese ? entry?.label : entry?.label_en;
  const title = label ? chinese ? `${label}提示词｜AI 绘图与文生图提示词` : `${label} AI Image Prompts` : chinese ? "AI 提示词库｜文生图与 AI 绘图提示词大全" : "AI Prompt Library | Text-to-Image Prompts";
  const description = chinese ? `浏览${label ?? "各类"} AI 提示词、文生图提示词和 AI 绘图提示词，查看生成效果，复制提示词，按场景与模型寻找 AI 生图灵感。` : `Browse ${label ?? "creative"} AI image prompts, preview results and copy text-to-image prompts by scene and model.`;
  const page = parsePage(firstValue(search.page));
  const path = `${category ? `/category/${category}` : ""}${page > 1 ? `?page=${page}` : ""}`;
  const filtered = Object.keys(search).some(key => key !== "page" && Boolean(firstValue(search[key])));
  return { title: page > 1 ? `${title} · ${page}` : title, description, robots: { index: !filtered, follow: true }, alternates: { canonical: localizedPath(locale, path), languages: languageAlternates(path) }, openGraph: { title, description } };
}
