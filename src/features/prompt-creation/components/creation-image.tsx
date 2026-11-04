"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Download, Maximize2, Pencil, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ConversationTurn } from "@/types/prompt-conversation";
import type { ConversationWorkflow } from "../lib/workflow";
import styles from "./creation-image.module.css";

export function CreationImage({ turn, workflow }: { turn: ConversationTurn; workflow: ConversationWorkflow }) {
  const t = useTranslations("promptCreation");
  const [badUrl, setBadUrl] = useState<string | null>(null);
  const image = turn.generated_image;
  if (!image) return <div className={styles.unavailable}><p>{t("imageUnavailable")}</p><button type="button" onClick={() => void workflow.refresh()}>{t("refresh")}</button></div>;
  const download = `/api/prompt-conversations/${encodeURIComponent(turn.conversation_id)}/images/${encodeURIComponent(image.id)}/download`;
  return <div className={styles.result}>
    {badUrl === image.url ? <div className={styles.unavailable}><p>{t("imageUnavailable")}</p><button type="button" onClick={() => void workflow.refresh()}>{t("refresh")}</button></div> :
      <Dialog.Root>
        <div className={styles.frame}>
          <Dialog.Trigger className={styles.imageTrigger} aria-label={t("enlargeImage")}>
            {/* eslint-disable-next-line @next/next/no-img-element -- short-lived private URL */}
            <img src={image.url} alt={t("generatedImage")} width={image.width} height={image.height} referrerPolicy="no-referrer" onError={() => setBadUrl(image.url)} />
          </Dialog.Trigger>
          <button type="button" className={styles.edit} aria-label={t("editImage")} onClick={() => workflow.selectGeneratedImage(image)}><Pencil size={15} />{t("editImage")}</button>
        </div>
        <Dialog.Portal><Dialog.Backdrop className={styles.backdrop} /><Dialog.Popup className={styles.dialog}>
          <Dialog.Title className={styles.srOnly}>{t("generatedImage")}</Dialog.Title>
          <Dialog.Close className={styles.close} aria-label={t("closeImage")}><X size={20} /></Dialog.Close>
          {/* eslint-disable-next-line @next/next/no-img-element -- short-lived private URL */}
          <img src={image.url} alt="" referrerPolicy="no-referrer" />
        </Dialog.Popup></Dialog.Portal>
      </Dialog.Root>}
    <div className={styles.actions}>
      <a href={download} aria-label={t("downloadImage")} title={t("downloadImage")}><Download size={17} /></a>
      {badUrl === image.url && <span>{t("refreshImage")}</span>}
      <Maximize2 size={15} aria-hidden="true" />
    </div>
  </div>;
}
