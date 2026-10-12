"use client";

import { Menu } from "@base-ui/react/menu";
import { useTranslations } from "next-intl";
import { AccountPreferences } from "./account-preferences";
import styles from "./user-menu.module.css";

export function PreferencesMenu() {
  const t = useTranslations("header");
  return (
    <Menu.Root>
      <Menu.Trigger className={styles.preferencesTrigger} aria-label={t("preferences")}>
        <span aria-hidden="true">···</span>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className={styles.positioner} align="end" sideOffset={10}>
          <Menu.Popup className={styles.popup}><AccountPreferences /></Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
