import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { CharacterBuilder } from "@/features/character-builder/character-builder";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "角色设定", description: "组合角色信息，生成角色设定板与分镜提示词。" };

export default async function CharacterSettingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await getSessionUser();
  return <CharacterBuilder locale={locale} user={user} />;
}
