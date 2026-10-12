import { GalleryGrid } from "@/features/gallery/components/gallery-grid";
import { demoPrompts } from "@/features/gallery/data/demo-prompts";
import type { GalleryCard } from "@/types/prompt";
import styles from "./gallery-backdrop.module.css";

/**
 * Read-only gallery grid rendered behind full-page overlays (login, and any other
 * standalone route reached by direct URL rather than the intercepted modal), so the
 * backdrop blur has artwork to blur instead of showing a flat background color.
 */
export function GalleryBackdrop({ items = demoPrompts }: { items?: GalleryCard[] }) {
  return (
    <div className={styles.backdrop} aria-hidden="true" inert>
      <GalleryGrid items={items} />
    </div>
  );
}
