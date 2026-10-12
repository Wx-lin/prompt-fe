"use client";

import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, usePathname } from "@/i18n/navigation";
import styles from "./language-toggle.module.css";

const otherLocale = { zh: "en", en: "zh" } as const;

/** Swaps the active locale while preserving the current path and query string. */
export function LanguageToggle({ ariaLabel }: { ariaLabel: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const target = otherLocale[locale as keyof typeof otherLocale] ?? "en";
  const query = searchParams.toString();
  const href = (query ? `${pathname}?${query}` : pathname) as Parameters<typeof Link>[0]["href"];

  return (
    <Link className={styles.language} href={href} locale={target} aria-label={ariaLabel}>
      {locale === "zh" ? "中 / EN" : "EN / 中"}
    </Link>
  );
}
