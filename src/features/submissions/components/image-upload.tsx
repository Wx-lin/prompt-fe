"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@base-ui/react/button";
import { Icon } from "@/components/icons/icon";
import { useTranslations } from "next-intl";
import { validImage } from "@/lib/submissions/validation";
import type { SubmissionUpload } from "@/types/submission";
import styles from "./image-upload.module.css";

type Entry = { key: number; file: File; preview: string; status: "uploading" | "success" | "error"; result?: SubmissionUpload };
interface Props { onChange: (uploads: SubmissionUpload[], blocked: boolean) => void; onUnauthorized: () => void; disabled?: boolean }

export function ImageUpload({ onChange, onUnauthorized, disabled = false }: Props) {
  const t = useTranslations("submissions");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const current = useRef<Entry[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const nextKey = useRef(0);
  const mounted = useRef(true);
  const controllers = useRef(new Map<number, AbortController>());
  const callbacks = useRef({ onChange, onUnauthorized });
  useEffect(() => { callbacks.current = { onChange, onUnauthorized }; }, [onChange, onUnauthorized]);

  function update(next: Entry[]) {
    current.current = next;
    setEntries(next);
    callbacks.current.onChange(next.flatMap(item => item.result ? [item.result] : []), next.some(item => item.status !== "success"));
  }
  async function upload(entry: Entry) {
    const controller = new AbortController();
    controllers.current.set(entry.key, controller);
    try {
      const body = new FormData();
      body.append("file", entry.file);
      const response = await fetch("/api/submissions/upload", { method: "POST", body, signal: controller.signal });
      if (response.status === 401) {
        if (mounted.current && !controller.signal.aborted)
          callbacks.current.onUnauthorized();
        throw new Error("unauthorized");
      }
      if (!response.ok)
        throw new Error("upload");
      const result = await response.json() as SubmissionUpload;
      if (!result.id || !result.image_url)
        throw new Error("invalid response");
      if (mounted.current && !controller.signal.aborted)
        update(current.current.map(item => item.key === entry.key ? { ...item, status: "success", result } : item));
    }
    catch {
      if (mounted.current && !controller.signal.aborted)
        update(current.current.map(item => item.key === entry.key ? { ...item, status: "error" } : item));
    }
    finally {
      if (controllers.current.get(entry.key) === controller)
        controllers.current.delete(entry.key);
    }
  }
  function add(files: File[]) {
    if (disabled || !files.length)
      return;
    if (current.current.length + files.length > 6 || files.some(file => !validImage(file))) {
      setError(t("imageError"));
      return;
    }
    setError("");
    const added: Entry[] = files.map(file => ({ key: nextKey.current++, file, preview: typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : "", status: "uploading" }));
    update([...current.current, ...added]);
    added.forEach(entry => { void upload(entry); });
  }
  function remove(entry: Entry) {
    controllers.current.get(entry.key)?.abort();
    if (entry.preview)
      URL.revokeObjectURL(entry.preview);
    update(current.current.filter(item => item.key !== entry.key));
    setError("");
  }
  useEffect(() => {
    mounted.current = true;
    const activeControllers = controllers.current;
    return () => {
      mounted.current = false;
      activeControllers.forEach(controller => controller.abort());
      current.current.forEach(entry => {
        if (entry.preview)
          URL.revokeObjectURL(entry.preview);
      });
    };
  }, []);
  useEffect(() => {
    function paste(event: ClipboardEvent) {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, [contenteditable]:not([contenteditable=false])"))
        return;
      const files = Array.from(event.clipboardData?.items ?? []).filter(item => item.kind === "file").flatMap(item => { const file = item.getAsFile(); return file ? [file] : []; });
      if (files.length) {
        event.preventDefault();
        add(files);
      }
    }
    document.addEventListener("paste", paste);
    return () => document.removeEventListener("paste", paste);
  });
  return <section className={styles.root}>
    <div className={styles.heading}><label htmlFor="artwork-upload">{t("images")}</label><span>{entries.length} / 6</span></div>
    <input tabIndex={-1} ref={input} className={styles.input} id="artwork-upload" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={disabled} aria-describedby="upload-hint" onChange={event => {
      add(Array.from(event.target.files ?? []));
      event.target.value = "";
    }} />
    <Button type="button" data-testid="image-dropzone" className={`${styles.dropzone} ${dragging ? styles.dragging : ""}`} aria-disabled={disabled}
      onClick={() => { if (!disabled) input.current?.click(); }}
      onDragOver={event => { event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={event => { event.preventDefault(); setDragging(false); add(Array.from(event.dataTransfer.files)); }}
>
      <span className={styles.icon}><Icon name="download" size={24} className={styles.uploadIcon} /></span>
      <strong>{t("uploadAction")}</strong><span>{t("uploadPasteHint")}</span>
    </Button>
    <p id="upload-hint" className={styles.hint}>{t("imageHint")}</p>
    <div className={styles.grid}>
      {entries.map((entry, index) => <article key={entry.key} className={styles.card}>
        {/* eslint-disable-next-line @next/next/no-img-element -- local object URL and private upload previews */}
        <img src={entry.preview || entry.result?.image_url} alt={t("preview", { index: index + 1 })} />
        {index === 0 && <span className={styles.cover}>{t("cover")}</span>}
        <Button type="button" className={styles.remove} disabled={disabled} aria-label={`${t("remove")} ${entry.file.name}`} onClick={() => remove(entry)}>×</Button>
        <div className={styles.details}><span className={styles.filename} title={entry.file.name}>{entry.file.name}</span>
          <span role="status">{t(entry.status === "success" ? "uploadSuccess" : entry.status === "error" ? "uploadFailed" : "uploading")}</span>
          {entry.status === "error" && <Button type="button" disabled={disabled} onClick={() => { update(current.current.map(item => item.key === entry.key ? { ...item, status: "uploading" } : item)); void upload(entry); }}>{t("retry")}</Button>}
        </div>
      </article>)}
    </div>
    {error && <p role="alert" className={styles.hint}>{error}</p>}
  </section>;
}
