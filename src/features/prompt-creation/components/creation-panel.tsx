"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@base-ui/react/button";
import { ArrowLeft, ChevronsRight, History, LoaderCircle, Plus, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ConversationTurn } from "@/types/prompt-conversation";
import { useCreation } from "./creation-provider";
import { CreationComposer } from "./creation-composer";
import { CreationHistory } from "./creation-history";
import { CreationResult } from "./creation-result";
import { creationErrorKey } from "../lib/error-key";
import styles from "./creation.module.css";

function UserMessage({ turn }: { turn: ConversationTurn }) {
  const { workflow } = useCreation();
  const t = useTranslations("promptCreation");
  const [badUrl, setBadUrl] = useState<string | null>(null);
  const url = turn.thumbnail_url || turn.preview_url;
  return <div className={styles.userMessage}>
    {url && url !== badUrl && <>
      {/* eslint-disable-next-line @next/next/no-img-element -- short-lived validated private URL */}
      <img src={url} alt={t("reference")} referrerPolicy="no-referrer" onError={() => setBadUrl(url)} />
    </>}
    {turn.asset_id && (!url || url === badUrl) && <Button type="button" className={styles.textButton} onClick={() => { void workflow.refresh(); }}>{t("refreshImage")}</Button>}
    <span>{turn.user_message || turn.idea_text || t("reference")}</span>
  </div>;
}

export function CreationPanel() {
  const { state, workflow, guard, pendingAction, discard, keep } = useCreation();
  const t = useTranslations("promptCreation");
  const end = useRef<HTMLDivElement>(null);
  const latest = state.conversation?.turns.at(-1);
  const latestPrompt = state.conversation?.turns.filter(turn => turn.status === "succeeded" && turn.response_type !== "assistant" && Boolean(turn.prompt ?? turn.result?.prompt)).at(-1);
  const generating = latest?.status === "queued" || latest?.status === "running";
  const busy = state.phase !== "idle" || state.saving || generating || state.opening;
  const canContinue = !latest || latest.status === "succeeded";
  useEffect(() => { end.current?.scrollIntoView?.({ block: "nearest", behavior: "instant" }); }, [state.conversation?.id, state.conversation?.turns.length, latest?.status]);
  if (!state.expanded) return null;
  return <aside className={styles.panel} aria-label={t("panelLabel")}>
    <header className={styles.panelHeader}>
      {state.view === "history" && <Button className={styles.iconButton} aria-label={t("back")} onClick={workflow.showChat}><ArrowLeft size={17} /></Button>}
      <h2>{t(state.view === "history" ? "historyTitle" : "title")}</h2>
      <Button className={styles.iconButton} disabled={state.phase !== "idle" || state.saving || state.opening} onClick={() => guard(workflow.newConversation)}><Plus size={16} />{t("new")}</Button>
      <Button className={styles.iconButton} onClick={() => guard(() => { void workflow.showHistory(); })}><History size={16} />{t("history")}</Button>
      <Button className={styles.iconButton} aria-label={t("collapse")} onClick={() => workflow.setExpanded(false)}><span>{t("collapse")}</span><ChevronsRight size={17} /></Button>
    </header>
    {pendingAction && <div role="alert" className={styles.confirm}><p>{t("unsaved")}</p><div className={styles.errorActions}><Button className={styles.secondary} disabled={state.saving} onClick={discard}>{t("discard")}</Button><Button className={styles.textButton} onClick={keep}>{t("keep")}</Button></div></div>}
    {state.view === "history" ? <CreationHistory /> : <>
      <div className={styles.thread}>
        {!state.conversation && <div className={styles.empty}>
          {state.phase !== "idle" ? <LoaderCircle className={styles.spinner} size={28} /> : <Sparkles size={26} />}
          <h3>{t(state.opening ? "loading" : state.phase === "idle" ? "emptyTitle" : state.phase)}</h3><p>{t(state.opening || state.phase !== "idle" ? "processingHint" : "emptyHint")}</p>
        </div>}
        <div className={styles.messages}>{state.conversation?.turns.map((turn, index, all) => <div className={styles.messageGroup} key={turn.id}>
          <UserMessage turn={turn} />
          {turn.status === "succeeded" && turn.response_type === "assistant"
            ? <p className={styles.assistantMessage}>{turn.assistant_reply}</p>
            : <CreationResult turn={turn} isLatest={index === all.length - 1} isLatestPrompt={turn.id === latestPrompt?.id} imageConversation={all.some(previous => Boolean(previous.asset_id))} workflow={workflow} state={state} />}
        </div>)}</div>
        <div ref={end} />
      </div>
      <footer className={styles.panelFooter}>
        {state.error && <div className={styles.error} role="alert"><p>{t(creationErrorKey(state.error))}</p>{state.conversation && <Button className={styles.textButton} onClick={() => { void workflow.refresh(); }}>{t("refresh")}</Button>}</div>}
        {latestPrompt && !busy && canContinue && !state.edit && <div className={styles.suggestions}>
          <Button type="button" onClick={() => workflow.setMessage(t("styleDraft"))}>{t("styleSuggestion")}</Button>
          <Button type="button" onClick={() => workflow.setMessage(t("compositionDraft"))}>{t("compositionSuggestion")}</Button>
        </div>}
        <CreationComposer message={state.message} previewUrl={state.previewUrl} followup disabled={busy || !canContinue || Boolean(state.edit)} phase={state.phase}
          onMessage={workflow.setMessage} onSelectFile={workflow.selectFile} onClearAttachment={workflow.clearAttachment} onSend={() => { void workflow.send(); }} />
        <p className={styles.disclaimer}>{t("disclaimer")}</p>
      </footer>
    </>}
  </aside>;
}

export function CreationHomeComposer() {
  const { state, workflow, guard } = useCreation();
  if (state.expanded) return null;
  const latest = state.conversation?.turns.at(-1);
  const busy = state.phase !== "idle" || state.opening || Boolean(state.edit) || Boolean(latest && latest.status !== "succeeded");
  return <section className={styles.home}>
    <CreationComposer message={state.message} previewUrl={state.previewUrl} disabled={busy} phase={state.phase} onMessage={workflow.setMessage}
      onSelectFile={workflow.selectFile} onClearAttachment={workflow.clearAttachment} onSend={() => { void workflow.send(); }}
      onHistory={() => guard(() => { void workflow.showHistory(); })} onContinue={state.conversation ? () => { workflow.setExpanded(true); void workflow.refresh(); } : undefined} />
  </section>;
}
