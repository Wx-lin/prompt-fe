"use client";

import { useTranslations } from "next-intl";
import { Icon } from "@/components/icons/icon";
import type { Theme } from "@/lib/theme/theme";
import styles from "./theme-toggle.module.css";

interface ThemeToggleProps {
  theme: Theme;
  onToggle: () => void;
}

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const t = useTranslations("theme");
  const nextLabel = theme === "light" ? t("switchToDark") : t("switchToLight");

  return (
    <button
      className={styles.button}
      type="button"
      aria-label={nextLabel}
      onClick={onToggle}
    >
      <Icon name={theme === "light" ? "sun" : "moon"} size={20} />
    </button>
  );
}
