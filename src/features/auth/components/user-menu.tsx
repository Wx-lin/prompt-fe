"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Menu } from "@base-ui/react/menu";
import { ChevronDown, Image as ImageIcon, LogOut, Star } from "lucide-react";
import { AccountPageContext } from "./account-preferences";
import { Link, useRouter } from "@/i18n/navigation";
import type { CurrentUser } from "@/types/prompt";
import styles from "./user-menu.module.css";

export function UserMenu({ user, preferences }: { user: CurrentUser; preferences?: ReactNode }) {
  const [page, setPage] = useState<"theme" | "language" | null>(null);
  const t = useTranslations("header");
  const router = useRouter();
  const label = user.nickname ?? user.email ?? t("defaultNickname");

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <Menu.Root onOpenChange={open => { if (!open) setPage(null); }}>
      <Menu.Trigger className={styles.trigger} aria-label={t("userMenuAriaLabel")}>
        {user.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- small decorative avatar, not worth next/image's overhead here
          <img src={user.avatar_url} alt="" width={34} height={34} referrerPolicy="no-referrer" />
        ) : (
          <span className={styles.avatar} aria-hidden="true">{label.slice(0, 1)}</span>
        )}
        <ChevronDown aria-hidden="true" size={16} className={styles.chevron} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className={styles.positioner} sideOffset={10} align="end">
          <Menu.Popup className={styles.popup}>
            <AccountPageContext.Provider value={{ page, setPage }}>
            {!page && <>
            <div className={styles.identity}>
              <span className={styles.identityAvatar} aria-hidden="true">
                {user.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- small decorative avatar
                  <img src={user.avatar_url} alt="" width={32} height={32} referrerPolicy="no-referrer" />
                ) : (
                  label.slice(0, 1)
                )}
              </span>
              <span className={styles.identityName}>{label}</span>
            </div>
            <Menu.Separator className={styles.separator} />
            <Menu.Item className={styles.item} render={<Link href="/collections" />}>
              <Star size={18} className={styles.favorite} aria-hidden="true" />
              {t("myCollections")}
            </Menu.Item>
            <Menu.Item className={styles.item} render={<Link href="/my-works" />}>
              <ImageIcon size={18} aria-hidden="true" />
              {t("myWorks")}
            </Menu.Item>
            <Menu.Separator className={styles.separator} />
            </>}
            {preferences}
            {!page && <Menu.Separator className={styles.separator} />}
            {!page && <Menu.Item className={styles.item} onClick={logout}>
              <LogOut size={18} aria-hidden="true" />
              {t("logout")}
            </Menu.Item>}
            </AccountPageContext.Provider>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
