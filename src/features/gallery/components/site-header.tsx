"use client";

import { useTranslations } from "next-intl";
import { BrandLogo } from "@/components/brand/brand-logo";
import { ThemeToggleControl } from "@/components/theme-provider/theme-toggle-control";
import { AccountPreferences } from "@/features/auth/components/account-preferences";
import { UserMenu } from "@/features/auth/components/user-menu";
import { Link } from "@/i18n/navigation";
import type { CurrentUser } from "@/types/prompt";
import { GalleryToolbar, type GalleryToolbarProps } from "./gallery-toolbar";
import { LanguageToggle } from "./language-toggle";
import { PublishButton } from "./publish-button";
import styles from "./site-header.module.css";

interface SiteHeaderProps extends GalleryToolbarProps {
  user?: CurrentUser | null;
  showNavigationRow?: boolean;
}

export function SiteHeader({ user = null, showNavigationRow = true, ...gallery }: SiteHeaderProps) {
  const t = useTranslations("header");
  return (
    <header className={styles.header}>
      <div className={styles.topBar} data-site-topbar>
        <BrandLogo label={t("creationBrand")} />
        <div className={styles.actions}>
          {!user && <><ThemeToggleControl /><LanguageToggle ariaLabel={t("languageAriaLabel")} /></>}
          <PublishButton />
          {user ? <UserMenu user={user} preferences={<AccountPreferences />} /> : <Link className={styles.loginButton} href="/login">{t("login")}</Link>}
        </div>
      </div>
      {showNavigationRow && <GalleryToolbar {...gallery} />}
    </header>
  );
}
