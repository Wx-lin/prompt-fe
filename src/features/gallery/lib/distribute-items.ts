/**
 * Distributes items across columns using a greedy "shortest column first" strategy,
 * matching real masonry layouts (e.g. Xiaohongshu): each item goes into whichever column
 * currently has the smallest estimated total height, rather than a fixed round-robin
 * assignment. Round-robin ignores actual image heights and produces uneven, gappy columns
 * whenever a few tall images cluster into the same column.
 *
 * `estimateHeight` lets callers approximate each item's rendered height (e.g. from a known
 * aspect ratio) so the greedy choice reflects real layout, not just item count.
 */
export function distributeItems<T>(
  items: readonly T[],
  columnCount: number,
  estimateHeight: (item: T) => number = () => 1,
): T[][] {
  if (!Number.isInteger(columnCount) || columnCount < 1) {
    return [];
  }

  const columns = Array.from({ length: columnCount }, () => [] as T[]);
  const columnHeights = new Array<number>(columnCount).fill(0);

  items.forEach((item) => {
    let shortestIndex = 0;
    for (let index = 1; index < columnCount; index += 1) {
      if (columnHeights[index] < columnHeights[shortestIndex]) shortestIndex = index;
    }
    columns[shortestIndex].push(item);
    columnHeights[shortestIndex] += estimateHeight(item);
  });

  return columns;
}
