import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getSessionUser } from "@/lib/auth/session";
import { getCategories, getModels } from "@/lib/api/client";
import { PublishForm } from "@/features/submissions/components/publish-form";
import { SiteHeader } from "@/features/gallery/components/site-header";
import { Link } from "@/i18n/navigation";
import styles from "@/features/submissions/components/submissions.module.css";

type Params = Promise<{
  locale: string;
}>;

export async function generateMetadata({ params }: {
  params: Params;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "submissions" });
  return { title: t("heading"), robots: { index: false, follow: false } };
}
export default async function PublishRoute({ params }: {
  params: Params;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await getSessionUser();
  if (!user)
    redirect(`${locale === "en" ? "/en" : ""}/login?returnTo=/publish`);
  const t = await getTranslations("submissions");
  const [categories, models] = await Promise.all([getCategories().catch(() => []), getModels().catch(() => [])]);
  return <>
    <SiteHeader
      categories={[]}
      activeCategory="all"
      activeSort="latest"
      activeModel="all"
      models={[]}
      user={user}
      showNavigationRow={false}
    />
    <main className={styles.page}>
      <div className={styles.top}>
        <h1>
          {t("heading")}
        </h1>
        <Link href="/my-works">
          {t("myWorks")}
        </Link>
      </div>
      {!categories.length || !models.length ? <p role="alert">
        {t("catalogError")}
      </p> : <PublishForm categories={categories} models={models} />}
    </main>
  </>;
}
