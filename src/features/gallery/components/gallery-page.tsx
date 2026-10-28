"use client";

import type { ModelOption } from "@/lib/api/client";

import { useTranslations } from "next-intl";
import { useRef, type ReactNode } from "react";
import { SiteHeader } from "@/features/gallery/components/site-header";
import { GalleryFeed } from "./gallery-feed";
import { GalleryToolbar } from "./gallery-toolbar";
import { useGalleryLayoutMotion } from "./use-gallery-layout-motion";
import { isCurrentCategory, legacyCategoryKeys } from "@/features/gallery/data/categories";
import type { Category, CurrentUser, GalleryCard } from "@/types/prompt";
import styles from "./gallery-page.module.css";

export interface GalleryPageProps {
  landingCategory?: string;
  items: GalleryCard[];
  categories: Category[];
  activeCategory: string;
  activeSort: string;
  activeModel: string;
  models: ModelOption[];
  query?: string;
  loadError?: boolean;
  hasMore?: boolean;
  nextPage?: number;
  user?: CurrentUser | null;
  creationComposer?: ReactNode;
  chatPanel?: ReactNode;
  chatOpen?: boolean;
  onUseReference?: (prompt: GalleryCard) => void;
  activeReferenceId?: string;
  feedContent?: ReactNode;
}

export function GalleryPage({
  items,
  landingCategory,
  categories,
  activeCategory,
  activeSort,
  activeModel,
  models,
  query = "",
  loadError = false,
  hasMore = false,
  nextPage = 2,
  user = null,
  creationComposer,
  chatPanel,
  chatOpen = false,
  onUseReference,
  activeReferenceId,
  feedContent,
}: GalleryPageProps) {
  const t = useTranslations("gallery");
  const tCategories = useTranslations("categories");
  const galleryRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLDivElement | null>(null);
  useGalleryLayoutMotion(chatOpen, composerRef, galleryRef);

  return (
    <main className={styles.page} data-chat-open={chatOpen}>
      <SiteHeader
        categories={categories}
        activeCategory={activeCategory}
        activeSort={activeSort}
        activeModel={activeModel}
        models={models}
        query={query}
        user={user}
        showNavigationRow={false}
      />
      <div ref={composerRef} className={styles.homeComposer} aria-hidden={chatOpen} inert={chatOpen} style={chatOpen ? { height: 0, opacity: 0 } : undefined}>{creationComposer}</div>
      <div className={`${styles.workspace} ${chatOpen ? styles.workspaceOpen : ""}`}>
      <div ref={galleryRef} className={styles.galleryPane} data-testid="gallery-pane">
      <GalleryToolbar categories={categories} activeCategory={activeCategory} activeSort={activeSort} activeModel={activeModel} models={models} query={query} compact={chatOpen} />
      {!query && <h1 className={styles.pageHeading}>{activeCategory === "all" ? t("seoHeading") : t("categoryHeading", { category: isCurrentCategory(activeCategory) ? tCategories(activeCategory) : activeCategory })}</h1>}
      {legacyCategoryKeys.includes(activeCategory) && <section className={styles.searchSummary} role="status">{t("categoryAdjusted")}</section>}
      {feedContent !== undefined ? feedContent : <GalleryFeed
        items={items} landingCategory={landingCategory} activeCategory={activeCategory} activeSort={activeSort} activeModel={activeModel}
        query={query} loadError={loadError} hasMore={hasMore} nextPage={nextPage} compact={chatOpen}
        onUseReference={onUseReference} activeReferenceId={activeReferenceId}
      />}
      </div>
      <div className={styles.chatPane} aria-hidden={!chatOpen} inert={!chatOpen} style={{ visibility: chatOpen ? "visible" : "hidden" }} data-testid="creation-chat-pane">{chatPanel}</div>
      </div>
    </main>
  );
}
