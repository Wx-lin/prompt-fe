"use client";

import { useId, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@base-ui/react/button";
import { ArrowUpRight, History, ImagePlus, LoaderCircle, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { validImage } from "@/lib/submissions/validation";
import { useTextareaSize } from "../lib/use-textarea-size";
import styles from "./creation.module.css";

type Props = {
  message: string; previewUrl: string | null; disabled?: boolean; followup?: boolean; phase?: "idle" | "uploading" | "creating";
  onMessage: (message: string) => void; onSelectFile: (file: File) => void; onClearAttachment: () => void;
  onSend: () => void; onHistory?: () => void; onContinue?: () => void;
};

const isTouchInput = () => window.matchMedia?.("(pointer: coarse)").matches ?? false;
const desktopInput = () => false;
function subscribeInputMode(listener: () => void) {
  const media = window.matchMedia?.("(pointer: coarse)");
  media?.addEventListener("change", listener);
  return () => media?.removeEventListener("change", listener);
}

export function CreationComposer({ message, previewUrl, disabled = false, followup = false, phase = "idle", onMessage, onSelectFile, onClearAttachment, onSend, onHistory, onContinue }: Props) {
  const t = useTranslations("promptCreation");
  const input = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const composing = useRef(false);
  const touch = useSyncExternalStore(subscribeInputMode, isTouchInput, desktopInput);
  const [invalid, setInvalid] = useState(false);
  const [dragging, setDragging] = useState(false);
  const id = useId();
  const placeholder = t(followup ? "followupPlaceholder" : "placeholder");
  const count = Array.from(message).length;
  const canSend = !disabled && (message.trim().length > 0 || Boolean(previewUrl));
  useTextareaSize(textarea, message);
  function select(files: File[]) {
    if (disabled || !files.length) return;
    if (files.length !== 1 || !validImage(files[0])) { setInvalid(true); return; }
    setInvalid(false); onSelectFile(files[0]);
  }

  return <div className={styles.composerWrap}>
    <form className={`${styles.composer} ${dragging ? styles.dragging : ""} ${followup ? styles.followupComposer : ""}`}
      onSubmit={event => { event.preventDefault(); if (canSend) onSend(); }}
      onDragOver={event => { event.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
      onDrop={event => { event.preventDefault(); setDragging(false); select(Array.from(event.dataTransfer.files)); }}>
      {previewUrl && <div className={styles.attachment}>
        {/* eslint-disable-next-line @next/next/no-img-element -- local object URL or server-validated public/private reference */}
        <img src={previewUrl} alt={t("reference")} referrerPolicy="no-referrer" />
        <Button type="button" className={styles.removeImage} aria-label={t("removeImage")} onClick={onClearAttachment} disabled={disabled}><X size={14} /></Button>
      </div>}
      <textarea ref={textarea} id={id} className={styles.idea} aria-label={placeholder} aria-describedby={`${id}-keyboard`} placeholder={placeholder} value={message} rows={2}
        disabled={disabled} maxLength={1000}
        onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}
        onChange={event => onMessage(Array.from(event.target.value).slice(0, 500).join(""))}
        onPaste={event => { const files = Array.from(event.clipboardData.files); if (files.length) { event.preventDefault(); select(files); } }}
        onKeyDown={event => {
          if (event.key !== "Enter" || event.shiftKey || event.altKey || composing.current || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
          if (isTouchInput() && !event.ctrlKey && !event.metaKey) return;
          event.preventDefault();
          if (canSend && !event.repeat) onSend();
        }} />
      <div className={styles.composerTools}>
        <input ref={input} className={styles.fileInput} type="file" accept="image/jpeg,image/png,image/webp" aria-label={t("fileLabel")} tabIndex={-1} disabled={disabled}
          onChange={event => { select(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
        <Button className={styles.upload} type="button" onClick={() => input.current?.click()} disabled={disabled}><ImagePlus size={18} /><span>{t(followup ? "upload" : "imageToPrompt")}</span></Button>
        <span className={styles.composerSpacer} />
        {count > 0 && <span className={styles.count}>{count}/500</span>}
        {onContinue && <Button type="button" className={styles.textButton} onClick={onContinue}>{t("continue")}</Button>}
        {onHistory && <Button type="button" className={styles.textButton} onClick={onHistory} aria-label={t("history")}><History size={17} /><span>{t("history")}</span></Button>}
        <Button type="submit" className={styles.send} disabled={!canSend} title={t("sendHint")} aria-label={t("sendFollowup")}>
          {phase !== "idle" ? <LoaderCircle className={styles.spinner} size={17} /> : <><span>{t("sendFollowup")}</span><ArrowUpRight size={17} /></>}
        </Button>
      </div>
    </form>
    <p id={`${id}-keyboard`} className={styles.keyboardHint}>{t(touch ? "touchHint" : "keyboardHint")}</p>
    {invalid && <p className={styles.error} role="alert">{t("imageInvalid")}</p>}
  </div>;
}
