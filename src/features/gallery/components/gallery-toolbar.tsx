"use client";

import { useTranslations } from "next-intl";
import { SelectField } from "@/components/select-field/select-field";
import { CategoryNav } from "./category-nav";
import { SearchTriggerGroup } from "./search-trigger-group";
import type { ModelOption } from "@/lib/api/client";
import type { Category } from "@/types/prompt";
import styles from "./gallery-toolbar.module.css";

export interface GalleryToolbarProps {
  categories: Category[];
  activeCategory: string;
  activeSort: string;
  activeModel: string;
  models: ModelOption[];
  query?: string;
  compact?: boolean;
}

/** Search belongs to the gallery; creation has its own input above or beside it. */
export function GalleryToolbar({ categories, activeCategory, activeSort, activeModel, models, query = "", compact = false }: GalleryToolbarProps) {
  const t = useTranslations("header");
  const filters = new URLSearchParams();
  if (query) filters.set("q", query);
  if (activeCategory !== "all") filters.set("category", activeCategory);
  if (activeSort !== "recommended" || query) filters.set("sort", activeSort);
  if (activeModel !== "all") filters.set("models", activeModel);
  const searchFilters = new URLSearchParams(filters);
  searchFilters.delete("q");
  function categoryHref(category: string) {
    const params = new URLSearchParams(filters);
    if (category === "all") params.delete("category");
    else params.set("category", category);
    return params.size ? `/?${params}` : "/";
  }
  const sortOptions = [
    { label: t("sortRecommended"), value: "recommended" },
    { label: t("sortLatest"), value: "latest" },
    { label: t("sortPopular"), value: "popular" },
    { label: t("sortHot"), value: "hot" },
  ];
  const modelOptions = [
    { label: t("allModels"), value: "all" },
    ...models.map((model) => ({ label: model.label, value: model.key, group: model.group })),
  ];
  return (
    <div className={`${styles.toolbar} ${compact ? styles.compact : ""}`} data-gallery-toolbar>
      <CategoryNav categories={categories} activeCategory={activeCategory} categoryHref={categoryHref} categoriesAriaLabel={t("categoriesAriaLabel")} />
      <div className={styles.controls}>
        <div className={styles.searchSlot}><SearchTriggerGroup query={query} filters={searchFilters.toString()} /></div>
        <div className={styles.filters} aria-label={t("filtersAriaLabel")}>
          <SelectField label={t("sortLabel")} name="sort" options={sortOptions} defaultValue={activeSort} />
          <SelectField label={t("modelLabel")} name="models" options={modelOptions} defaultValue={activeModel} />
        </div>
      </div>
    </div>
  );
}
