import type { Metadata } from "next";
import { ArrowLeft, BookOpen } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { SiteHeader } from "@/features/gallery/components/site-header";
import { loadGuide } from "@/features/user-guide/guide-content";
import { Link } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/auth/session";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "平台使用手册", description: "了解如何寻找灵感、创作图片和角色。" };

export default async function GuidePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [guide, user] = await Promise.all([loadGuide(), getSessionUser()]);
  const english = locale === "en";
  return <>
    <SiteHeader categories={[]} activeCategory="all" activeSort="latest" activeModel="all" models={[]} user={user} showNavigationRow={false} showGuideLink={false} />
    <main className={styles.page}>
      <Link href="/" className={styles.back}><ArrowLeft size={16} aria-hidden="true" />{english ? "Back to home" : "返回首页"}</Link>
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarTitle}><BookOpen size={18} aria-hidden="true" />{english ? "User guide" : "使用手册"}</div>
          <p className={styles.sidebarHint}>{english ? "On this page" : "本页目录"}</p>
          <nav aria-label={english ? "Guide contents" : "手册目录"} lang="zh-CN" className={styles.navigation}>
            {guide.sections.map(section => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}
          </nav>
        </aside>
        <article className={styles.article} lang="zh-CN">
          {english && <p className={styles.languageNote} lang="en">This guide is currently available in Chinese.</p>}
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
            h2: ({ node, ...props }) => <h2 id={guide.sections.find(section => section.line === node?.position?.start.line)?.id} {...props} />,
            table: ({ ...props }) => <div className={styles.tableWrap}><table {...props} /></div>,
          }}>{guide.markdown}</ReactMarkdown>
        </article>
      </div>
    </main>
  </>;
}
