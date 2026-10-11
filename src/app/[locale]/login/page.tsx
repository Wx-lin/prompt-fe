import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { GalleryBackdrop } from "@/features/gallery/components/gallery-backdrop";
import { LoginPage } from "@/features/auth/components/login-page";

type RouteParameters = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: RouteParameters }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  return { title: t("loginTitle"), robots: { index: false, follow: false } };
}

export default async function LoginRoute({ params }: { params: RouteParameters }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <GalleryBackdrop />
      <LoginPage />
    </>
  );
}
