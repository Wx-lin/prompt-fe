"use client";

import { Tabs } from "@base-ui/react/tabs";
import { Button } from "@base-ui/react/button";
import { FileText, LoaderCircle, Pencil, Check, CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AnalysisDetail, BilingualPrompt } from "@/types/prompt-analysis";
import { PROMPT_LIMITS } from "../lib/client";
import styles from "./workspace.module.css";

type SafeError = { code: string; status?: number };
interface AnalysisResultProps {
  analysis: AnalysisDetail | null;
  draft: BilingualPrompt;
  language: "zh" | "en";
  phase: string;
  error: SafeError | null;
  saving: boolean;
  saved: boolean;
  saveError: SafeError | null;
  onEdit: (language: "zh" | "en", value: string) => void;
  onRetrySave: () => void;
}

export function AnalysisErrorNotice({ error }: { error: SafeError | null }) {
  const t = useTranslations("imageToPrompt");
  if (!error) return null;
  const code = error.code;
  const key = error.status === 401 ? "signin"
    : code === "INVALID_IMAGE" ? "imageError"
    : code === "ANALYSIS_IN_PROGRESS" ? "inProgress"
    : code.includes("DAILY") || code.includes("QUOTA") ? "quotaLimit"
    : error.status === 429 ? "rateLimit"
    : error.status === 404 ? "notFound"
    : error.status === 503 ? "unavailable" : "networkError";
  return <p className={styles.inlineError} role="alert"><CircleAlert size={16} />{t(key)}</p>;
}

export function AnalysisResultPane({ analysis, draft, language, phase, error, saving, saved, saveError, onEdit, onRetrySave }: AnalysisResultProps) {
  const t = useTranslations("imageToPrompt");
  const result = analysis?.status === "succeeded" ? analysis.result : null;
  const pending = ["uploading", "creating", "queued", "running"].includes(phase);
  const terminal = ["failed", "unknown", "canceled"].includes(phase);
  const status = pending ? phase as "uploading" | "creating" | "queued" | "running" : terminal ? phase as "failed" | "unknown" | "canceled" : null;
  return <Tabs.Root defaultValue="prompt" className={styles.resultPane}>
    <Tabs.List className={styles.tabs} aria-label={t("title")}>
      <Tabs.Tab className={styles.tab} value="prompt">{t("complete")}</Tabs.Tab>
      <Tabs.Tab className={styles.tab} value="breakdown">{t("breakdown")}</Tabs.Tab>
    </Tabs.List>
    <Tabs.Panel value="prompt" className={styles.tabPanel}>
      {result ? <>
        <textarea className={styles.promptText} aria-label={t("complete")} lang={language}
          maxLength={PROMPT_LIMITS[language]} value={draft[language]} spellCheck={false}
          onChange={event => onEdit(language, event.target.value)} />
        <div className={styles.editorHint}>
          <Pencil size={16} /><span>{t("editHint")}</span>
          <span className={styles.saveStatus} role="status">{saving ? t("saving") : saveError ? t(saveError.code === "REVISION_CONFLICT" ? "saveConflict" : "unsaved") : saved ? <><Check size={13} />{t("saved")}</> : t("unsaved")}</span>
        </div>
        {saveError?.code === "REVISION_CONFLICT" ? <p className={styles.inlineError}>{t("conflictHint")}</p>
          : saveError && <Button className={styles.textButton} onClick={onRetrySave} disabled={saving}>{t("retrySave")}</Button>}
      </> : <div className={styles.resultEmpty} role={pending ? "status" : undefined}>
        {pending ? <LoaderCircle className={styles.spinner} size={44} strokeWidth={1.2} /> : terminal ? <CircleAlert size={44} strokeWidth={1.2} /> : <FileText size={44} strokeWidth={1.2} />}
        <h3>{status ? t(status) : t("resultEmpty")}</h3>
        <p>{pending ? t("processingHint") : phase === "unknown" ? t("unknownHint") : terminal ? t("failedHint") : t("resultHint")}</p>
      </div>}
    </Tabs.Panel>
    <Tabs.Panel value="breakdown" className={styles.tabPanel}>
      {result ? <div className={styles.breakdown}>
        {(["subject", "composition", "lighting", "style"] as const).map(key => <section key={key}><h3>{t(key)}</h3><p lang={language}>{result.breakdown[key][language] || t("notObserved")}</p></section>)}
        {result.uncertain_details.length > 0 && <section className={styles.uncertain}><h3>{t("uncertain")}</h3><ul>{result.uncertain_details.map((item, index) => <li key={index}>{item}</li>)}</ul></section>}
      </div> : <div className={styles.resultEmpty}><FileText size={44} strokeWidth={1.2} /><h3>{t("resultEmpty")}</h3><p>{t("resultHint")}</p></div>}
    </Tabs.Panel>
    <AnalysisErrorNotice error={error} />
  </Tabs.Root>;
}
