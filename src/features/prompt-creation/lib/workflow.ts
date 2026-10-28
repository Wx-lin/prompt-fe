import { validImage } from "@/lib/submissions/validation";
import { ApiError, asApiError, isAbortError, PROMPT_LIMITS, promptAnalysisClient } from "@/features/image-to-prompt/lib/client";
import type { AnalysisAsset, BilingualPrompt } from "@/types/prompt-analysis";
import type { ConversationMode, ConversationTurn, CreateConversationInput, PromptConversationDetail, PromptConversationSummary } from "@/types/prompt-conversation";
import { promptConversationClient, type PromptConversationClient } from "./client";

export type CreationReference = { promptId: string; title: string; imageUrl: string };
export type ConversationEdit = { turnId: string; language: "zh" | "en"; text: string; original: string; revision: number; prompt: BilingualPrompt };
export type ConversationState = {
  expanded: boolean; view: "chat" | "history"; message: string; file: File | null;
  source: CreationReference | null; previewUrl: string | null; asset: AnalysisAsset | null;
  conversation: PromptConversationDetail | null; opening: boolean; phase: "idle" | "uploading" | "creating";
  error: ApiError | null; edit: ConversationEdit | null; saving: boolean; saveError: ApiError | null;
  history: PromptConversationSummary[]; historyLoading: boolean; historyError: ApiError | null; hasMore: boolean;
};
type Options = { client?: PromptConversationClient; analysisClient?: Pick<typeof promptAnalysisClient, "update">; identity?: string | null; onUnauthorized?: () => void };
type Ticket = { epoch: number; controller: AbortController };
type PendingSend = { key: string; input: CreateConversationInput; conversationId: string | null; parentId?: string; parentRevision?: number };
type LoginIntent = { kind: "send"; mode: ConversationMode } | { kind: "history" };
const active = (turn: ConversationTurn | undefined) => turn?.status === "queued" || turn?.status === "running";
const initial = (): ConversationState => ({ expanded: false, view: "chat", message: "", file: null, source: null, previewUrl: null, asset: null, conversation: null, opening: false, phase: "idle", error: null, edit: null, saving: false, saveError: null, history: [], historyLoading: false, historyError: null, hasMore: false });

/** Private drafts live only in this mounted provider. All continuations use a server-owned parent. */
export function createConversationWorkflow(options: Options = {}) {
  const client = options.client ?? promptConversationClient;
  const analysisClient = options.analysisClient ?? promptAnalysisClient;
  let state = initial();
  let identity = options.identity ?? null;
  let hadIdentity = identity !== null;
  let onUnauthorized = options.onUnauthorized;
  let epoch = 0;
  let enabled = true;
  let destroyed = false;
  let preview: string | null = null;
  let pendingSend: PendingSend | null = null;
  let retryKey: { id: string; key: string } | null = null;
  let loginIntent: LoginIntent | null = null;
  let cursor: string | null = null;
  let deletedIds = new Set<string>();
  let poll: ReturnType<typeof setTimeout> | undefined;
  let reading = false;
  const requests = new Set<Ticket>();
  const listeners = new Set<() => void>();
  const latest = () => state.conversation?.turns.at(-1);
  const busy = () => state.phase !== "idle" || state.saving || state.opening;
  const publish = (change: Partial<ConversationState>) => { if (!destroyed) { state = { ...state, ...change }; listeners.forEach(listener => listener()); } };
  const ticket = () => { const value = { epoch, controller: new AbortController() }; requests.add(value); return value; };
  const current = (value: Ticket) => enabled && !destroyed && value.epoch === epoch && !value.controller.signal.aborted;
  function releasePreview() { if (preview) URL.revokeObjectURL(preview); preview = null; }
  function invalidate() {
    epoch += 1;
    requests.forEach(request => request.controller.abort());
    requests.clear();
    reading = false;
    clearTimeout(poll);
    poll = undefined;
    publish({ historyLoading: false });
  }
  function reset() {
    invalidate(); releasePreview(); pendingSend = null; retryKey = null; loginIntent = null; cursor = null; deletedIds = new Set();
    publish(initial());
  }
  function setIdentity(next: string | null) {
    if (destroyed || next === identity) return;
    const preserve = identity === null && !hadIdentity && next !== null && !state.conversation && !state.asset;
    const draft = preserve ? { message: state.message, file: state.file, source: state.source, previewUrl: state.previewUrl, expanded: state.expanded } : null;
    const savedPreview = preserve ? preview : null;
    // History is a navigation intent, safe to resume for a different account; private sends are not.
    const intent = preserve || loginIntent?.kind === "history" ? loginIntent : null;
    if (preserve) preview = null;
    reset(); identity = next; hadIdentity = hadIdentity || next !== null;
    loginIntent = intent;
    if (draft) { preview = savedPreview; publish(draft); }
    else if (intent?.kind === "history") publish({ expanded: true, view: "history" });
  }
  function report(error: unknown, field: "error" | "historyError" | "saveError" = "error") {
    const value = asApiError(error);
    if (value.status === 401) {
      identity = null; hadIdentity = true; reset();
      publish({ [field]: value }); onUnauthorized?.();
    } else publish({ [field]: value });
  }
  function authorize(intent: LoginIntent) {
    if (identity !== null) return true;
    loginIntent = intent.kind === "history" || !hadIdentity ? intent : null;
    publish({ expanded: true }); onUnauthorized?.();
    return false;
  }
  function schedulePoll() {
    clearTimeout(poll);
    if (enabled && !destroyed && active(latest()) && !state.error) poll = setTimeout(() => { void refresh(); }, 2000);
  }
  function apply(value: PromptConversationDetail) {
    const previous = new Map(state.conversation?.id === value.id ? state.conversation.turns.map(turn => [turn.id, turn]) : []);
    const turns = value.turns.map(turn => { const old = previous.get(turn.id); return old && old.revision > turn.revision ? old : turn; });
    publish({ conversation: { ...value, turns }, error: null });
    schedulePoll();
  }
  function applyTurn(value: ConversationTurn) {
    const same = state.conversation?.id === value.conversation_id ? state.conversation : null;
    const turns = [...(same?.turns.filter(turn => turn.id !== value.id) ?? []), value].sort((a, b) => a.version - b.version);
    apply({ id: value.conversation_id, title: same?.title || value.title || value.user_message.slice(0, 60), created_at: same?.created_at ?? value.created_at, updated_at: value.created_at, turns });
  }
  async function refresh() {
    if (!enabled || destroyed || reading || !state.conversation) return;
    const request = ticket(); const id = state.conversation.id;
    reading = true; clearTimeout(poll);
    try {
      const value = await client.detail(id, request.controller.signal);
      if (current(request) && state.conversation?.id === id) apply(value);
    } catch (error) {
      if (current(request) && !isAbortError(error)) {
        const value = asApiError(error);
        if (value.status === 403 || value.status === 404) reset();
        report(value);
      }
    } finally { requests.delete(request); if (request.epoch === epoch) reading = false; }
  }
  function changeDraft(change: Partial<ConversationState>) {
    if (destroyed || busy()) return false;
    pendingSend = null; publish({ ...change, error: null }); return true;
  }
  function setMessage(message: string) { if (message !== state.message) changeDraft({ message }); }
  function selectFile(file: File) {
    if (destroyed || busy()) return false;
    if (!validImage(file)) { publish({ error: new ApiError(0, "INVALID_IMAGE") }); return false; }
    releasePreview(); preview = URL.createObjectURL(file);
    return changeDraft({ file, previewUrl: preview, source: null, asset: null });
  }
  function selectReference(source: CreationReference) {
    if (destroyed || busy()) return false;
    releasePreview();
    return changeDraft({ expanded: true, view: "chat", source, previewUrl: source.imageUrl, file: null, asset: null });
  }
  function clearAttachment() {
    if (destroyed || busy()) return;
    releasePreview(); changeDraft({ file: null, source: null, previewUrl: null, asset: null });
  }
  async function send(mode: ConversationMode = "auto") {
    if (!enabled || destroyed || busy() || active(latest())) return;
    const message = state.message.trim();
    if ((mode !== "auto" && mode !== "generate") || (!message && !state.file && !state.source && !state.asset) || Array.from(message).length > 500) {
      publish({ error: new ApiError(0, "INVALID_REQUEST") }); return;
    }
    if (state.edit) { publish({ error: new ApiError(0, "UNSAVED_EDIT") }); return; }
    if (latest() && latest()!.status !== "succeeded") { publish({ error: new ApiError(409, "NOT_EDITABLE") }); return; }
    publish({ expanded: true, view: "chat" });
    if (!authorize({ kind: "send", mode })) return;
    // A read begun before this mutation must not overwrite the new version when it resolves.
    invalidate();
    const request = ticket();
    const conversationId = state.conversation?.id ?? null;
    const parent = latest();
    // Freeze the request intent before uploading; uncertain retries must not change its meaning.
    pendingSend ??= { key: crypto.randomUUID(), input: { ...(message ? { message } : {}), ...(mode === "generate" ? { mode } : {}) }, conversationId, ...(parent ? { parentId: parent.id, parentRevision: parent.revision } : {}) };
    publish({ phase: "uploading", error: null });
    try {
      let asset = state.asset;
      if (!asset && state.file) asset = await client.upload(state.file, request.controller.signal);
      else if (!asset && state.source) asset = await client.importReference(state.source.promptId, request.controller.signal);
      if (!current(request)) return;
      if (asset) publish({ asset });
      if (asset) pendingSend = { ...pendingSend, input: { ...pendingSend.input, asset_id: asset.id } };
      publish({ phase: "creating" });
      const pending = pendingSend;
      const value = pending.conversationId
        ? await client.send(pending.conversationId, { ...pending.input, parent_analysis_id: pending.parentId!, parent_revision: pending.parentRevision! }, pending.key, request.controller.signal)
        : await client.create(pending.input, pending.key, request.controller.signal);
      if (!current(request)) return;
      releasePreview(); pendingSend = null; loginIntent = null;
      publish({ phase: "idle", message: "", file: null, source: null, previewUrl: null, asset: null });
      applyTurn(value);
    } catch (error) { if (current(request) && !isAbortError(error)) report(error); }
    finally { requests.delete(request); if (current(request)) publish({ phase: "idle" }); }
  }
  async function resumeIntent() {
    const intent = loginIntent; loginIntent = null;
    if (intent?.kind === "send") await send(intent.mode);
    if (intent?.kind === "history") await showHistory();
  }
  async function openConversation(id: string) {
    if (!enabled || destroyed || busy()) return;
    invalidate(); releasePreview(); pendingSend = null; retryKey = null;
    publish({ expanded: true, view: "chat", opening: true, conversation: null, edit: null, message: "", file: null, source: null, previewUrl: null, asset: null, error: null, saveError: null });
    const request = ticket(); reading = true;
    try { const value = await client.detail(id, request.controller.signal); if (current(request)) apply(value); }
    catch (error) { if (current(request) && !isAbortError(error)) report(error); }
    finally { requests.delete(request); if (request.epoch === epoch) { reading = false; publish({ opening: false }); } }
  }
  function newConversation() {
    if (destroyed || busy()) return;
    const savedHistory = { history: state.history, hasMore: state.hasMore }; const savedCursor = cursor;
    reset(); cursor = savedCursor; publish({ ...savedHistory, expanded: true });
  }
  async function retryTurn(id: string) {
    if (!enabled || destroyed || busy() || state.edit || !state.conversation || latest()?.id !== id || !["failed", "canceled"].includes(latest()!.status)) return;
    invalidate();
    const request = ticket();
    retryKey = retryKey?.id === id ? retryKey : { id, key: crypto.randomUUID() };
    publish({ phase: "creating", error: null });
    try {
      const value = await client.retry(state.conversation.id, id, retryKey.key, request.controller.signal);
      if (current(request)) { retryKey = null; applyTurn(value); }
    } catch (error) { if (current(request) && !isAbortError(error)) report(error); }
    finally { requests.delete(request); if (current(request)) publish({ phase: "idle" }); }
  }
  function beginEdit(turnId: string, language: "zh" | "en") {
    const turn = state.conversation?.turns.find(turn => turn.id === turnId);
    if (destroyed || busy() || active(latest()) || turn?.status !== "succeeded" || !turn.prompt) return;
    publish({ edit: { turnId, language, text: turn.prompt[language], original: turn.prompt[language], revision: turn.revision, prompt: { ...turn.prompt } }, saveError: null });
  }
  function setEditText(text: string) { if (state.edit && !state.saving) publish({ edit: { ...state.edit, text }, saveError: state.saveError?.code === "REVISION_CONFLICT" ? state.saveError : null }); }
  function cancelEdit() { if (!state.saving) publish({ edit: null, saveError: null }); }
  const hasUnsavedEdit = () => Boolean(state.edit && state.edit.text !== state.edit.original);
  async function saveEdit() {
    const edit = state.edit;
    if (!enabled || destroyed || !edit || busy()) return;
    if (!edit.text.trim() || Array.from(edit.text).length > PROMPT_LIMITS[edit.language]) { publish({ saveError: new ApiError(0, "INVALID_PROMPT") }); return; }
    invalidate();
    const request = ticket(); publish({ saving: true, saveError: null });
    try {
      const value = await analysisClient.update(edit.turnId, edit.revision, { ...edit.prompt, [edit.language]: edit.text }, request.controller.signal);
      if (!current(request)) return;
      const old = state.conversation?.turns.find(turn => turn.id === edit.turnId);
      if (old && value.revision >= old.revision) applyTurn({ ...old, ...value });
      publish({ edit: null, saving: false });
    } catch (error) { if (current(request) && !isAbortError(error)) report(error, "saveError"); }
    finally { requests.delete(request); if (current(request)) publish({ saving: false }); }
  }
  async function loadHistory(more = false) {
    if (!enabled || destroyed || state.historyLoading || (more && !cursor)) return;
    if (!authorize({ kind: "history" })) return;
    const request = ticket(); publish({ historyLoading: true, historyError: null });
    try {
      const value = await client.history(more ? cursor! : undefined, request.controller.signal);
      if (!current(request)) return;
      const values = more ? [...state.history, ...value.items] : value.items;
      cursor = value.pagination.next_cursor;
      publish({ history: values.filter((item, index) => !deletedIds.has(item.id) && values.findIndex(other => other.id === item.id) === index), hasMore: value.pagination.has_more });
    } catch (error) { if (current(request) && !isAbortError(error)) report(error, "historyError"); }
    finally { requests.delete(request); if (current(request)) publish({ historyLoading: false }); }
  }
  async function showHistory() { publish({ expanded: true, view: "history" }); await loadHistory(); }
  async function removeConversation(id: string) {
    if (!enabled || destroyed || busy()) return;
    const request = ticket();
    try {
      await client.remove(id, request.controller.signal);
      if (!current(request)) return;
      const history = state.history.filter(item => item.id !== id);
      if (state.conversation?.id === id) { newConversation(); publish({ history, view: "history" }); }
      else publish({ history });
      deletedIds = new Set([...deletedIds, id]);
    } catch (error) { if (current(request) && !isAbortError(error)) report(error, "historyError"); }
    finally { requests.delete(request); }
  }
  function setEnabled(value: boolean) {
    if (destroyed || enabled === value) return;
    enabled = value;
    if (!value) { invalidate(); publish({ phase: "idle", opening: false, saving: false, historyLoading: false }); }
    else schedulePoll();
  }
  function destroy() { if (!destroyed) { invalidate(); releasePreview(); listeners.clear(); destroyed = true; } }
  return { getSnapshot: () => state, subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; }, setIdentity, setEnabled, setOnUnauthorized: (callback: (() => void) | undefined) => { onUnauthorized = callback; }, setMessage, selectFile, selectReference, clearAttachment, send, refresh, resumeIntent, cancelLogin: () => { loginIntent = null; }, setExpanded: (expanded: boolean) => publish({ expanded }), showHistory, showChat: () => publish({ view: "chat" }), newConversation, openConversation, retryTurn, beginEdit, setEditText, saveEdit, cancelEdit, hasUnsavedEdit, loadHistory, removeConversation, destroy };
}

export type ConversationWorkflow = ReturnType<typeof createConversationWorkflow>;
