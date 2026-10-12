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
      <svg className={styles.mark} viewBox="0 0 40 40" fill="currentColor" aria-hidden="true" focusable="false">
        <path d="M2 12V2h10v4H6v6ZM28 2h10v10h-4V6h-6ZM38 28v10H28v-4h6v-6ZM12 38H2V28h4v6h6Z" />
        <path d="M18 11c-6 1-9 5-9 11v7h10V19h-5c0-2 1-3 4-4ZM31 11c-6 1-9 5-9 11v7h10V19h-5c0-2 1-3 4-4Z" />
      </svg>
      <span className={styles.productName}>{tMeta("siteName")}</span>
    </Link>
  );
}
