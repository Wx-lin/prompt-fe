"use client";

import { Popover } from "@base-ui/react/popover";
import { useTranslations } from "next-intl";
import styles from "./site-header.module.css";

/** Visible entry for the upcoming publishing flow; never routes to an unimplemented page. */
export function PublishButton() {
  const t = useTranslations("header");
  return (
    <Popover.Root>
      <Popover.Trigger className={styles.publishButton}>
        <span className={styles.plus} aria-hidden="true">+</span>
        <span>{t("publish")}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={10} className={styles.publishPositioner}>
          <Popover.Popup className={styles.publishPopup}>
            <Popover.Title className={styles.publishTitle}>{t("publishSoon")}</Popover.Title>
            <Popover.Description className={styles.publishDescription}>{t("publishDescription")}</Popover.Description>
            <Popover.Close className={styles.publishClose}>{t("gotIt")}</Popover.Close>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
