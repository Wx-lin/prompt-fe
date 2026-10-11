"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import styles from "./brand-logo.module.css";

interface BrandLogoProps {
  /** @default "default" */
  size?: "default" | "compact";
}

export function BrandLogo({ size = "default" }: BrandLogoProps) {
  const t = useTranslations("brand");
  const tMeta = useTranslations("metadata");

  return (
    <Link className={`${styles.logo} ${size === "compact" ? styles.compact : ""}`} href="/" aria-label={t("homeAriaLabel")}>
      <span className={styles.wordmark} aria-hidden="true">
        AIGC
        <span className={styles.pixelMark}>
          <i />
          <i />
          <i />
        </span>
      </span>
      <span className={styles.divider} aria-hidden="true" />
      <span className={styles.productName}>{tMeta("siteName")}</span>
    </Link>
  );
}
