"use client";

import type { ModelOption } from "@/lib/api/client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { SiteHeader } from "@/features/gallery/components/site-header";
import { GalleryGrid } from "@/features/gallery/components/gallery-grid";
import { Link } from "@/i18n/navigation";
import { isCurrentCategory, legacyCategoryKeys } from "@/features/gallery/data/categories";
import type { Category, CurrentUser, GalleryCard, PromptListItem, PromptListResponse } from "@/types/prompt";
import styles from "./gallery-page.module.css";

interface GalleryPageProps {
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
}

function toGalleryCard(prompt: PromptListItem): GalleryCard {
  return { ...prompt, image: prompt.thumbnail_url ?? "", imageWidth: 300, imageHeight: 400 };
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
}: GalleryPageProps) {
  const t = useTranslations("gallery");
  const tCategories = useTranslations("categories");
  const [loadedItems, setLoadedItems] = useState(items);
  const [page, setPage] = useState(nextPage);
  const [canLoadMore, setCanLoadMore] = useState(hasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [paginationError, setPaginationError] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Reset pagination whenever the server-provided first page changes (new filters/search/locale).
  // Derived during render rather than in an effect, per React's "adjusting state when props change" guidance.
  const [prevItems, setPrevItems] = useState(items);
  if (items !== prevItems) {
    setPaginationError(false);
    setPrevItems(items);
    setLoadedItems(items);
    setPage(nextPage);
    setCanLoadMore(hasMore);
    setLoadingMore(false);
  }

  const filters = new URLSearchParams();
  if (activeCategory !== "all") filters.set("category", activeCategory);
  if (activeSort !== "recommended") filters.set("sort", activeSort);
  if (activeModel !== "all") filters.set("models", activeModel);
  const paginationParams = new URLSearchParams(filters);
  if (query) paginationParams.set("q", query);
  paginationParams.set("page", String(page));
  if (landingCategory) paginationParams.delete("category");
  const clearSearchHref = filters.size ? `/?${filters}` : "/";

  const loadNextPage = useCallback(async () => {
    if (requestRef.current || !canLoadMore) return;
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    setLoadingMore(true);
    setPaginationError(false);
    try {
      const params = new URLSearchParams(filters);
      params.set("page", String(page));
      if (query) {
        params.set("q", query);
        params.set("sort", activeSort);
      }
      const response = await fetch(`/api/prompts?${params.toString()}`, { signal: controller.signal });
      if (!response.ok) throw new Error("Failed to load more prompts");
      const feed = (await response.json()) as PromptListResponse;
      if (requestRef.current !== controller) return;
      setLoadedItems((current) => [...current, ...feed.items.map(toGalleryCard)]);
      setPage((current) => current + 1);
      setCanLoadMore(feed.has_more);
    } catch {
      if (requestRef.current === controller) setPaginationError(true);
    } finally {
      window.clearTimeout(timeout);
      if (requestRef.current === controller) {
        requestRef.current = null;
        setLoadingMore(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingMore, canLoadMore, page, query, activeCategory, activeSort, activeModel]);

  useEffect(() => () => {
    requestRef.current?.abort();
    requestRef.current = null;
  }, [items]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !canLoadMore || paginationError) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadNextPage();
      },
      { rootMargin: "400px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [canLoadMore, loadNextPage, paginationError]);

  return (
    <main>
      <SiteHeader
        categories={categories}
        activeCategory={activeCategory}
        activeSort={activeSort}
        activeModel={activeModel}
        models={models}
        query={query}
        user={user}
        showNavigationRow
      />
      {!query && <h1 className={styles.pageHeading}>{activeCategory === "all" ? t("seoHeading") : t("categoryHeading", { category: isCurrentCategory(activeCategory) ? tCategories(activeCategory) : activeCategory })}</h1>}
      {legacyCategoryKeys.includes(activeCategory) && <section className={styles.searchSummary} role="status">{t("categoryAdjusted")}</section>}
      {query && (
        <section className={styles.searchSummary} aria-label={t("searchResultsAriaLabel")}>
          <h1>{t("searchResultsHeading", { query })}</h1>
          <span>{t("searchResultsCount", { count: loadedItems.length })}</span>
          <Link href={clearSearchHref} aria-label={t("clearSearchAriaLabel")}>{t("clearSearch")}</Link>
        </section>
      )}
      {!loadError && loadedItems.length === 0 && filters.size > 0 && (
        <section className={styles.searchSummary}><Link href={query ? `/?${new URLSearchParams({ q: query })}` : "/"}>{t("clearFilters")}</Link></section>
      )}
      {paginationError && (
        <div role="alert">
          <p>{t("loadMoreError")}</p>
          <button type="button" onClick={loadNextPage}>{t("retryLoadMore")}</button>
        </div>
      )}
      <GalleryGrid
        items={loadedItems}
        emptyMessage={loadError ? t("loadError") : query ? t("searchEmpty") : undefined}
        sentinelRef={loadedItems.length > 0 ? sentinelRef : undefined}
        loadingMore={loadingMore}
        endOfList={!canLoadMore && loadedItems.length > 0}
      />
      {canLoadMore && <nav className={styles.searchSummary} aria-label={t("paginationLabel")}><Link href={`${landingCategory ? `/category/${landingCategory}` : "/"}?${paginationParams}`}>{t("nextPageLink")}</Link></nav>}
    </main>
  );
}
