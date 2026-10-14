"use client";

import { useTranslations } from "next-intl";
import gridStyles from "./gallery-grid.module.css";
import styles from "./gallery-skeleton.module.css";

const aspectRatios = [3 / 4, 1, 4 / 5, 2 / 3, 4 / 3];

export function GallerySkeletonCard({ index }: { index: number }) {
  return (
    <div className={styles.card} aria-hidden="true" data-testid="gallery-skeleton-card">
      <div className={styles.image} style={{ aspectRatio: aspectRatios[index % aspectRatios.length] }} />
      <div className={styles.title} />
      <div className={styles.caption} />
    </div>
  );
}

export function GallerySkeleton() {
  const t = useTranslations("gallery");
  return (
    <div role="status" aria-label={t("loading")} aria-busy="true" data-testid="gallery-skeleton">
      {[{ name: "desktop", columns: 5 }, { name: "mobile", columns: 2 }].map(({ name, columns }) => (
        <div key={name} className={name === "desktop" ? gridStyles.desktopGrid : gridStyles.mobileGrid} aria-hidden="true">
          {Array.from({ length: columns }, (_, column) => (
            <div className={gridStyles.column} key={column}>
              {Array.from({ length: 10 / columns }, (_, row) => (
                <GallerySkeletonCard key={row} index={column + row * columns} />
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function GalleryLoading() {
  return (
    <main>
      <div className={styles.header} aria-hidden="true">
        <div className={styles.headerRow}><div className={styles.brand} /><div className={styles.search} /></div>
        <div className={styles.navigation}>{Array.from({ length: 5 }, (_, index) => <div key={index} />)}</div>
      </div>
      <GallerySkeleton />
    </main>
  );
}
