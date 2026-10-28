"use client";

import { useState } from "react";
import { Button } from "@base-ui/react/button";
import { ArrowRight, LoaderCircle, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCreation } from "./creation-provider";
import { creationErrorKey } from "../lib/error-key";
import styles from "./creation.module.css";

export function CreationHistory() {
  const { state, workflow, guard } = useCreation();
  const t = useTranslations("promptCreation");
  const locale = useLocale();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function remove(id: string) { setBusy(true); await workflow.removeConversation(id); setBusy(false); setDeleting(null); }
  return <div className={styles.history}>
    {state.historyError && <p role="alert" className={styles.error}>{t(creationErrorKey(state.historyError))}</p>}
    {!state.historyLoading && !state.historyError && !state.history.length && <p className={styles.error}>{t("historyEmpty")}</p>}
    <ul className={styles.historyList}>{state.history.map(item => {
      const date = new Date(item.created_at);
      return <li key={item.id} className={styles.historyItem}>
        <div className={styles.historyRow}>
          <Button type="button" className={styles.historyOpen} onClick={() => guard(() => { void workflow.openConversation(item.id); })}>{item.title || t("title")}<ArrowRight size={14} /></Button>
          <Button type="button" className={styles.iconButton} aria-label={t("delete")} disabled={busy} onClick={() => setDeleting(item.id)}><Trash2 size={15} /></Button>
        </div>
        <p className={styles.historyMeta}>{Number.isNaN(date.valueOf()) ? "" : date.toLocaleDateString(locale)} · {t("historyTurns", { count: item.version })} · {t(item.status === "succeeded" ? "saved" : item.status)}</p>
        {deleting === item.id && <div className={styles.confirm} role="alert"><p>{t("deleteConfirm")}</p><div className={styles.errorActions}><Button className={styles.secondary} disabled={busy} onClick={() => { void remove(item.id); }}>{t("confirmDelete")}</Button><Button className={styles.textButton} disabled={busy} onClick={() => setDeleting(null)}>{t("cancel")}</Button></div></div>}
      </li>;
    })}</ul>
    {state.historyLoading && <p role="status" className={styles.error}><LoaderCircle className={styles.spinner} size={16} /> {t("loading")}</p>}
    {state.hasMore && <Button className={styles.secondary} disabled={state.historyLoading} onClick={() => { void workflow.loadHistory(true); }}>{t("more")}</Button>}
  </div>;
}
