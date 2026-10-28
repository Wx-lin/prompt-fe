"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { GalleryCard, PromptListItem, PromptListResponse } from "@/types/prompt";
import { GalleryGrid } from "./gallery-grid";
import styles from "./gallery-page.module.css";

export interface GalleryFeedProps {
  items: GalleryCard[];
  landingCategory?: string;
  activeCategory: string;
  activeSort: string;
  activeModel: string;
  query?: string;
  loadError?: boolean;
  hasMore?: boolean;
  nextPage?: number;
  compact?: boolean;
  onUseReference?: (prompt: GalleryCard) => void;
  activeReferenceId?: string;
}

function toGalleryCard(prompt: PromptListItem): GalleryCard {
  return { ...prompt, image: prompt.thumbnail_url ?? "", imageWidth: 300, imageHeight: 400 };
}

/** Public snapshot changes reset the feed; presentation changes keep its loaded pages. */
export function GalleryFeed(props: GalleryFeedProps) {
  const [snapshot, setSnapshot] = useState(() => ({ items: props.items, sequence: 0 }));
  if (snapshot.items !== props.items) setSnapshot({ items: props.items, sequence: snapshot.sequence + 1 });
  const query = (props.query ?? "").trim();
  const key = JSON.stringify([props.landingCategory ?? "", props.activeCategory, props.activeSort, props.activeModel, query, props.nextPage ?? 2, props.hasMore ?? false, snapshot.sequence]);
  return <GalleryFeedState key={key} {...props} query={query} />;
}

function GalleryFeedState({ items, landingCategory, activeCategory, activeSort, activeModel, query = "", loadError = false, hasMore = false, nextPage = 2, compact = false, onUseReference, activeReferenceId }: GalleryFeedProps) {
  const t = useTranslations("gallery");
  const [loadedItems, setLoadedItems] = useState(items);
  const [page, setPage] = useState(nextPage);
  const [canLoadMore, setCanLoadMore] = useState(hasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [paginationError, setPaginationError] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<number | undefined>(undefined);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const filters = new URLSearchParams();
  if (activeCategory !== "all") filters.set("category", activeCategory);
  if (activeSort !== "recommended") filters.set("sort", activeSort);
  if (activeModel !== "all") filters.set("models", activeModel);
  const filterString = filters.toString();
  const clearSearchHref = filterString ? `/?${filterString}` : "/";
  const pagination = new URLSearchParams(filters);
  if (query) { pagination.set("q", query); pagination.set("sort", activeSort); }
  pagination.set("page", String(page));
  if (landingCategory) pagination.delete("category");

  const loadNextPage = useCallback(async () => {
    if (requestRef.current || !canLoadMore) return;
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    timeoutRef.current = timeout;
    setLoadingMore(true); setPaginationError(false);
    try {
      const params = new URLSearchParams(filterString);
      params.set("page", String(page));
      if (query) { params.set("q", query); params.set("sort", activeSort); }
      const response = await fetch(`/api/prompts?${params}`, { signal: controller.signal });
      if (!response.ok) throw new Error("Failed to load more prompts");
      const feed = (await response.json()) as PromptListResponse;
      if (requestRef.current !== controller) return;
      if (controller.signal.aborted) throw new Error("Pagination timed out");
      setLoadedItems(current => [...current, ...feed.items.map(toGalleryCard)]);
      setPage(current => current + 1);
      setCanLoadMore(feed.has_more);
    } catch {
      if (requestRef.current === controller) setPaginationError(true);
    } finally {
      window.clearTimeout(timeout);
      if (requestRef.current === controller) {
        requestRef.current = null; timeoutRef.current = undefined; setLoadingMore(false);
      }
    }
  }, [canLoadMore, page, filterString, query, activeSort]);

  useEffect(() => () => {
    window.clearTimeout(timeoutRef.current);
    requestRef.current?.abort(); requestRef.current = null;
  }, []);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !canLoadMore || paginationError) return;
    const observer = new IntersectionObserver(entries => { if (entries[0]?.isIntersecting) void loadNextPage(); }, { rootMargin: "400px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [canLoadMore, loadNextPage, paginationError]);

  return <>
    {query && <section className={styles.searchSummary} aria-label={t("searchResultsAriaLabel")}>
      <h1>{t("searchResultsHeading", { query })}</h1><span>{t("searchResultsCount", { count: loadedItems.length })}</span>
      <Link href={clearSearchHref} aria-label={t("clearSearchAriaLabel")}>{t("clearSearch")}</Link>
    </section>}
    {!loadError && !loadedItems.length && filters.size > 0 && <section className={styles.searchSummary}>
      <Link href={query ? `/?${new URLSearchParams({ q: query })}` : "/"}>{t("clearFilters")}</Link>
    </section>}
    {paginationError && <div role="alert"><p>{t("loadMoreError")}</p><button type="button" onClick={() => void loadNextPage()}>{t("retryLoadMore")}</button></div>}
    <GalleryGrid items={loadedItems} emptyMessage={loadError ? t("loadError") : query ? t("searchEmpty") : undefined}
      sentinelRef={loadedItems.length ? sentinelRef : undefined} loadingMore={loadingMore} endOfList={!canLoadMore && loadedItems.length > 0}
      compact={compact} onUseReference={onUseReference} activeReferenceId={activeReferenceId} />
    {canLoadMore && <nav className={styles.searchSummary} aria-label={t("paginationLabel")}>
      <Link href={`${landingCategory ? `/category/${landingCategory}` : "/"}?${pagination}`}>{t("nextPageLink")}</Link>
    </nav>}
  </>;
}
