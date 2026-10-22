"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { validImage } from "@/lib/submissions/validation";
import type { AnalysisAsset, AnalysisDetail, AnalysisStatus, AnalysisSummary, BilingualPrompt } from "@/types/prompt-analysis";
import { ApiError, asApiError, isAbortError, PROMPT_LIMITS, promptAnalysisClient, type PromptAnalysisClient } from "./client";

export type AnalysisPhase = AnalysisStatus | "idle" | "uploading" | "creating" | "error";
export type PromptAnalysisState = {
  file: File | null;
  previewUrl: string | null;
  asset: AnalysisAsset | null;
  analysis: AnalysisDetail | null;
  draft: BilingualPrompt;
  phase: AnalysisPhase;
  error: ApiError | null;
  saving: boolean;
  saved: boolean;
  saveError: ApiError | null;
  history: AnalysisSummary[];
  historyLoading: boolean;
  historyError: ApiError | null;
  hasMore: boolean;
};
export type PromptAnalysisOptions = { enabled?: boolean; onUnauthorized?: () => void; identity?: string | null };
type WorkflowOptions = PromptAnalysisOptions & { client?: PromptAnalysisClient };
type Ticket = { generation: number; controller: AbortController };
type SaveAttempt = { id: string; revision: number; prompt: BilingualPrompt };

const emptyPrompt = (): BilingualPrompt => ({ zh: "", en: "" });
const active = (status: AnalysisStatus) => status === "queued" || status === "running";
const equalPrompt = (left: BilingualPrompt, right: BilingualPrompt) => left.zh === right.zh && left.en === right.en;
const validPrompt = (value: BilingualPrompt) => (Object.keys(PROMPT_LIMITS) as (keyof BilingualPrompt)[])
  .every(language => value[language].trim().length > 0 && Array.from(value[language]).length <= PROMPT_LIMITS[language]);
function initialState(): PromptAnalysisState {
  return {
    file: null, previewUrl: null, asset: null, analysis: null, draft: emptyPrompt(), phase: "idle", error: null,
    saving: false, saved: false, saveError: null, history: [], historyLoading: false, historyError: null, hasMore: false,
  };
}

/** Memory belongs to this mounted launcher; no files, credentials or signed URLs enter browser storage. */
export function createPromptAnalysisWorkflow(options: WorkflowOptions = {}) {
  const client = options.client ?? promptAnalysisClient;
  let state = initialState();
  let enabled = options.enabled ?? true;
  let onUnauthorized = options.onUnauthorized;
  let identity = options.identity ?? null;
  let hadIdentity = identity !== null;
  let destroyed = false;
  let generation = 0;
  let objectUrl: string | null = null;
  let pollTimer: ReturnType<typeof setTimeout> | undefined;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let mainTicket: Ticket | null = null;
  let saveTicket: Ticket | null = null;
  let pendingCreate: { key: string; assetId: string | null } | null = null;
  let startIntent = false;
  let openIntentId: string | null = null;
  let nextCursor: string | null = null;
  let saveAttempts: SaveAttempt[] = [];
  const listeners = new Set<() => void>();
  const requests = new Set<Ticket>();
  const deleting = new Set<string>();
  const deletedIds = new Set<string>();

  function publish(change: Partial<PromptAnalysisState>) {
    if (destroyed) return;
    state = { ...state, ...change };
    listeners.forEach(listener => listener());
  }
  function ticket() {
    const value = { generation, controller: new AbortController() };
    requests.add(value);
    return value;
  }
  function current(value: Ticket) {
    return enabled && !destroyed && value.generation === generation && !value.controller.signal.aborted;
  }
  function clearPoll() { clearTimeout(pollTimer); pollTimer = undefined; }
  function clearSave() { clearTimeout(saveTimer); saveTimer = undefined; }
  function invalidate() {
    generation += 1;
    requests.forEach(value => value.controller.abort());
    requests.clear();
    deleting.clear();
    mainTicket = null;
    saveTicket = null;
    clearPoll();
    clearSave();
  }
  function releasePreview() {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }
  function resetPrivateState(preserveLocalSelection = false) {
    const file = preserveLocalSelection ? state.file : null;
    const resumeStart = preserveLocalSelection && startIntent;
    invalidate();
    if (!preserveLocalSelection) releasePreview();
    pendingCreate = null;
    saveAttempts = [];
    startIntent = resumeStart;
    openIntentId = null;
    nextCursor = null;
    deletedIds.clear();
    publish({ ...initialState(), file, previewUrl: preserveLocalSelection ? objectUrl : null });
  }
  function setIdentity(next: string | null) {
    if (destroyed || next === identity) return;
    const preserveLocalSelection = identity === null && !hadIdentity && next !== null
      && state.file !== null && state.asset === null && state.analysis === null;
    identity = next;
    hadIdentity = hadIdentity || next !== null;
    resetPrivateState(preserveLocalSelection);
  }
  function report(error: unknown, field: "error" | "saveError" | "historyError") {
    const value = asApiError(error);
    publish({ [field]: value });
    if (value.status === 401) onUnauthorized?.();
  }
  function schedulePoll() {
    clearPoll();
    if (!enabled || destroyed || !state.analysis || !active(state.analysis.status) || state.error) return;
    pollTimer = setTimeout(() => { void refresh(state.analysis!.id); }, 2000);
  }
  function scheduleSave() {
    clearSave();
    if (!enabled || destroyed || state.analysis?.status !== "succeeded" || state.saved || state.saveError || saveTicket || mainTicket) return;
    saveTimer = setTimeout(() => { void saveDraft(); }, 600);
  }
  function applyDetail(value: AnalysisDetail) {
    // A query started before a save may resolve after that save; revisions cannot move backwards.
    if (state.analysis?.id === value.id && value.revision < state.analysis.revision) return;
    const incoming = value.prompt ?? value.result?.prompt ?? emptyPrompt();
    const dirty = state.analysis?.id === value.id && state.analysis.status === "succeeded" && !state.saved;
    const matches = equalPrompt(state.draft, incoming);
    const ownSave = saveAttempts.some(attempt => attempt.id === value.id && value.revision === attempt.revision + 1 && equalPrompt(incoming, attempt.prompt));
    const conflict = dirty && !matches && state.analysis!.revision !== value.revision && !ownSave;
    const priorError = ownSave || state.saveError?.status === 401 ? null : state.saveError;
    publish({
      analysis: value, phase: value.status, error: null, previewUrl: objectUrl ?? value.preview_url,
      draft: dirty ? state.draft : { ...incoming }, saved: value.status === "succeeded" && (dirty ? matches : value.saved_to_history),
      saveError: conflict ? new ApiError(409, "REVISION_CONFLICT") : dirty && !matches ? priorError : null,
    });
    if (ownSave) saveAttempts = saveAttempts.filter(attempt => attempt.id !== value.id || attempt.revision >= value.revision);
    openIntentId = value.id;
    startIntent = false;
    schedulePoll();
    scheduleSave();
  }
  async function refresh(id: string) {
    if (!enabled || destroyed || mainTicket) return;
    clearPoll();
    const request = ticket();
    mainTicket = request;
    publish({ error: null });
    try {
      const value = await client.detail(id, request.controller.signal);
      if (current(request)) applyDetail(value);
    } catch (error) {
      if (current(request) && !isAbortError(error)) {
        const value = asApiError(error);
        if (value.status === 403 || value.status === 404) resetPrivateState();
        publish({ phase: "error" });
        report(value, "error");
      }
    } finally {
      requests.delete(request);
      if (mainTicket === request) {
        mainTicket = null;
        if (current(request)) scheduleSave();
      }
    }
  }
  function selectFile(file: File) {
    if (destroyed) return false;
    if (!validImage(file)) {
      publish({ error: new ApiError(0, "INVALID_IMAGE") });
      return false;
    }
    invalidate();
    releasePreview();
    objectUrl = URL.createObjectURL(file);
    pendingCreate = null;
    saveAttempts = [];
    startIntent = false;
    openIntentId = null;
    publish({
      file, previewUrl: objectUrl, asset: null, analysis: null, draft: emptyPrompt(), phase: "idle",
      error: null, saving: false, saved: false, saveError: null, historyLoading: false,
    });
    return true;
  }
  async function start({ newAnalysis = false }: { newAnalysis?: boolean } = {}) {
    if (!enabled || destroyed || mainTicket) return;
    if (state.analysis && (!newAnalysis || active(state.analysis.status))) {
      await refresh(state.analysis.id);
      return;
    }
    let assetId = state.asset?.id ?? state.analysis?.asset_id ?? pendingCreate?.assetId ?? null;
    if (!state.file && !assetId) {
      publish({ error: new ApiError(0, "INVALID_IMAGE") });
      return;
    }
    if (state.analysis && newAnalysis) {
      invalidate();
      pendingCreate = null;
      saveAttempts = [];
      openIntentId = null;
      publish({ analysis: null, draft: emptyPrompt(), saved: false, saveError: null, saving: false, historyLoading: false });
    }
    // Keep this key even if POST times out: the server may already have reserved quota and started work.
    pendingCreate ??= { key: crypto.randomUUID(), assetId };
    startIntent = true;
    const request = ticket();
    mainTicket = request;
    clearPoll();
    clearSave();
    publish({ error: null, saving: false });
    try {
      if (!pendingCreate.assetId) {
        publish({ phase: "uploading" });
        const uploaded = await client.upload(state.file!, request.controller.signal);
        if (!current(request)) return;
        assetId = uploaded.id;
        pendingCreate = { ...pendingCreate, assetId };
        publish({ asset: uploaded });
      }
      if (!current(request)) return;
      publish({ phase: "creating" });
      const value = await client.create(pendingCreate.assetId!, pendingCreate.key, request.controller.signal);
      if (current(request)) applyDetail(value);
    } catch (error) {
      if (current(request) && !isAbortError(error)) {
        publish({ phase: "error" });
        report(error, "error");
      }
    } finally {
      requests.delete(request);
      if (mainTicket === request) {
        mainTicket = null;
        if (current(request)) scheduleSave();
      }
    }
  }
  async function reopen(id: string) {
    if (!enabled || destroyed) return;
    invalidate();
    releasePreview();
    pendingCreate = null;
    saveAttempts = [];
    startIntent = false;
    openIntentId = id;
    publish({ file: null, previewUrl: null, asset: null, analysis: null, draft: emptyPrompt(), phase: "idle", error: null, saving: false, saved: false, saveError: null, historyLoading: false });
    await refresh(id);
  }
  async function resume() {
    if (!enabled || destroyed || mainTicket) return;
    const id = state.analysis?.id ?? openIntentId;
    if (id) await refresh(id);
    else if (startIntent) await start();
  }
  async function saveDraft() {
    clearSave();
    if (!enabled || destroyed || saveTicket || mainTicket || state.analysis?.status !== "succeeded" || state.saved) return;
    if (!validPrompt(state.draft)) {
      publish({ saveError: new ApiError(0, "INVALID_PROMPT"), saved: false });
      return;
    }
    const request = ticket();
    saveTicket = request;
    const { id, revision } = state.analysis;
    const draft = { ...state.draft };
    saveAttempts = [...saveAttempts, { id, revision, prompt: draft }];
    publish({ saving: true, saved: false, saveError: null });
    try {
      const value = await client.update(id, revision, draft, request.controller.signal);
      if (!current(request)) return;
      saveAttempts = saveAttempts.filter(attempt => attempt.id !== id || attempt.revision >= value.revision);
      if (value.revision < state.analysis!.revision) {
        publish({ saving: false });
        return;
      }
      publish({ analysis: value, saving: false, saved: equalPrompt(state.draft, draft), saveError: null });
    } catch (error) {
      if (current(request) && !isAbortError(error)) {
        publish({ saving: false, saved: false });
        report(error, "saveError");
      }
    } finally {
      requests.delete(request);
      if (saveTicket === request) {
        saveTicket = null;
        if (current(request)) scheduleSave();
      }
    }
  }
  function edit(language: keyof BilingualPrompt, value: string) {
    if (destroyed || state.analysis?.status !== "succeeded") return;
    publish({ draft: { ...state.draft, [language]: value }, saved: false, saveError: state.saveError?.code === "REVISION_CONFLICT" ? state.saveError : null });
    scheduleSave();
  }
  async function retrySave() {
    if (!enabled || destroyed || state.saveError?.code === "REVISION_CONFLICT") return;
    await saveDraft();
  }
  async function loadHistory(more = false) {
    if (!enabled || destroyed || state.historyLoading || (more && !nextCursor)) return;
    const request = ticket();
    publish({ historyLoading: true, historyError: null });
    try {
      const value = await client.history(more ? nextCursor! : undefined, request.controller.signal);
      if (!current(request)) return;
      const items = more ? [...state.history, ...value.items] : value.items;
      nextCursor = value.pagination.next_cursor;
      publish({
        history: items.filter((item, index) => !deletedIds.has(item.id) && items.findIndex(candidate => candidate.id === item.id) === index),
        historyLoading: false, hasMore: value.pagination.has_more,
      });
    } catch (error) {
      if (current(request) && !isAbortError(error)) {
        publish({ historyLoading: false });
        report(error, "historyError");
      }
    } finally {
      requests.delete(request);
    }
  }
  async function removeHistory(id: string) {
    if (!enabled || destroyed || deleting.has(id)) return;
    const request = ticket();
    deleting.add(id);
    publish({ historyError: null });
    try {
      await client.remove(id, request.controller.signal);
      if (!current(request)) return;
      deletedIds.add(id);
      publish({ history: state.history.filter(item => item.id !== id), historyError: null });
      if (state.analysis?.id === id || openIntentId === id) {
        invalidate();
        releasePreview();
        pendingCreate = null;
        saveAttempts = [];
        startIntent = false;
        openIntentId = null;
        publish({ file: null, previewUrl: null, asset: null, analysis: null, draft: emptyPrompt(), phase: "idle", error: null, saving: false, saved: false, saveError: null, historyLoading: false });
      }
    } catch (error) {
      if (current(request) && !isAbortError(error)) report(error, "historyError");
    } finally {
      requests.delete(request);
      deleting.delete(id);
    }
  }
  function setEnabled(value: boolean) {
    if (destroyed || value === enabled) return;
    enabled = value;
    if (!value) {
      invalidate();
      publish({ saving: false, historyLoading: false });
    } else {
      void resume();
      scheduleSave();
    }
  }
  function destroy() {
    if (destroyed) return;
    invalidate();
    releasePreview();
    listeners.clear();
    destroyed = true;
  }
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    setEnabled, setIdentity, setOnUnauthorized: (callback: (() => void) | undefined) => { onUnauthorized = callback; },
    selectFile, start, reopen, edit, retrySave, loadHistory, removeHistory, resume, destroy,
  };
}

export function usePromptAnalysis({ enabled = true, onUnauthorized, identity = null }: PromptAnalysisOptions = {}) {
  const [workflow] = useState(() => createPromptAnalysisWorkflow({ enabled, onUnauthorized, identity }));
  const mounted = useRef(false);
  const state = useSyncExternalStore(workflow.subscribe, workflow.getSnapshot, workflow.getSnapshot);
  useLayoutEffect(() => { workflow.setIdentity(identity); }, [identity, workflow]);
  useEffect(() => { workflow.setOnUnauthorized(onUnauthorized); }, [onUnauthorized, workflow]);
  useEffect(() => { workflow.setEnabled(enabled); }, [enabled, workflow]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      workflow.setEnabled(false);
      // StrictMode runs effect cleanup/setup once more; only a real unmount releases the retained file.
      queueMicrotask(() => { if (!mounted.current) workflow.destroy(); });
    };
  }, [workflow]);
  return {
    ...state, selectFile: workflow.selectFile, start: workflow.start, reopen: workflow.reopen, edit: workflow.edit,
    retrySave: workflow.retrySave, loadHistory: workflow.loadHistory, removeHistory: workflow.removeHistory, resume: workflow.resume, setIdentity: workflow.setIdentity,
  };
}
