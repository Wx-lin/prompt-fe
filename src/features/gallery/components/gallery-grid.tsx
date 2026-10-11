"use client";

import { useTranslations } from "next-intl";
import { useCallback, useState, type Ref } from "react";
import { PromptCard } from "@/features/gallery/components/prompt-card";
import { distributeItems } from "@/features/gallery/lib/distribute-items";
import { isOverlongImage } from "@/features/gallery/lib/image-visibility";
import type { GalleryCard } from "@/types/prompt";
import styles from "./gallery-grid.module.css";

interface GalleryGridProps {
  items: GalleryCard[];
  emptyMessage?: string;
  sentinelRef?: Ref<HTMLDivElement>;
  loadingMore?: boolean;
  endOfList?: boolean;
}

export function GalleryGrid({ items, emptyMessage, sentinelRef, loadingMore = false, endOfList = false }: GalleryGridProps) {
  const t = useTranslations("gallery");
  // Key by image URL: a replacement cover for the same prompt can still be shown.
  const [overlongImages, setOverlongImages] = useState<ReadonlySet<string>>(() => new Set());
  const hideOverlongImage = useCallback((image: string) => {
    setOverlongImages((current) => current.has(image) ? current : new Set([...current, image]));
  }, []);
  const visibleItems = items.filter((item) => !overlongImages.has(item.image) && !isOverlongImage(item.imageWidth, item.imageHeight));

  // Approximate each card's rendered height by its known aspect ratio (fixed column width
  // assumed) so the greedy "shortest column first" distribution reflects real layout instead
  // of just item count.
  const estimateHeight = (item: GalleryCard) => (item.imageWidth > 0 ? item.imageHeight / item.imageWidth : 1);
  const desktopColumns = distributeItems(visibleItems, 5, estimateHeight);
  const mobileColumns = distributeItems(visibleItems, 2, estimateHeight);

  return (
    <>
      {visibleItems.length === 0 && (
        <div className={styles.emptyState} role="status">
          <span className={styles.emptyMark} aria-hidden="true">✳</span>
          <p>{emptyMessage ?? t("emptyDefault")}</p>
        </div>
      )}
      {visibleItems.length > 0 && (
        <>
          <div className={styles.desktopGrid} aria-label={t("waterfallAriaLabel")} data-testid="gallery-grid" data-layout="desktop">
            {desktopColumns.map((column, columnIndex) => <div className={styles.column} key={`desktop-${columnIndex}`}>
              {column.map((item) => <PromptCard key={item.id} prompt={item} onOverlongImage={hideOverlongImage} previewHover={item.id.endsWith("0001")} />)}
            </div>)}
          </div>
          <div className={styles.mobileGrid} aria-label={t("waterfallAriaLabel")} data-layout="mobile">
            {mobileColumns.map((column, columnIndex) => <div className={styles.column} key={`mobile-${columnIndex}`}>
              {column.map((item) => <PromptCard key={item.id} prompt={item} onOverlongImage={hideOverlongImage} previewHover={item.id.endsWith("0001")} />)}
            </div>)}
          </div>
        </>
      )}
      {sentinelRef && (
        <div ref={sentinelRef} className={styles.sentinel} role="status">
          {loadingMore && <span className={styles.loadingMore}>{t("loadingMore")}</span>}
          {!loadingMore && endOfList && <span className={styles.endOfList}>{t("noMoreItems")}</span>}
        </div>
      )}
    </>
  );
}
