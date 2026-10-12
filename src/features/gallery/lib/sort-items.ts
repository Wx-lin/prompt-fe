interface SortableGalleryItem {
  like_count?: number | null;
  view_count?: number | null;
  created_at?: string | null;
}

function sortValue(item: SortableGalleryItem, sort: string): number {
  const value = sort === "popular"
    ? item.like_count
    : sort === "hot"
      ? item.view_count
      : Date.parse(item.created_at ?? "");

  // Missing metrics must not outrank valid zero counts or old timestamps.
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : Number.NEGATIVE_INFINITY;
}

/** Returns a stable, descending copy; unknown sort keys fall back to latest. */
export function sortGalleryItems<T extends SortableGalleryItem>(items: readonly T[], sort: string): T[] {
  return items.toSorted((first, second) => {
    const firstValue = sortValue(first, sort);
    const secondValue = sortValue(second, sort);
    return firstValue === secondValue ? 0 : secondValue - firstValue;
  });
}
