"use client";

import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { ArrowUpRight, BookOpen } from "lucide-react";
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
  showCharacterLink?: boolean;
  showGuideLink?: boolean;
}

export function SiteHeader({ user = null, showNavigationRow = true, showCharacterLink = true, showGuideLink = true, ...gallery }: SiteHeaderProps) {
  const t = useTranslations("header");
  const locale = useLocale();
  return (
    <header className={styles.header}>
      <div className={styles.topBar} data-site-topbar>
        <div className={styles.brandGroup}>
          <BrandLogo label={t("creationBrand")} />
          {showCharacterLink && <Link className={styles.characterLink} href="/character-library" locale={locale} aria-label={t("characterCreation")}>
            <span className={styles.characterLabel}>{t("characterCreation")}</span>
            <span className={styles.newBadge} aria-hidden="true">NEW</span>
            <span className={styles.characterPortraits} aria-hidden="true">
              <span><Image src="/character-library/professional-woman.png" alt="" width={130} height={195} sizes="130px" /></span>
              <span><Image src="/character-library/urban-man.png" alt="" width={130} height={195} sizes="130px" /></span>
            </span>
            <ArrowUpRight size={17} aria-hidden="true" />
          </Link>}
        </div>
        <div className={styles.actions}>
          {showGuideLink && <Link href="/guide" className={styles.guideLink} aria-label={t("userGuide")}>
            <BookOpen size={17} aria-hidden="true" />
            <span>{t("userGuide")}</span>
          </Link>}
          {!user && <><ThemeToggleControl /><LanguageToggle ariaLabel={t("languageAriaLabel")} /></>}
          <PublishButton />
          {user ? <UserMenu user={user} preferences={<AccountPreferences />} /> : <Link className={styles.loginButton} href="/login">{t("login")}</Link>}
        </div>
      </div>
      {showNavigationRow && <GalleryToolbar {...gallery} />}
    </header>
  );
}
