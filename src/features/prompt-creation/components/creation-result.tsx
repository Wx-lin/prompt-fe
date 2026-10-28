"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@base-ui/react/button";
import { Collapsible } from "@base-ui/react/collapsible";
import { Tabs } from "@base-ui/react/tabs";
import { Check, ChevronDown, CircleAlert, Copy, FileText, LoaderCircle, Pencil, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ConversationTurn, PromptConversationDetail } from "@/types/prompt-conversation";
import type { ConversationState, ConversationWorkflow } from "../lib/workflow";
import styles from "./result.module.css";

type Language = "zh" | "en";
type CopyFeedback = { id: string; revision: number; language: Language; text: string; success: boolean; conversation: PromptConversationDetail };
type Props = { turn: ConversationTurn; isLatest: boolean; isLatestPrompt?: boolean; imageConversation: boolean; workflow: ConversationWorkflow; state: ConversationState };

function CreationJobState({ turn, isLatest, workflow, state }: Pick<Props, "turn" | "isLatest" | "workflow" | "state">) {
  const t = useTranslations("promptCreation");
  const busy = state.phase !== "idle" || state.saving;
  return <div className={styles.jobState}>
    {["queued", "running"].includes(turn.status) ? <>
      <div role="status" className={styles.stateTitle}><LoaderCircle className={styles.spinner} size={20} aria-hidden="true" />{t(turn.status === "queued" ? "queued" : "running")}</div>
      <p>{t("processingHint")}</p><div className={styles.skeleton} aria-hidden="true"><span /><span /><span /></div>
    </> : <>
      <p className={styles.stateTitle}><CircleAlert size={18} aria-hidden="true" />{t(turn.status === "unknown" ? "unknown" : turn.status === "canceled" ? "canceled" : "failed")}</p>
      {turn.status === "unknown" && <p>{t("unknownHint")}</p>}
      {isLatest && ["failed", "canceled"].includes(turn.status) && <Button className={styles.secondaryButton} disabled={busy || Boolean(state.edit)} onClick={() => void workflow.retryTurn(turn.id)}><RefreshCw size={15} aria-hidden="true" />{t("retry")}</Button>}
      {(turn.status === "unknown" || turn.status === "succeeded") && <Button className={styles.secondaryButton} disabled={busy} onClick={() => void workflow.refresh()}><RefreshCw size={15} aria-hidden="true" />{t("refresh")}</Button>}
    </>}
  </div>;
}

function saveErrorKey(error: NonNullable<ConversationState["saveError"]>) {
  if (error.code === "REVISION_CONFLICT") return "saveConflict";
  if (error.code === "INVALID_PROMPT") return "invalidPrompt";
  if (error.status === 401) return "signin";
  if (error.status === 404) return "notFound";
  if (error.status === 429) return "rateLimit";
  return error.status === 503 ? "unavailable" : "networkError";
}

export function CreationResult({ turn, isLatest, isLatestPrompt = isLatest, imageConversation, workflow, state }: Props) {
  const t = useTranslations("promptCreation");
  const imageText = useTranslations("imageToPrompt");
  const [language, setLanguage] = useState<Language>("zh");
  const [disclosure, setDisclosure] = useState<{ id: string; open: boolean } | null>(null);
  const [feedback, setFeedback] = useState<CopyFeedback | null>(null);
  const copySequence = useRef(0);
  useEffect(() => () => { copySequence.current += 1; }, []);
  const edit = state.edit?.turnId === turn.id ? state.edit : null;
  const currentLanguage = edit?.language ?? language;
  const prompt = turn.prompt ?? turn.result?.prompt ?? null;
  const ready = turn.status === "succeeded" && prompt !== null;
  const open = Boolean(edit) || (disclosure?.id === turn.id ? disclosure.open : isLatestPrompt);
  const busy = state.phase !== "idle" || state.saving;
  const latest = state.conversation?.turns.at(-1);
  const canEdit = !busy && !state.edit && !["queued", "running"].includes(latest?.status ?? "");
  const displayText = edit?.text ?? prompt?.[currentLanguage] ?? "";
  const visibleFeedback = feedback?.id === turn.id && feedback.revision === turn.revision && feedback.language === currentLanguage && feedback.text === displayText && feedback.conversation === state.conversation ? feedback : null;

  function switchLanguage(value: unknown) {
    if (value !== "zh" && value !== "en") return;
    copySequence.current += 1;
    setFeedback(null); setLanguage(value);
  }
  async function copy() {
    const conversation = workflow.getSnapshot().conversation;
    const sourceEdit = workflow.getSnapshot().edit;
    const current = conversation?.turns.find(item => item.id === turn.id);
    if (!conversation || !current || current.revision !== turn.revision || !displayText.trim()) return;
    const sequence = ++copySequence.current;
    let success = true;
    try { await navigator.clipboard.writeText(displayText); } catch { success = false; }
    // Clipboard completion must never announce an old account, turn or draft.
    const now = workflow.getSnapshot();
    if (sequence !== copySequence.current || now.conversation !== conversation || now.edit !== sourceEdit) return;
    setFeedback({ id: turn.id, revision: turn.revision, language: currentLanguage, text: displayText, success, conversation });
  }

  if (!ready) return <CreationJobState turn={turn} isLatest={isLatest} workflow={workflow} state={state} />;
  const number = turn.prompt_number ?? turn.version;
  return <Collapsible.Root className={styles.card} open={open} onOpenChange={value => setDisclosure({ id: turn.id, open: value })}>
    <Collapsible.Trigger className={styles.heading} disabled={Boolean(edit)} aria-label={`${t("version", { version: number })} · ${open ? t("fold") : t("expand")}`}>
      <FileText size={17} aria-hidden="true" />
      <span className={styles.version}>{t("version", { version: number })}</span>
      {isLatestPrompt && <span className={styles.current}>{t("current")}</span>}
      <span className={styles.title}>{turn.title}</span>
      <span className={styles.disclosure}>{open ? t("fold") : t("expand")}<ChevronDown size={15} aria-hidden="true" /></span>
    </Collapsible.Trigger>
    <Collapsible.Panel className={styles.panel}>
        <Tabs.Root value={currentLanguage} onValueChange={switchLanguage}>
          <div className={styles.promptHeading}>
            <h3>{edit ? t("editTitle", { language: t(currentLanguage) }) : t("prompt")}</h3>
            <Tabs.List className={styles.languages} aria-label={t("language")} hidden={Boolean(edit)}>
              <Tabs.Tab className={styles.language} value="zh">{t("zh")}</Tabs.Tab>
              <Tabs.Tab className={styles.language} value="en">{t("en")}</Tabs.Tab>
            </Tabs.List>
          </div>
          {(["zh", "en"] as const).map(value => <Tabs.Panel key={value} value={value} className={styles.promptPanel}>
            {value === currentLanguage && (edit ? <>
              <textarea className={styles.editor} aria-label={t("editTitle", { language: t(currentLanguage) })} value={edit.text} disabled={state.saving} onChange={event => { copySequence.current += 1; workflow.setEditText(event.target.value); }} />
              {state.saveError && <p role="alert" className={styles.error}><CircleAlert size={15} aria-hidden="true" />{t(saveErrorKey(state.saveError))}</p>}
            </> : <p className={styles.promptText} lang={currentLanguage} tabIndex={0}>{displayText}</p>)}
          </Tabs.Panel>)}
        </Tabs.Root>
        {!edit && turn.result && <Collapsible.Root className={styles.breakdown}>
          <Collapsible.Trigger className={styles.breakdownTrigger}>
            <span>{t(imageConversation ? "breakdown" : "creativePoints")}</span><span className={styles.breakdownHint}>{t("subject")} · {t("composition")} · {t("lighting")} · {t("style")}</span><ChevronDown size={15} aria-hidden="true" />
          </Collapsible.Trigger>
          <Collapsible.Panel className={styles.breakdownContent}>
            {(["subject", "composition", "lighting", "style"] as const).map(key => <section key={key}><h4>{t(key)}</h4><p lang={currentLanguage}>{turn.result!.breakdown[key][currentLanguage] || t("notObserved")}</p></section>)}
            {turn.result.uncertain_details.length > 0 && <section><h4>{imageText("uncertain")}</h4><ul>{turn.result.uncertain_details.map((item, index) => <li key={index}>{item}</li>)}</ul></section>}
          </Collapsible.Panel>
        </Collapsible.Root>}
        <div className={styles.actions}>
          {edit ? <>
            <Button className={styles.quietButton} onClick={() => void copy()} disabled={state.saving || !displayText.trim()}><Copy size={16} aria-hidden="true" />{t("copy", { language: t(currentLanguage) })}</Button>
            <div className={styles.editActions}>
              <Button className={styles.secondaryButton} onClick={() => workflow.cancelEdit()} disabled={state.saving}>{t("cancel")}</Button>
              <Button className={styles.primaryButton} onClick={() => void workflow.saveEdit()} disabled={state.saving || state.saveError?.code === "REVISION_CONFLICT"}>{state.saving ? t("saving") : t("save")}</Button>
            </div>
          </> : <>
            <Button className={styles.quietButton} onClick={() => workflow.beginEdit(turn.id, language)} disabled={!canEdit}><Pencil size={16} aria-hidden="true" />{t("edit")}</Button>
            {turn.saved_to_history && <span className={styles.saved}><Check size={14} aria-hidden="true" />{t("saved")}</span>}
            <Button className={styles.primaryButton} onClick={() => void copy()} disabled={!displayText.trim()}><Copy size={16} aria-hidden="true" />{t("copy", { language: t(currentLanguage) })}</Button>
          </>}
        </div>
        {visibleFeedback && <p role="status" className={styles.feedback}>{t(visibleFeedback.success ? "copied" : "copyFailed", { language: t(visibleFeedback.language) })}</p>}
    </Collapsible.Panel>
  </Collapsible.Root>;
}
