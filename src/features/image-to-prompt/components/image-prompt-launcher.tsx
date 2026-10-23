"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Button } from "@base-ui/react/button";
import { ArrowLeft, Copy, History, LoaderCircle, RefreshCw, WandSparkles, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { LoginPage } from "@/features/auth/components/login-page";
import { usePromptAnalysis } from "../lib/workflow";
import { ImageInput } from "./image-input";
import { AnalysisResultPane } from "./analysis-result";
import { AnalysisHistory } from "./analysis-history";
import { OutputLanguage } from "./language-select";
import { ImagePromptEntry } from "./image-prompt-entry";
import styles from "./workspace.module.css";
import confirmStyles from "./history.module.css";

export function ImagePromptLauncher({ onOpen, userId = null, announcementAllowed = true }: { onOpen?: () => void; userId?: string | null; announcementAllowed?: boolean }) {
  const t = useTranslations("imageToPrompt");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [login, setLogin] = useState(false);
  const [historyView, setHistoryView] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void | Promise<void>) | null>(null);
  const [language, setLanguage] = useState<"zh" | "en">(locale === "en" ? "en" : "zh");
  const [copyFeedback, setCopyFeedback] = useState<{ value: string; language: string; success: boolean } | null>(null);
  const authEpoch = useRef(0);
  useLayoutEffect(() => { authEpoch.current += 1; }, [userId]);
  useEffect(() => () => { authEpoch.current += 1; }, []);
  const [previousIdentity, setPreviousIdentity] = useState(userId);
  if (previousIdentity !== userId) {
    setPreviousIdentity(userId);
    setPendingAction(null);
    setCopyFeedback(null);
  }
  const unauthorized = useCallback(() => {
    authEpoch.current += 1;
    setPendingAction(null);
    setCopyFeedback(null);
    setLogin(true);
  }, []);
  const flow = usePromptAnalysis({ enabled: open && !login, onUnauthorized: unauthorized, identity: userId });
  const { loadHistory } = flow;
  useEffect(() => { if (open && !login && historyView) void loadHistory(); }, [open, login, historyView, loadHistory]);
  const { setIdentity } = flow;
  const authenticated = useCallback(async () => {
    const epoch = ++authEpoch.current;
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store", credentials: "same-origin", redirect: "error" });
      const value = response.ok ? await response.json() : null;
      if (epoch !== authEpoch.current) return;
      if (!value || typeof value.id !== "string") throw new Error("session_unavailable");
      setPendingAction(null);
      setCopyFeedback(null);
      setIdentity(value.id);
      setLogin(false);
      router.refresh();
    } catch (error) {
      if (epoch === authEpoch.current) throw error;
    }
  }, [router, setIdentity]);
  const pending = ["uploading", "creating", "queued", "running"].includes(flow.phase);
  const activeJob = flow.analysis?.status === "queued" || flow.analysis?.status === "running";
  const completed = flow.analysis?.status === "succeeded" && Boolean(flow.analysis.result);
  const canStart = Boolean(flow.file || flow.asset || flow.analysis?.image_available);
  const feedback = copyFeedback?.language === language && copyFeedback.value === flow.draft[language] ? copyFeedback : null;

  async function copy() {
    const value = flow.draft[language];
    if (!value.trim()) return;
    const epoch = authEpoch.current;
    try { await navigator.clipboard.writeText(value); if (epoch === authEpoch.current) setCopyFeedback({ value, language, success: true }); }
    catch { if (epoch === authEpoch.current) setCopyFeedback({ value, language, success: false }); }
  }
  function guard(action: () => void | Promise<void>) {
    if (flow.analysis?.status === "succeeded" && !flow.saved) setPendingAction(() => action);
    else void action();
  }
  async function reopen(id: string) { guard(async () => { await flow.reopen(id); setHistoryView(false); }); }

  return <>
    <Dialog.Root open={open && !login} onOpenChange={value => { setOpen(value); if (value) setHistoryView(false); }}>
      <ImagePromptEntry onOpen={onOpen} announcementAllowed={announcementAllowed && !open && !login} />
      <Dialog.Portal><Dialog.Backdrop className={styles.backdrop} /><Dialog.Popup className={styles.popup}>
        <header className={styles.heading}><div><Dialog.Title className={styles.title}>{t(historyView ? "history" : "title")}</Dialog.Title><Dialog.Description className={styles.description}>{t("description")}</Dialog.Description></div>
          <div className={styles.headerActions}>
            {historyView ? <Button className={styles.iconButton} aria-label={t("back")} onClick={() => setHistoryView(false)}><ArrowLeft size={20} /></Button>
              : <Button className={styles.iconButton} aria-label={t("history")} title={t("history")} disabled={pending} onClick={() => setHistoryView(true)}><History size={20} /></Button>}
            <Dialog.Close className={styles.iconButton} aria-label={t("close")}><X size={23} strokeWidth={1.4} /></Dialog.Close>
          </div>
        </header>
        {historyView ? <AnalysisHistory items={flow.history} loading={flow.historyLoading} error={flow.historyError} hasMore={flow.hasMore} onLoad={flow.loadHistory} onOpen={reopen} onDelete={flow.removeHistory} /> : <>
          <div className={styles.content}>
            <ImageInput active={open && !login} previewUrl={flow.previewUrl} fileName={flow.file?.name} disabled={pending}
              imageAvailable={flow.analysis?.image_available ?? true} onSelect={file => guard(() => { flow.selectFile(file); })} />
            <AnalysisResultPane analysis={flow.analysis} draft={flow.draft} language={language} phase={flow.phase} error={flow.error}
              saving={flow.saving} saved={flow.saved} saveError={flow.saveError} onEdit={flow.edit} onRetrySave={flow.retrySave} />
          </div>
          <footer className={styles.footer}>
            <OutputLanguage value={language} onChange={setLanguage} />
            <div className={styles.footerActions}>
              {completed ? <><Button className={styles.secondaryButton} disabled={pending || !canStart || flow.saving} onClick={() => guard(() => flow.start({ newAnalysis: true }))}><RefreshCw size={18} />{t("rerun")}</Button><Button className={styles.primaryButton} onClick={() => void copy()} disabled={!flow.draft[language].trim()}><Copy size={19} />{t("copy")}</Button></>
                : <Button className={styles.primaryButton} disabled={pending || !canStart} onClick={() => void (activeJob ? flow.resume() : flow.start({ newAnalysis: Boolean(flow.analysis) }))}>
                  {pending ? <LoaderCircle className={styles.spinner} size={18} /> : activeJob ? <RefreshCw size={18} /> : <WandSparkles size={18} />}
                  {t(pending ? "processing" : activeJob ? "retryConnection" : flow.analysis ? "rerun" : flow.error ? "retry" : "start")}
                </Button>}
            </div>
          </footer>
          {feedback && <p className={styles.copyFeedback} role="status">{t(feedback.success ? "copied" : "copyFailed")}</p>}
        </>}
        <AlertDialog.Root open={pendingAction !== null} onOpenChange={value => { if (!value) setPendingAction(null); }}>
          <AlertDialog.Portal><AlertDialog.Backdrop className={confirmStyles.confirmBackdrop} /><AlertDialog.Popup className={confirmStyles.confirm}>
            <AlertDialog.Title>{t("unsavedTitle")}</AlertDialog.Title><AlertDialog.Description>{t("unsavedDescription")}</AlertDialog.Description>
            <div className={confirmStyles.confirmActions}><AlertDialog.Close className={styles.secondaryButton}>{t("keepEditing")}</AlertDialog.Close><Button className={styles.primaryButton} onClick={() => { const action = pendingAction; setPendingAction(null); void action?.(); }}>{t("continueChange")}</Button></div>
          </AlertDialog.Popup></AlertDialog.Portal>
        </AlertDialog.Root>
      </Dialog.Popup></Dialog.Portal>
    </Dialog.Root>
    {login && <LoginPage onAuthenticated={authenticated} onClose={() => { authEpoch.current += 1; setLogin(false); setOpen(false); }} />}
  </>;
}
