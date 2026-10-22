"use client";

import { useState } from "react";
import { Button } from "@base-ui/react/button";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { FileImage, History, LoaderCircle, Trash2, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { AnalysisSummary } from "@/types/prompt-analysis";
import { AnalysisErrorNotice } from "./analysis-result";
import styles from "./history.module.css";
import shared from "./workspace.module.css";

interface HistoryProps {
  items: AnalysisSummary[];
  loading: boolean;
  error: { code: string; status?: number } | null;
  hasMore: boolean;
  onOpen: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onLoad: (more?: boolean) => Promise<void>;
}

function Thumbnail({ item }: { item: AnalysisSummary }) {
  const [broken, setBroken] = useState(false);
  return <span className={styles.thumbnail}>{item.thumbnail_url && !broken
    // eslint-disable-next-line @next/next/no-img-element -- short-lived authenticated preview
    ? <img src={item.thumbnail_url} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
    : <FileImage size={24} strokeWidth={1.3} />}</span>;
}

export function AnalysisHistory({ items, loading, error, hasMore, onOpen, onDelete, onLoad }: HistoryProps) {
  const t = useTranslations("imageToPrompt");
  const locale = useLocale();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  async function open(id: string) { setOpening(id); try { await onOpen(id); } finally { setOpening(null); } }
  async function remove() {
    if (!deleting || deletingBusy) return;
    setDeletingBusy(true);
    try { await onDelete(deleting); setDeleting(null); }
    finally { setDeletingBusy(false); }
  }
  function date(value: string) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.valueOf()) ? "" : new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(parsed);
  }
  return <section className={styles.history} aria-label={t("history")}>
    <p className={styles.privacy}>{t("privacyHint")}</p>
    {items.length === 0 ? <div className={shared.resultEmpty}>
      {loading ? <LoaderCircle className={shared.spinner} size={40} strokeWidth={1.3} /> : <History size={40} strokeWidth={1.3} />}
      <h3>{t(loading ? "historyLoading" : error ? "historyFailed" : "historyEmpty")}</h3>
      {!loading && !error && <p>{t("historyEmptyHint")}</p>}
    </div> : <ul className={styles.list}>{items.map(item => <li key={item.id} className={styles.row}>
      <Button className={styles.open} aria-label={`${t("openRecord")} ${item.title || t("untitled")}`} disabled={Boolean(opening)} onClick={() => void open(item.id)}>
        <Thumbnail item={item} /><span className={styles.rowContent}><strong>{item.title || t("untitled")}</strong><span className={styles.summary}>{item.summary[locale === "en" ? "en" : "zh"] || t(item.status)}</span><time dateTime={item.created_at}>{date(item.created_at)}</time></span>
        {opening === item.id ? <LoaderCircle className={shared.spinner} size={17} /> : <ChevronRight size={17} />}
      </Button>
      <Button className={shared.iconButton} aria-label={`${t("deleteRecord")} ${item.title || t("untitled")}`} onClick={() => setDeleting(item.id)} disabled={deletingBusy}><Trash2 size={17} /></Button>
    </li>)}</ul>}
    <AnalysisErrorNotice error={error} />
    {(hasMore || error) && <Button className={styles.loadMore} disabled={loading} onClick={() => void onLoad(!error)}>{t(error ? "retry" : loading ? "historyLoading" : "loadMore")}</Button>}
    <AlertDialog.Root open={deleting !== null} onOpenChange={value => { if (!value && !deletingBusy) setDeleting(null); }}>
      <AlertDialog.Portal><AlertDialog.Backdrop className={styles.confirmBackdrop} /><AlertDialog.Popup className={styles.confirm}>
        <AlertDialog.Title>{t("deleteTitle")}</AlertDialog.Title><AlertDialog.Description>{t("deleteDescription")}</AlertDialog.Description>
        <div className={styles.confirmActions}><AlertDialog.Close className={shared.secondaryButton} disabled={deletingBusy}>{t("cancel")}</AlertDialog.Close><Button className={shared.primaryButton} disabled={deletingBusy} onClick={() => void remove()}>{t("confirmDelete")}</Button></div>
      </AlertDialog.Popup></AlertDialog.Portal>
    </AlertDialog.Root>
  </section>;
}
