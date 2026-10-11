"use client";

import { useTranslations } from "next-intl";
import { Menu } from "@base-ui/react/menu";
import { Icon } from "@/components/icons/icon";
import { Link, useRouter } from "@/i18n/navigation";
import type { CurrentUser } from "@/types/prompt";
import styles from "./user-menu.module.css";

export function UserMenu({ user }: { user: CurrentUser }) {
  const t = useTranslations("header");
  const router = useRouter();
  const label = user.nickname ?? user.email ?? t("defaultNickname");

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <Menu.Root>
      <Menu.Trigger className={styles.trigger} aria-label={t("userMenuAriaLabel")}>
        {user.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- small decorative avatar, not worth next/image's overhead here
          <img src={user.avatar_url} alt="" width={34} height={34} referrerPolicy="no-referrer" />
        ) : (
          <span aria-hidden="true">{label.slice(0, 1)}</span>
        )}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className={styles.positioner} sideOffset={10} align="end">
          <Menu.Popup className={styles.popup}>
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
            <div className={styles.separator} role="separator" />
            <Menu.Item className={styles.item} render={<Link href="/collections" />}>
              <Icon name="bookmark" size={16} />
              {t("myCollections")}
            </Menu.Item>
            <Menu.Item className={styles.item} onClick={logout}>
              {t("logout")}
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
