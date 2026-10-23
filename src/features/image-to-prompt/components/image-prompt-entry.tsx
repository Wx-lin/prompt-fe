"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Popover } from "@base-ui/react/popover";
import { Button } from "@base-ui/react/button";
import { ArrowRight, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { dismissAnnouncement, getAnnouncementSnapshot, getServerAnnouncementSnapshot, subscribeAnnouncement } from "../lib/announcement";
import styles from "./image-prompt-entry.module.css";

export function ImagePromptEntry({ onOpen, announcementAllowed = true }: { onOpen?: () => void; announcementAllowed?: boolean }) {
  const t = useTranslations("imageToPrompt");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const announcement = useSyncExternalStore(subscribeAnnouncement, getAnnouncementSnapshot, getServerAnnouncementSnapshot);
  const campaignActive = announcement === "active" || announcement === "dismissed";
  useEffect(() => {
    if (!announcementAllowed && announcement === "active") dismissAnnouncement();
  }, [announcementAllowed, announcement]);

  function announcementOffset() {
    const trigger = triggerRef.current;
    const header = trigger?.closest("header");
    if (!trigger || !header || window.innerWidth > 1200) return 14;
    // Compact headers wrap categories and filters below the entry.
    return Math.max(14, header.getBoundingClientRect().bottom - trigger.getBoundingClientRect().bottom + 12);
  }

  return <>
    <Dialog.Trigger ref={triggerRef} className={styles.entry} data-image-prompt-entry aria-label={t("entry")} onClick={() => { dismissAnnouncement(); onOpen?.(); }}>
      <svg className={styles.icon} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <path d="M14 17H4a1.5 1.5 0 0 1-1.5-1.5v-11A1.5 1.5 0 0 1 4 3h13a1.5 1.5 0 0 1 1.5 1.5V11" />
        <circle cx="7" cy="7.5" r="1.2" />
        <path d="m3 14 5-5 4 4 2-2 3 3M15 17h6M15 21h6" />
      </svg>
      <span>{t("entry")}</span>
      {campaignActive && <span className={styles.badge} aria-hidden="true">NEW</span>}
    </Dialog.Trigger>
    <Popover.Root open={announcementAllowed && announcement === "active"} modal={false} onOpenChange={value => { if (!value) dismissAnnouncement(); }}>
      <Popover.Portal>
        <Popover.Positioner anchor={triggerRef} className={styles.positioner} side="bottom" align="end" sideOffset={announcementOffset} collisionPadding={16} arrowPadding={24} collisionAvoidance={{ side: "flip", align: "shift" }}>
          <Popover.Popup className={styles.popup} data-feature-announcement initialFocus={false} finalFocus={false}>
            <Popover.Arrow className={styles.arrow} data-feature-arrow />
            <p className={styles.eyebrow}>{t("announcementEyebrow")}</p>
            <Popover.Close className={styles.dismiss} aria-label={t("announcementDismiss")}><X size={17} strokeWidth={1.6} /></Popover.Close>
            <Popover.Title className={styles.title}>{t("announcementTitle")}</Popover.Title>
            <Popover.Description className={styles.description}>{t("announcementDescription")}</Popover.Description>
            <Button className={styles.action} onClick={() => triggerRef.current?.click()}>{t("announcementAction")}<ArrowRight size={17} strokeWidth={1.6} aria-hidden="true" /></Button>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  </>;
}
