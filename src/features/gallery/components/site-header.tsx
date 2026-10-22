"use client";

import type { ModelOption } from "@/lib/api/client";

import { useTranslations } from "next-intl";
import { BrandLogo } from "@/components/brand/brand-logo";
import { SelectField } from "@/components/select-field/select-field";
import { ThemeToggleControl } from "@/components/theme-provider/theme-toggle-control";
import { LanguageToggle } from "./language-toggle";
import { AccountPreferences } from "@/features/auth/components/account-preferences";
import { PublishButton } from "./publish-button";
import { UserMenu } from "@/features/auth/components/user-menu";
import { CategoryNav } from "@/features/gallery/components/category-nav";
import { SearchTriggerGroup } from "@/features/gallery/components/search-trigger-group";
import { Link } from "@/i18n/navigation";
import type { Category, CurrentUser } from "@/types/prompt";
import styles from "./site-header.module.css";

interface SiteHeaderProps {
  categories: Category[];
  activeCategory: string;
  activeSort: string;
  activeModel: string;
  models: ModelOption[];
  query?: string;
  user?: CurrentUser | null;
  showNavigationRow?: boolean;
}

export function SiteHeader({
  categories,
  activeCategory,
  activeSort,
  activeModel,
  models,
  query = "",
  user = null,
  showNavigationRow = true,
}: SiteHeaderProps) {
  const t = useTranslations("header");
  const filters = new URLSearchParams();
  if (query) filters.set("q", query);
  if (activeCategory !== "all") filters.set("category", activeCategory);
  if (activeSort !== "recommended" || query) filters.set("sort", activeSort);
  if (activeModel !== "all") filters.set("models", activeModel);
  const popoverFilters = new URLSearchParams(filters);
  popoverFilters.delete("q");

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
    <header className={styles.header}>
      <div className={styles.topBar}>
        <BrandLogo />
        <div className={styles.searchSlot}>
          <SearchTriggerGroup query={query} filters={popoverFilters.toString()} userId={user?.id ?? null} />
        </div>
        <div className={styles.actions}>
          {!user && (
            <>
              <ThemeToggleControl />
              <LanguageToggle ariaLabel={t("languageAriaLabel")} />
            </>
          )}
          <PublishButton />
          {user ? (
            <UserMenu user={user} preferences={<AccountPreferences />} />
          ) : (
            <Link className={styles.loginButton} href="/login">{t("login")}</Link>
          )}
        </div>
      </div>

      {showNavigationRow && (
        <div className={styles.navigationRow}>
          <CategoryNav
            categories={categories}
            activeCategory={activeCategory}
            categoryHref={categoryHref}
            categoriesAriaLabel={t("categoriesAriaLabel")}
          />

          <div className={styles.filters} aria-label={t("filtersAriaLabel")}>
            <SelectField label={t("sortLabel")} name="sort" options={sortOptions} defaultValue={activeSort} />
            <SelectField label={t("modelLabel")} name="models" options={modelOptions} defaultValue={activeModel} />
          </div>
        </div>
      )}
    </header>
  );
}
