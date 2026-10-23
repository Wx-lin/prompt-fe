import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { defaultLocale, routing } from "@/i18n/routing";

type LocaleLayoutProps = Readonly<{
  children: ReactNode;
  modal: ReactNode;
  params: Promise<{ locale: string }>;
}>;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/** Default locale is served unprefixed at "/" (localePrefix: "as-needed"); only
 * non-default locales carry an explicit "/{locale}" path segment. */
function localizedPath(locale: string): string {
  return locale === defaultLocale ? "/" : `/${locale}`;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });

  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://aigc-prompt.com"),
    title: { default: t("title"), template: `%s | ${t("siteName")}` },
    description: t("description"),
    alternates: {
      canonical: localizedPath(locale),
      languages: Object.fromEntries(routing.locales.map((l) => [l, localizedPath(l)])),
    },
    openGraph: {
      type: "website",
      locale: locale === "zh" ? "zh_CN" : "en_US",
      siteName: t("siteName"),
      title: t("siteName"),
      description: t("ogDescription"),
    },
    verification: {
      // Public ownership proof issued by Search Console, not an API credential.
      google: process.env.GOOGLE_SITE_VERIFICATION ?? "JmXFPc75PJPDA8nHWPSaOVqGiNCu0uaxFlgPdgDKsVw",
      ...(process.env.BAIDU_SITE_VERIFICATION ? { other: { "baidu-site-verification": process.env.BAIDU_SITE_VERIFICATION } } : {}),
    },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light dark",
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#ffffff" }, { media: "(prefers-color-scheme: dark)", color: "#151515" }],
};

export default async function LocaleLayout({ children, modal, params }: LocaleLayoutProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Enables static rendering for this and descendant Server Components.
  setRequestLocale(locale);

  return (
    <NextIntlClientProvider>
      {children}
      {modal}
    </NextIntlClientProvider>
  );
}
