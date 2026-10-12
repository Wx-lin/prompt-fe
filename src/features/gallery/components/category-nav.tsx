"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { Icon } from "@/components/icons/icon";
import { Link } from "@/i18n/navigation";
import type { Category } from "@/types/prompt";
import styles from "./category-nav.module.css";

const pinnedCount = 4;

interface CategoryNavProps {
  categories: Category[];
  activeCategory: string;
  categoryHref: (category: string) => string;
  categoriesAriaLabel: string;
}

/**
 * Keeps the header from being overrun once the backend's category list grows: only the first
 * `pinnedCount` categories stay pinned inline, the rest live behind an "all categories" popover
 * (plain list, since the backend has no category-group field to group them by).
 */
export function CategoryNav({ categories, activeCategory, categoryHref, categoriesAriaLabel }: CategoryNavProps) {
  const t = useTranslations("header");
  const tCategories = useTranslations("categories");
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  function categoryLabel(category: Category): string {
    try {
      return tCategories(category.key as Parameters<typeof tCategories>[0]);
    } catch {
      return category.label;
    }
  }

  const pinned = categories.slice(0, pinnedCount);
  const overflow = categories.slice(pinnedCount);
  const overflowHasActive = overflow.some((category) => category.key === activeCategory);

  return (
    <nav className={styles.nav} aria-label={categoriesAriaLabel}>
      <Link
        className={`${styles.item} ${activeCategory === "all" ? styles.active : ""}`}
        href={categoryHref("all")}
        aria-current={activeCategory === "all" ? "page" : undefined}
      >
        {t("allCategory")}
      </Link>
      {pinned.map((category) => (
        <Link
          key={category.key}
          className={`${styles.item} ${activeCategory === category.key ? styles.active : ""}`}
          href={categoryHref(category.key)}
          aria-current={activeCategory === category.key ? "page" : undefined}
        >
          {categoryLabel(category)}
        </Link>
      ))}

      {overflow.length > 0 && (
        <Popover.Root open={open} onOpenChange={setOpen}>
          <Popover.Trigger
            ref={anchorRef}
            className={`${styles.item} ${styles.moreTrigger} ${overflowHasActive ? styles.active : ""}`}
          >
            {t("allCategoriesTrigger")}
            <Icon name="chevron" size={12} style={{ transform: open ? "rotate(180deg)" : undefined }} />
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner side="bottom" align="start" sideOffset={10} className={styles.positioner}>
              <Popover.Popup className={styles.popup}>
                <div className={styles.grid}>
                  {overflow.map((category) => (
                    <Link
                      key={category.key}
                      className={`${styles.gridItem} ${activeCategory === category.key ? styles.gridItemActive : ""}`}
                      href={categoryHref(category.key)}
                      aria-current={activeCategory === category.key ? "page" : undefined}
                      onClick={() => setOpen(false)}
                    >
                      {categoryLabel(category)}
                    </Link>
                  ))}
                </div>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      )}
    </nav>
  );
}
