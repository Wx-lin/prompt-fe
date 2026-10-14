"use client";

import { useTranslations } from "next-intl";
import { Select } from "@base-ui/react/select";
import { Icon } from "@/components/icons/icon";
import { SelectOptions } from "@/components/select-field/select-options";
import { Link, useRouter } from "@/i18n/navigation";
import { isCurrentCategory } from "../data/categories";
import type { Category } from "@/types/prompt";
import styles from "./category-nav.module.css";
import selectStyles from "@/components/select-field/select-field.module.css";

const pinnedKeys = ["portrait", "avatar", "poster", "illustration"];
interface CategoryNavProps {
  categories: Category[];
  activeCategory: string;
  categoryHref: (category: string) => string;
  categoriesAriaLabel: string;
}

export function CategoryNav({ categories, activeCategory, categoryHref, categoriesAriaLabel }: CategoryNavProps) {
  const t = useTranslations("header");
  const tCategories = useTranslations("categories");
  const router = useRouter();
  const catalog = categories.filter(category => isCurrentCategory(category.key));
  const pinned = pinnedKeys.flatMap(key => catalog.filter(category => category.key === key));
  const options = catalog.map(category => ({
    value: category.key,
    label: `${tCategories(category.key)} (${category.count})${category.count === 0 ? ` · ${t("noContent")}` : ""}`,
    disabled: category.count === 0,
  }));
  return (
    <nav className={styles.nav} aria-label={categoriesAriaLabel}>
      <Link className={`${styles.item} ${activeCategory === "all" ? styles.active : ""}`} href={categoryHref("all")} aria-current={activeCategory === "all" ? "page" : undefined}>{t("allCategory")}</Link>
      {pinned.map(category => category.count === 0 ? (
        <span key={category.key} className={styles.item} aria-disabled="true" title={t("noContent")}>{tCategories(category.key)}</span>
      ) : (
        <Link key={category.key} className={`${styles.item} ${activeCategory === category.key ? styles.active : ""}`} href={categoryHref(category.key)} aria-current={activeCategory === category.key ? "page" : undefined}>{tCategories(category.key)}</Link>
      ))}
      <Select.Root items={options} value={isCurrentCategory(activeCategory) ? activeCategory : null} onValueChange={value => { if (value) router.push(categoryHref(value)); }}>
        <Select.Trigger className={`${styles.item} ${styles.moreTrigger}`} aria-label={t("allCategoriesTrigger")}>{t("allCategoriesTrigger")}<Icon name="chevron" size={12} /></Select.Trigger>
        <Select.Portal>
          <Select.Positioner side="bottom" align="start" sideOffset={10} alignItemWithTrigger={false} collisionPadding={12} className={selectStyles.positioner}>
            <Select.Popup className={selectStyles.popup}><Select.List className={selectStyles.list}><SelectOptions options={options} /></Select.List></Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    </nav>
  );
}
