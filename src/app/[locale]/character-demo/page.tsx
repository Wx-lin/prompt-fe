import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { CharacterDemo } from "@/features/character-demo/character-demo";

export const metadata: Metadata = { title: "角色设定板体验", robots: { index: false, follow: false } };

export default async function CharacterDemoPage({ params }: { params: Promise<{ locale: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { locale } = await params;
  setRequestLocale(locale);
  return <CharacterDemo />;
}
