import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getSessionUser } from "@/lib/auth/session";
import { MyWorks } from "@/features/submissions/components/my-works";
import { SiteHeader } from "@/features/gallery/components/site-header";

type Params = Promise<{
  locale: string;
}>;

export async function generateMetadata({ params }: {
  params: Params;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "submissions" });
  return { title: t("myWorks"), robots: { index: false, follow: false } };
}
export default async function MyWorksRoute({ params, searchParams }: {
  params: Params;
  searchParams: Promise<{
    submitted?: string;
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await getSessionUser();
  if (!user)
    redirect(`${locale === "en" ? "/en" : ""}/login?returnTo=/my-works`);
  const query = await searchParams;
  return <>
    <SiteHeader
      categories={[]}
      activeCategory="all"
      activeSort="latest"
      activeModel="all"
      models={[]}
      user={user}
      showNavigationRow={false}
    /><MyWorks submitted={query.submitted === "1"} />
  </>;
}
