"use client";

import { Menu } from "@base-ui/react/menu";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

import { useTheme } from "@/components/theme-provider/theme-provider";
import { Link, usePathname } from "@/i18n/navigation";
import styles from "./user-menu.module.css";

export function AccountPreferences() {
  const { preference, setPreference } = useTheme();
  const t = useTranslations("theme");
  const locale = useLocale();
  const pathname = usePathname();
  const query = useSearchParams().toString();
  return (
    <>
      <Menu.RadioGroup aria-label={t("label")} value={preference} onValueChange={setPreference}>
        {(["system", "light", "dark"] as const).map(value => (
          <Menu.RadioItem className={styles.item} key={value} value={value}>
            <span aria-hidden="true" style={{ width: 16 }}>{preference === value ? "✓" : ""}</span>
            {t(value)}
          </Menu.RadioItem>
        ))}
      </Menu.RadioGroup>
      <Menu.Item className={styles.item} render={<Link href={query ? `${pathname}?${query}` : pathname} locale={locale === "zh" ? "en" : "zh"} />}>
        {locale === "zh" ? "English" : "简体中文"}
      </Menu.Item>
    </>
  );
}
