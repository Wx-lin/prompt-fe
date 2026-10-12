"use client";

import { Menu } from "@base-ui/react/menu";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/icons/icon";
import { useTheme } from "@/components/theme-provider/theme-provider";
import { Link, usePathname } from "@/i18n/navigation";
import styles from "./user-menu.module.css";

export function AccountPreferences() {
  const { theme, toggleTheme } = useTheme();
  const t = useTranslations("theme");
  const locale = useLocale();
  const pathname = usePathname();
  const query = useSearchParams().toString();
  return (
    <>
      <Menu.Item className={styles.item} onClick={toggleTheme}>
        <Icon name={theme === "dark" ? "sun" : "moon"} size={16} />
        {t(theme === "dark" ? "switchToLight" : "switchToDark")}
      </Menu.Item>
      <Menu.Item className={styles.item} render={<Link href={query ? `${pathname}?${query}` : pathname} locale={locale === "zh" ? "en" : "zh"} />}>
        {locale === "zh" ? "English" : "简体中文"}
      </Menu.Item>
    </>
  );
}
