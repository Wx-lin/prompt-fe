"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import styles from "./site-header.module.css";

export function PublishButton() {
  const t = useTranslations("header");
  return <Link className={styles.publishButton} href="/publish" aria-label={t("publish")}>
    <span className={styles.plus} aria-hidden="true">
      +
    </span>
    <span className={styles.publishLabel}>
      {t("publish")}
    </span>
  </Link>;
}
