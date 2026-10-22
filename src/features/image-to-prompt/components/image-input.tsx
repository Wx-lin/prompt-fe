"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@base-ui/react/button";
import { ImageIcon, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { validImage } from "@/lib/submissions/validation";
import styles from "./workspace.module.css";

interface ImageInputProps {
  active: boolean;
  previewUrl: string | null;
  fileName?: string;
  disabled?: boolean;
  imageAvailable?: boolean;
  onSelect: (file: File) => void;
}

export function ImageInput({ active, previewUrl, fileName, disabled = false, imageAvailable = true, onSelect }: ImageInputProps) {
  const t = useTranslations("imageToPrompt");
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const id = useId();
  const latest = useRef({ onSelect, active, disabled });
  useEffect(() => { latest.current = { onSelect, active, disabled }; }, [onSelect, active, disabled]);

  function select(files: File[]) {
    if (!latest.current.active || latest.current.disabled || !files.length) return;
    if (files.length !== 1 || !validImage(files[0])) { setInvalid(true); return; }
    setInvalid(false);
    latest.current.onSelect(files[0]);
  }
  useEffect(() => {
    function paste(event: ClipboardEvent) {
      if (!latest.current.active || latest.current.disabled) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input,textarea,[contenteditable]:not([contenteditable=false])")) return;
      const files = Array.from(event.clipboardData?.items ?? [])
        .filter(item => item.kind === "file")
        .flatMap(item => { const file = item.getAsFile(); return file ? [file] : []; });
      if (files.length) { event.preventDefault(); select(files); }
    }
    document.addEventListener("paste", paste);
    return () => document.removeEventListener("paste", paste);
  }, []);

  return <section className={styles.reference} aria-label={t("reference")}>
    <h3>{t("reference")}</h3>
    <input ref={input} id={id} className={styles.fileInput} type="file" accept="image/jpeg,image/png,image/webp"
      aria-label={t("fileLabel")} disabled={disabled} tabIndex={-1}
      onChange={event => { select(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
    {previewUrl ? <>
      <div className={styles.referenceStage}>
        {/* eslint-disable-next-line @next/next/no-img-element -- local object URL or short-lived private preview */}
        <img src={previewUrl} alt={t("referenceImage")} referrerPolicy="no-referrer" />
      </div>
      <div className={styles.referenceCaption}><span title={fileName}>{t("referenceImage")}</span><Button className={styles.smallButton} disabled={disabled} onClick={() => input.current?.click()}><RefreshCw size={16} />{t("replace")}</Button></div>
    </> : <>
      <Button type="button" className={`${styles.dropzone} ${dragging ? styles.dragging : ""}`} data-testid="prompt-image-dropzone" aria-label={t("choose")} disabled={disabled}
        onClick={() => input.current?.click()}
        onDragOver={event => { event.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={event => { event.preventDefault(); setDragging(false); select(Array.from(event.dataTransfer.files)); }}>
        <ImageIcon className={styles.imageIcon} size={44} strokeWidth={1.2} />
        <strong>{imageAvailable ? t("dropTitle") : t("imageExpired")}</strong>
        <span>{t("pasteHint")}</span>
        <span className={styles.chooseLabel}>{t("choose")}</span>
      </Button>
      <p className={styles.imageHint}>{t("imageHint")}</p>
      <p className={styles.beforeStart}>{t("beforeStart")}</p>
    </>}
    {invalid && <p className={styles.inlineError} role="alert">{t("imageError")}</p>}
  </section>;
}
