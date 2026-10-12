"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { SiteHeader } from "@/features/gallery/components/site-header";
import { GalleryGrid } from "@/features/gallery/components/gallery-grid";
import type { CurrentUser, GalleryCard, PromptListItem, PromptListResponse } from "@/types/prompt";
import styles from "./collections-page.module.css";

interface CollectionsPageProps {
  items: GalleryCard[];
  loadError?: boolean;
  hasMore?: boolean;
  nextPage?: number;
  user: CurrentUser;
}

function toGalleryCard(prompt: PromptListItem): GalleryCard {
  return { ...prompt, image: prompt.thumbnail_url ?? "", imageWidth: 300, imageHeight: 400 };
}

export function CollectionsPage({
  items,
  loadError = false,
  hasMore = false,
  nextPage = 2,
  user,
}: CollectionsPageProps) {
  const t = useTranslations("collections");
  const [loadedItems, setLoadedItems] = useState(items);
  const [page, setPage] = useState(nextPage);
  const [canLoadMore, setCanLoadMore] = useState(hasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadNextPage = useCallback(async () => {
    if (loadingMore || !canLoadMore) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      const response = await fetch(`/api/users/me/collects?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to load more collections");
      const feed = (await response.json()) as PromptListResponse;
      setLoadedItems((current) => [...current, ...feed.items.map(toGalleryCard)]);
      setPage((current) => current + 1);
      setCanLoadMore(feed.has_more);
    } catch {
      setCanLoadMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, canLoadMore, page]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !canLoadMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadNextPage();
      },
      { rootMargin: "400px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [canLoadMore, loadNextPage]);

  return (
    <main>
      <SiteHeader
        categories={[]}
        activeCategory="all"
        activeSort="latest"
        activeModel="all"
        models={[]}
        user={user}
        showNavigationRow={false}
      />
      <section className={styles.heading}>
        <h1>{t("heading")}</h1>
      </section>
      <GalleryGrid
        items={loadedItems}
        emptyMessage={loadError ? t("loadError") : t("empty")}
        sentinelRef={loadedItems.length > 0 ? sentinelRef : undefined}
        loadingMore={loadingMore}
        endOfList={!canLoadMore && loadedItems.length > 0}
      />
    </main>
  );
}
