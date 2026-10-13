"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Menu } from "@base-ui/react/menu";
import { Check, ChevronLeft, ChevronRight, Languages, Monitor, Moon, Sun } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useTheme } from "@/components/theme-provider/theme-provider";
import { usePathname, useRouter } from "@/i18n/navigation";
import styles from "./user-menu.module.css";

type Page = "theme" | "language" | null;
export const AccountPageContext = createContext<{ page: Page; setPage: (page: Page) => void } | null>(null);

export function AccountPreferences() {
  const { preference, setPreference } = useTheme();
  const t = useTranslations("theme");
  const header = useTranslations("header");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const query = useSearchParams().toString();
  const [mobile, setMobile] = useState(false);
  const [localPage, setLocalPage] = useState<Page>(null);
  const context = useContext(AccountPageContext);
  const page = context?.page ?? localPage;
  const setPage = context?.setPage ?? setLocalPage;
  const firstItem = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 600px)");
    const change = () => { setMobile(media.matches); setPage(null); };
    change();
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, [setPage]);
  useEffect(() => {
    if (mobile)
      firstItem.current?.focus();
  }, [page, mobile]);
  const ThemeIcon = preference === "light" ? Sun : preference === "dark" ? Moon : Monitor;
  function options(kind: Exclude<Page, null>) {
    if (kind === "theme")
      return <Menu.RadioGroup aria-label={t("label")} value={preference} onValueChange={value => { if (value === "system" || value === "light" || value === "dark") setPreference(value); }}>
        {(["system", "light", "dark"] as const).map(value => {
          const OptionIcon = value === "system" ? Monitor : value === "light" ? Sun : Moon;
          return <Menu.RadioItem ref={mobile && value === "system" ? firstItem : undefined} className={styles.item} key={value} value={value} closeOnClick={false}>
            <OptionIcon size={18} aria-hidden="true" /><span>{t(value)}</span>
            <Menu.RadioItemIndicator className={styles.check}><Check size={16} aria-hidden="true" /></Menu.RadioItemIndicator>
          </Menu.RadioItem>;
        })}
      </Menu.RadioGroup>;
    return <Menu.RadioGroup aria-label={header("language")} value={locale} onValueChange={value => {
      if (value === "zh" || value === "en")
        router.replace(query ? `${pathname}?${query}` : pathname, { locale: value });
    }}>
      {(["zh", "en"] as const).map(value => <Menu.RadioItem ref={mobile && value === "zh" ? firstItem : undefined} className={styles.item} key={value} value={value} closeOnClick>
        <span>{value === "zh" ? "简体中文" : "English"}</span>
        <Menu.RadioItemIndicator className={styles.check}><Check size={16} aria-hidden="true" /></Menu.RadioItemIndicator>
      </Menu.RadioItem>)}
    </Menu.RadioGroup>;
  }
  function row(kind: Exclude<Page, null>) {
    const RowIcon = kind === "theme" ? ThemeIcon : Languages;
    return <><RowIcon size={18} aria-hidden="true" /><span className={styles.rowLabel}>{kind === "theme" ? header("appearance") : header("language")}</span><span className={styles.current}>{kind === "theme" ? t(preference) : locale === "zh" ? "简体中文" : "English"}</span><ChevronRight size={15} aria-hidden="true" /></>;
  }
  if (mobile && page)
    return <><Menu.Item className={`${styles.item} ${styles.back}`} closeOnClick={false} onClick={() => setPage(null)}><ChevronLeft size={18} aria-hidden="true" />{header("back")}</Menu.Item><Menu.Separator className={styles.separator} />{options(page)}</>;
  return <>{(["theme", "language"] as const).map(kind => mobile
    ? <Menu.Item ref={kind === "theme" ? firstItem : undefined} className={styles.item} key={kind} closeOnClick={false} onClick={() => setPage(kind)}>{row(kind)}</Menu.Item>
    : <Menu.SubmenuRoot key={kind}><Menu.SubmenuTrigger className={styles.item}>{row(kind)}</Menu.SubmenuTrigger><Menu.Portal><Menu.Positioner className={styles.positioner} sideOffset={8} alignOffset={-4}><Menu.Popup className={`${styles.popup} ${styles.submenu}`}>{options(kind)}</Menu.Popup></Menu.Positioner></Menu.Portal></Menu.SubmenuRoot>)}</>;
}
