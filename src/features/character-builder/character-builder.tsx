"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Copy, Download, Search, Upload } from "lucide-react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Dialog } from "@base-ui/react/dialog";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { SiteHeader } from "@/features/gallery/components/site-header";
import type { CurrentUser } from "@/types/prompt";
import { GROUPS, MODELS, TEMPLATES, createInitialValues, type CharacterValues, type TemplateId } from "./character-data";
import { buildOutputs, translateValue } from "./prompt-builder";
import { applyCharacterInterpretation } from "./character-ai";
import { FieldGroup } from "./character-fields";
import { CharacterSelect } from "./character-select";
import { CharacterWorkbench, type CharacterPreviewResult } from "./character-workbench";
import { getOfficialCharacter } from "@/features/character-library/official-characters";
import { characterDraftKey, consumeCharacterFreshStart, consumeCharacterLoginResume, markCharacterLoginResume } from "./character-draft-scope";
import { readDraftImage, storeDraftImage } from "./character-draft-images";
import { officialImagePng } from "./character-official-image";
import { findOutfit } from "./character-outfits";
import { BUILT_IN_PRESETS, DRAFT_KEY, MAX_IMPORT_BYTES, PRESET_KEY, parseFile, parsePreset, readPresets, readPresetsStrict, type CharacterPreset } from "./character-presets";
import styles from "./character-builder.module.css";
import feedback from "./character-feedback.module.css";

type UndoState = { kind: "replace"; values: CharacterValues; template: TemplateId; model: string; touched: readonly string[] } | { kind: "outfit"; values: Readonly<Record<string, string>>; touched: readonly string[] };

type OutputKey = "zh" | "en" | "bilingual" | "negative" | "json" | "parameters";
const outputTypes: ReadonlyArray<{ id: OutputKey; zh: string; en: string }> = [
  { id: "zh", zh: "中文", en: "Chinese" }, { id: "en", zh: "英文", en: "English" },
  { id: "bilingual", zh: "中英双语", en: "Bilingual" },
  { id: "negative", zh: "负面词", en: "Negative" }, { id: "json", zh: "JSON", en: "JSON" },
  { id: "parameters", zh: "模型参数", en: "Parameters" },
];

export function CharacterBuilder({ locale = "zh", user = null }: { locale?: string; user?: CurrentUser | null }) {
  const en = locale === "en";
  const tr = (zh: string, english: string) => en ? english : zh;
  const router = useRouter();
  const [values, setValues] = useState<CharacterValues>(createInitialValues);
  const [template, setTemplate] = useState<TemplateId>(TEMPLATES[0].id);
  const [model, setModel] = useState<string>(MODELS[0]);
  const [output, setOutput] = useState<OutputKey>("zh");
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [presets, setPresets] = useState<CharacterPreset[]>([]);
  const [selected, setSelected] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaveHref, setLeaveHref] = useState("/");
  const [undoStates, setUndoStates] = useState<UndoState[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [copyFeedback, setCopyFeedback] = useState<{ target: "preview" | "mobile" | "workbench"; success: boolean; content: string } | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<ReadonlySet<string>>(() => new Set([GROUPS[0].id]));
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify([createInitialValues(), TEMPLATES[0].id, MODELS[0]]));
  const savedPreset = useRef<{ name: string; snapshot: string } | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [entryMode, setEntryMode] = useState<"default" | "new" | "edit">("default");
  const [workbenchEntry, setWorkbenchEntry] = useState<"default" | "new" | "edit">("default");
  const [draftKey, setDraftKey] = useState(DRAFT_KEY);
  const [assetId, setAssetId] = useState<string | null>(null);
  const [assetBusy, setAssetBusy] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [assetReady, setAssetReady] = useState(true);
  const [assetLoadError, setAssetLoadError] = useState(false);
  const [assetLoginNeeded, setAssetLoginNeeded] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [exampleImage, setExampleImage] = useState<string | null | undefined>();
  const [exampleValues, setExampleValues] = useState<CharacterValues | null>(null);
  const [imageResult, setImageResult] = useState<CharacterPreviewResult | null>(null);
  const [savedImageSrc, setSavedImageSrc] = useState<string | null>(null);
  const [imageVersion, setImageVersion] = useState(0);
  const pendingImageWrite = useRef<Promise<boolean> | null>(null);
  const latestImage = useRef<CharacterPreviewResult | null>(null);
  const draftScope = useRef(DRAFT_KEY);
  const navigatingToLogin = useRef(false);
  const touchedFields = useRef<Set<string>>(new Set());
  const importRef = useRef<HTMLInputElement>(null);
  const data = useMemo(() => buildOutputs(values, template, model), [values, template, model]);
  const content = output === "bilingual" ? `${data.zh}\n\n${data.en}` : data[output];
  const dirty = JSON.stringify([values, template, model]) !== savedSnapshot || (imageResult?.src ?? null) !== savedImageSrc;
  const visibleGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return GROUPS.map((group) => ({ ...group, filteredFields: group.fields }));
    return GROUPS.map((group) => ({ ...group, filteredFields: group.label.toLowerCase().includes(query) || group.enLabel.toLowerCase().includes(query) ? group.fields : group.fields.filter((field) => field.label.toLowerCase().includes(query) || field.enLabel.toLowerCase().includes(query) || field.options?.some((option) => option.toLowerCase().includes(query) || translateValue(option).toLowerCase().includes(query))) })).filter((group) => group.filteredFields.length > 0);
  }, [search]);
  // Browser storage is intentionally read only after hydration to avoid server/client markup mismatches.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restore client-only storage after hydration
    setPresets(readPresets());
    try {
      const params = new URLSearchParams(window.location.search);
      const presetId = params.get("preset"), requestedAssetId = params.get("asset"), createNew = params.get("new") === "1";
      setEntryMode(presetId || requestedAssetId ? "edit" : createNew ? "new" : "default");
      setWorkbenchEntry(presetId || requestedAssetId ? "edit" : createNew ? "new" : "default");
      const scopedKey = characterDraftKey(window.location.search);
      draftScope.current = scopedKey; setDraftKey(scopedKey);
      consumeCharacterLoginResume(scopedKey);
      const fresh = consumeCharacterFreshStart(scopedKey) && createNew;
      if (fresh) { sessionStorage.removeItem(scopedKey); sessionStorage.removeItem(`${scopedKey}:touched`); sessionStorage.removeItem(`character-ai:${window.location.search}`); pendingImageWrite.current = storeDraftImage(scopedKey, null); }
      const raw = fresh ? null : sessionStorage.getItem(scopedKey);
      const draft = raw ? parseFile(raw) : null;
      if (draft) {
        const savedTouched: unknown = JSON.parse(sessionStorage.getItem(`${scopedKey}:touched`) ?? "null");
        const defaults = createInitialValues();
        touchedFields.current = new Set(Array.isArray(savedTouched) && savedTouched.every((key) => typeof key === "string") ? savedTouched : Object.keys(draft.values).filter((key) => draft.values[key] !== defaults[key]));
      }
      const official = presetId ? getOfficialCharacter(presetId) : undefined;
      if (official) { setExampleImage(official.image); setExampleValues(official.values); }
      if (requestedAssetId) {
        setAssetId(requestedAssetId); setAssetReady(false);
        void (async () => {
          try {
            const response = await fetch(`/api/character-assets/${encodeURIComponent(requestedAssetId)}`);
            if (response.status === 401) { setAssetLoginNeeded(true); setLoginOpen(true); throw new Error("请登录后打开个人角色。"); }
            if (!response.ok) throw new Error("角色加载失败，请返回角色库重试。");
            const body = await response.json(); const asset = body.data;
            const parsed = parsePreset({ name: asset?.name, values: asset?.values, template: asset?.template ?? "basic", model: asset?.model ?? "通用" });
            if (!parsed) throw new Error("角色数据格式无效，未覆盖当前配置。");
            setExampleImage(null);
            const initial = draft ?? parsed;
            setValues(initial.values); setTemplate(initial.template); setModel(initial.model);
            setOutput(initial.values.outputLanguage === "英文" ? "en" : initial.values.outputLanguage === "中英双语" ? "bilingual" : "zh");
            setSavedSnapshot(JSON.stringify([parsed.values, parsed.template, parsed.model]));
            const savedImage = asset.preview_image_base64 && asset.preview_signature ? { src: `data:image/png;base64,${asset.preview_image_base64}`, signature: asset.preview_signature } : null;
            setSavedImageSrc(savedImage?.src ?? null);
            const preview = (draft ? await readDraftImage(scopedKey) : null) ?? savedImage;
            if (preview) { latestImage.current = preview; setImageResult(preview); setImageVersion((v) => v + 1); }
          } catch (err) { setAssetLoadError(true); setError(err instanceof Error ? err.message : "角色加载失败，请重试。"); }
          finally { setAssetReady(true); }
        })();
      } else if (draft || official) {
        const initial = draft ?? official!; setValues(initial.values); setTemplate(initial.template); setModel(initial.model); setOutput(initial.values.outputLanguage === "英文" ? "en" : initial.values.outputLanguage === "中英双语" ? "bilingual" : "zh");
        if (official) setSavedSnapshot(JSON.stringify([official.values, official.template, official.model]));
        if (draft) {
          setMessage(locale === "en" ? "Restored the draft from this tab." : "已恢复本标签页的角色草稿。"); setAssetReady(false);
          void readDraftImage(scopedKey).then((preview) => { if (preview) { latestImage.current = preview; setImageResult(preview); setImageVersion((v) => v + 1); } }).finally(() => setAssetReady(true));
        }
      }
    } catch { setError(locale === "en" ? "Tab storage is unavailable; save a preset or export your work." : "标签页草稿不可用，请保存预设或导出配置。"); }
    setDraftReady(true);
    const sync = (event: StorageEvent) => {
      if (event.key !== PRESET_KEY && event.key !== null) return;
      const current = readPresets();
      setPresets(current);
      const saved = savedPreset.current;
      if (saved && !current.some((item) => item.name === saved.name && JSON.stringify([item.values, item.template, item.model]) === saved.snapshot)) {
        savedPreset.current = null;
        setSavedSnapshot("");
        setError(locale === "en" ? "The saved preset changed in another tab. Save this configuration again." : "已保存的预设在其他标签页发生变化，请重新保存当前配置。");
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [locale]);
  useEffect(() => {
    if (!draftReady) return;
    try {
      if (!assetReady || assetLoadError) return;
      const preset = parsePreset({ name: "草稿", values, template, model });
      if (preset) sessionStorage.setItem(draftKey, JSON.stringify({ version: 1, preset }));
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- report a browser storage failure to the user
      setError(locale === "en" ? "Tab storage is unavailable; save a preset or export your work." : "标签页草稿不可用，请保存预设或导出配置。");
    }
  }, [draftReady, assetReady, assetLoadError, draftKey, values, template, model, locale]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { if (navigatingToLogin.current) return; event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function notify(text: string) { setError(""); setMessage(text); }
  function fail(text: string) { setMessage(""); setError(text); }
  function setTouched(next: Set<string>) {
    touchedFields.current = next;
    try { sessionStorage.setItem(`${draftScope.current}:touched`, JSON.stringify([...next])); } catch { /* Other draft saving reports storage errors. */ }
  }
  function queueDraftImage(scope: string, image: CharacterPreviewResult) {
    const previous = pendingImageWrite.current;
    const pending = (previous ? previous.catch(() => false) : Promise.resolve(true)).then(() => storeDraftImage(scope, image));
    pendingImageWrite.current = pending;
    void pending.then((ok) => { if (!ok && pendingImageWrite.current === pending) setError(tr("图片暂时无法保存在本机草稿中，请尽快保存到角色库或下载。", "The image could not be stored in this tab’s draft. Save it to your library or download it.")); });
  }
  async function prepareLogin() {
    if (!assetLoadError) {
      const draft = parsePreset({ name: "草稿", values, template, model });
      if (!draft) { fail(tr("当前配置无法保存在草稿中，请检查后再登录。", "The current settings could not be saved in a draft. Please review them before signing in.")); return false; }
      try { sessionStorage.setItem(draftKey, JSON.stringify({ version: 1, preset: draft })); }
      catch {
        fail(tr("当前配置无法保存到标签页草稿，登录后可能丢失。", "The current settings could not be saved in this tab and may be lost."));
        if (!window.confirm(tr("当前配置无法保存在本机，登录后可能丢失。仍要继续吗？", "Your settings could not be saved locally and may be lost. Continue anyway?"))) return false;
      }
    }
    if (pendingImageWrite.current && (imageResult?.src ?? null) !== savedImageSrc && !(await pendingImageWrite.current)) {
      fail(tr("图片未能保存在本机草稿中。为避免登录后丢失，请先下载图片再继续。", "The image could not be saved in this tab’s draft. Download it before signing in."));
      const proceed = window.confirm(tr("图片未能保存在本机，继续登录后可能丢失。请先下载图片。仍要继续吗？", "The image could not be stored locally and may be lost. Download it first. Continue anyway?"));
      if (!proceed) return false;
    }
    navigatingToLogin.current = true;
    return true;
  }
  function store(next: CharacterPreset[]) {
    try { localStorage.setItem(PRESET_KEY, JSON.stringify(next)); setPresets(next); return true; }
    catch { fail(tr("无法保存到本机，请检查浏览器存储设置。", "Unable to save on this device. Check browser storage settings.")); return false; }
  }
  function save() {
    const clean = name.trim();
    if (!clean || clean.length > 80) { fail(tr("请输入不超过 80 个字符的预设名称。", "Enter a preset name of up to 80 characters.")); return; }
    let current: CharacterPreset[];
    try { current = readPresetsStrict(); } catch { fail(tr("无法读取本机预设，未覆盖已有数据。", "Could not read saved presets; existing data was not overwritten.")); return; }
    if (current.some((preset) => preset.name === clean)) { setPresets(current); fail(tr("预设名称已存在，请使用其他名称。", "That preset name already exists.")); return; }
    const preset = parsePreset({ name: clean, values, template, model });
    if (!preset) { fail(tr("当前配置包含无效或过长的内容，请检查后重试。", "Some values are invalid or too long. Please review them.")); return; }
    if (store([...current, preset])) {
      const snapshot = JSON.stringify([values, template, model]);
      savedPreset.current = { name: clean, snapshot };
      setSelected(`local:${clean}`); setName(""); setSavedSnapshot(snapshot); notify(tr("预设已保存到本机浏览器，不会自动同步。", "Saved in this browser on this device; it is not synced."));
    }
  }
  function apply() {
    const preset = selected.startsWith("builtin:") ? BUILT_IN_PRESETS.find((item) => `builtin:${item.name}` === selected) : presets.find((item) => `local:${item.name}` === selected);
    if (!preset) return;
    replaceValues(preset.values, preset.template, preset.model);
    notify(tr("预设已应用，可以撤销。", "Preset applied; you can undo this."));
  }
  function replaceValues(next: CharacterValues, nextTemplate: TemplateId, nextModel: string) {
    setUndoStates((previous) => [...previous, { kind: "replace", values: { ...values }, template, model, touched: [...touchedFields.current] }]);
    setTouched(new Set(Object.keys(next)));
    setValues({ ...next }); setTemplate(nextTemplate); setModel(nextModel);
    setOutput(next.outputLanguage === "英文" ? "en" : next.outputLanguage === "中英双语" ? "bilingual" : "zh");
  }
  function undo() {
    const undoState = undoStates.at(-1);
    if (!undoState) return;
    setTouched(new Set(undoState.touched));
    if (undoState.kind === "outfit") {
      setValues((previous) => ({ ...previous, ...undoState.values }));
    } else {
      setValues({ ...undoState.values }); setTemplate(undoState.template); setModel(undoState.model);
      setOutput(undoState.values.outputLanguage === "英文" ? "en" : undoState.values.outputLanguage === "中英双语" ? "bilingual" : "zh");
    }
    setUndoStates((previous) => previous.slice(0, -1)); notify(tr("已撤销上一次替换。", "Previous configuration restored."));
  }
  function remove() {
    let current: CharacterPreset[];
    try { current = readPresetsStrict(); } catch { fail(tr("无法读取本机预设，未覆盖已有数据。", "Could not read saved presets; existing data was not overwritten.")); return; }
    const removed = current.find((item) => `local:${item.name}` === selected);
    if (!removed) { setPresets(current); setSelected(""); setConfirmDelete(false); fail(tr("该预设已被其他标签页删除。", "This preset was already deleted in another tab.")); return; }
    const remaining = current.filter((item) => `local:${item.name}` !== selected);
    if (store(remaining)) {
      const removedSnapshot = JSON.stringify([removed.values, removed.template, removed.model]);
      if (removedSnapshot === savedSnapshot && !remaining.some((item) => JSON.stringify([item.values, item.template, item.model]) === removedSnapshot)) { savedPreset.current = null; setSavedSnapshot(""); }
      setSelected(""); setConfirmDelete(false); notify(tr("预设已从本机删除。", "Preset removed from this device."));
    }
  }
  async function copy(target: "preview" | "mobile" | "workbench") {
    try { await navigator.clipboard.writeText(content); setCopyFeedback({ target, success: true, content }); }
    catch { setCopyFeedback({ target, success: false, content }); }
  }
  async function saveAsset() {
    if (!user) { setLoginOpen(true); return; }
    if (assetBusy || !assetReady || assetLoadError) return;
    const valid = parsePreset({ name: values.name?.trim() || tr("未命名角色", "Untitled character"), values, template, model });
    if (!valid) { fail(tr("当前角色设定无效，请检查后重试。", "Some character settings are invalid.")); return; }
    setAssetBusy(true);
    try {
      let preview = imageResult;
      if (!preview && exampleImage && exampleValues) {
        let src: string;
        try { src = await officialImagePng(exampleImage); }
        catch { throw new Error(tr("无法读取官方角色图，未保存角色，请稍后重试。", "Could not read the official character image. Please try saving again.")); }
        const expressions = (exampleValues.expressions ?? "").split(/[，,]/).map((value) => value.trim()).filter((value) => value && value !== "不指定" && value !== "无");
        const expression = expressions.includes(exampleValues.baseExpression) ? exampleValues.baseExpression : expressions[0] ?? "";
        preview = { src, signature: JSON.stringify([exampleValues, findOutfit(exampleValues)?.id ?? null, exampleValues.outfitNotes ?? "", expression]) };
      }
      const response = await fetch(assetId ? `/api/character-assets/${encodeURIComponent(assetId)}` : "/api/character-assets", {
        method: assetId ? "PUT" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: valid.name, values, template, model, preview_image_base64: preview?.src.startsWith("data:image/png;base64,") ? preview.src.slice("data:image/png;base64,".length) : null, preview_signature: preview?.signature ?? null }),
      });
      if (response.status === 401) { setLoginOpen(true); return; }
      if (!response.ok) {
        const failure = await response.json().catch(() => null);
        const code = typeof failure?.error?.code === "string" ? failure.error.code : "";
        const message = code === "ASSET_LIMIT_REACHED" ? tr("角色数量已达上限，请先删除不需要的角色。", "Character limit reached. Delete an unused character first.") : code === "ASSET_STORAGE_LIMIT" ? tr("角色图片空间已满，请先删除不需要的角色。", "Character image storage is full. Delete an unused character first.") : response.status === 422 || response.status === 413 ? tr("角色或图片格式不符合要求，图片不能超过 15 MiB。", "Invalid character or image; images must be under 15 MiB.") : tr("保存失败，请稍后重试。", "Could not save. Please try again.");
        throw new Error(message);
      }
      const body = await response.json();
      if (!body?.data?.id) throw new Error(tr("保存结果异常，请刷新角色库查看。", "Unexpected save response; check your library."));
      const savedId = String(body.data.id);
      setAssetId(savedId); setSavedSnapshot(JSON.stringify([values, template, model])); setSavedImageSrc(imageResult?.src ?? null);
      if (!assetId) {
        const previousSearch = window.location.search;
        const url = new URL(window.location.href);
        url.search = ""; url.searchParams.set("asset", savedId);
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
        const nextScope = characterDraftKey(url.search);
        try {
          const input = sessionStorage.getItem(`character-ai:${previousSearch}`);
          if (input !== null) sessionStorage.setItem(`character-ai:${url.search}`, input);
          sessionStorage.setItem(`${nextScope}:touched`, JSON.stringify([...touchedFields.current]));
        } catch { /* The existing save result remains valid if tab storage is unavailable. */ }
        draftScope.current = nextScope; setDraftKey(nextScope); setEntryMode("edit");
        if (latestImage.current && latestImage.current.src !== imageResult?.src) queueDraftImage(nextScope, latestImage.current);
      }
      notify(tr("已保存到我的角色库。", "Saved to your character library."));
    } catch (err) { fail(err instanceof Error ? err.message : tr("保存失败，请稍后重试。", "Could not save. Please try again.")); }
    finally { setAssetBusy(false); }
  }
  function exportFile() {
    const preset = parsePreset({ name: name.trim() || tr("角色设定", "Character setup"), values, template, model });
    if (!preset) { fail(tr("当前配置包含无效或过长的内容，请检查后重试。", "Some values are invalid or too long. Please review them.")); return; }
    const blob = new Blob([JSON.stringify({ version: 1, preset }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "character-setup.json"; anchor.click(); URL.revokeObjectURL(url);
    notify(tr("配置已导出，请妥善保管文件。", "Configuration exported. Keep the file safe."));
  }
  async function importFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) { fail(tr("文件超过 256 KB，请选择较小的配置文件。", "File exceeds 256 KB.")); return; }
    try {
      const preset = parseFile(await file.text());
      if (!preset) { fail(tr("文件格式无效，请选择本工具导出的配置文件。", "Invalid file. Choose a configuration exported by this tool.")); return; }
      replaceValues(preset.values, preset.template, preset.model);
      notify(tr("配置已导入，尚未保存到本机预设。", "Configuration imported, but not saved as a local preset."));
    } catch { fail(tr("读取文件失败，请重试。", "Could not read the file. Try again.")); }
  }
  function reset() { replaceValues(createInitialValues(), TEMPLATES[0].id, MODELS[0]); notify(tr("已恢复默认配置，可以撤销。", "Default configuration restored; you can undo this.")); }
  function changeField(id: string, value: string) {
    setTouched(new Set([...touchedFields.current, id]));
    setValues((previous) => ({ ...previous, [id]: value }));
    if (id === "outputLanguage") setOutput(value === "英文" ? "en" : value === "中英双语" ? "bilingual" : "zh");
  }
  function applyAi(input: unknown, clearDefaults: boolean): CharacterValues {
    const next = applyCharacterInterpretation(values, input, { clearDefaults, touched: touchedFields.current });
    setUndoStates((previous) => [...previous, { kind: "replace", values: { ...values }, template, model, touched: [...touchedFields.current] }]);
    setTouched(new Set(Object.keys(next)));
    setValues(next);
    notify(tr("角色配置已更新，可以撤销。", "Character settings updated; you can undo this."));
    return next;
  }
  function guardLeave(event: React.MouseEvent) {
    const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (dirty && target instanceof HTMLAnchorElement && target.origin === window.location.origin) {
      event.preventDefault(); event.stopPropagation(); setLeaveHref(`${target.pathname}${target.search}${target.hash}`); setConfirmLeave(true);
    }
  }
  return <div className={styles.shell}>
    <div onClickCapture={guardLeave}><SiteHeader user={user} showNavigationRow={false} categories={[]} models={[]} activeCategory="all" activeModel="all" activeSort="recommended" /></div>
    <main className={styles.main}>
      <Link href={entryMode === "default" ? "/" : "/character-library"} className={styles.back} onClick={guardLeave}><ArrowLeft size={16} />{entryMode === "default" ? tr("返回首页", "Back to home") : tr("返回角色库", "Back to character library")}</Link>
      <div className={styles.title}><div><h1>{entryMode === "edit" ? tr("编辑角色", "Edit character") : entryMode === "new" ? tr("创建角色", "Create character") : tr("角色设定", "Character setup")}</h1><p>{tr("调整角色设定，生成提示词和角色预览。", "Build character prompts and generate a preview.")}</p></div><div className={styles.fileActions}><a href="#character-templates" onClick={() => setAdvancedOpen(true)} className={styles.templateJump}>{tr("提示词与模板", "Prompts and templates")}</a><input type="file" ref={importRef} accept="application/json,.json" aria-label={tr("导入配置文件", "Import configuration file")} hidden onChange={(event) => { void importFile(event.target.files?.[0]); event.currentTarget.value = ""; }} /><button type="button" onClick={() => importRef.current?.click()}><Upload size={16} />{tr("导入", "Import")}</button><button type="button" onClick={exportFile}><Download size={16} />{tr("导出", "Export")}</button><button type="button" onClick={reset}>{tr("重置", "Reset")}</button><button type="button" className={styles.saveAsset} onClick={() => void saveAsset()} disabled={assetBusy || !assetReady || assetLoadError}>{assetBusy ? tr("保存中…", "Saving…") : tr("保存到我的角色库", "Save to my library")}</button></div></div>
      {(message || error || undoStates.length > 0) && <div id="character-change-notice" className={`${error ? styles.error : styles.message} ${feedback.notice}`} role={error ? "alert" : "status"}><span>{error || message || tr("可以撤销之前的替换。", "You can undo a previous replacement.")}</span>{assetLoginNeeded && <button type="button" onClick={() => setLoginOpen(true)}>{tr("登录后打开角色", "Sign in to open your character")}</button>}{undoStates.length > 0 && <button type="button" onClick={undo}>{tr("撤销替换", "Undo replacement")}</button>}</div>}
      {assetReady && !assetLoadError ? <CharacterWorkbench key={`${workbenchEntry}:${imageVersion}`} initialCategory={workbenchEntry === "new" ? "basic" : workbenchEntry === "edit" ? "face" : "clothing"} values={values} en={en} authenticated={Boolean(user)} newCharacter={entryMode !== "edit"} initialPreview={imageResult} exampleImage={exampleImage} exampleValues={exampleValues} onBeforeLogin={prepareLogin} onApplyAi={applyAi} onPreviewChange={(preview) => { latestImage.current = preview; setImageResult(preview); queueDraftImage(draftScope.current, preview); }} onAdvanced={() => setAdvancedOpen(true)} onCopyPrompt={() => void copy("workbench")} copyResult={copyFeedback?.target === "workbench" && copyFeedback.content === content ? copyFeedback.success : null} onChange={changeField} canUndo={undoStates.length > 0} onApplyOutfit={(changes) => { const previousTouched = [...touchedFields.current]; setTouched(new Set([...previousTouched, ...Object.keys(changes)])); const previousOutfit = Object.fromEntries(Object.keys(changes).map((key) => [key, values[key] ?? ""])); setUndoStates((previous) => [...previous, { kind: "outfit", values: previousOutfit, touched: previousTouched }]); setValues((previous) => ({ ...previous, ...changes })); notify(tr("已替换服装配置，可以撤销。", "Outfit settings replaced; you can undo this.")); }} /> : !assetReady ? <p role="status">{tr("正在加载角色…", "Loading character…")}</p> : null}
      <details id="advanced-character-options" className={styles.advancedDetails} open={advancedOpen} onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}><summary>{tr("高级设置与提示词预览", "Advanced settings and prompt preview")}</summary>
      <details className={styles.presets}><summary>{tr("预设管理", "Preset management")}<span>{tr("内置与本机预设", "Built-in and local presets")}</span></summary>
        <div className={styles.presetControls}><div className={styles.selectControl}><span>{tr("选择预设", "Select preset")}</span><CharacterSelect label={tr("选择预设", "Select preset")} value={selected} onChange={setSelected} options={[{ value: "", label: tr("选择预设", "Select preset") }, ...BUILT_IN_PRESETS.map((preset) => ({ value: `builtin:${preset.name}`, label: preset.name, group: tr("内置预设", "Built-in presets") })), ...presets.map((preset) => ({ value: `local:${preset.name}`, label: preset.name, group: tr("本机预设", "Local presets") }))]} /></div><button type="button" disabled={!selected} onClick={apply}>{tr("应用预设", "Apply preset")}</button><button type="button" disabled={!selected || selected.startsWith("builtin:")} onClick={() => setConfirmDelete(true)}>{tr("删除预设", "Delete preset")}</button><label><span>{tr("预设名称", "Preset name")}</span><input aria-label={tr("预设名称", "Preset name")} value={name} maxLength={80} placeholder={tr("给当前配置命名", "Name this setup")} onChange={(event) => setName(event.target.value)} /></label><button type="button" onClick={save}>{tr("保存预设", "Save preset")}</button></div>
        <p>{tr("预设仅存于当前浏览器，可导出备份。文字草稿随标签页关闭清除；生成图临时缓存在本机，七天后在后续缓存操作时清理。", "Presets are saved in this browser and can be exported. Text drafts clear when the tab closes; generated images are temporarily cached locally and cleaned up after seven days during later cache operations.")}</p>
      </details>
      <nav id="character-templates" className={styles.templateNav} aria-label={tr("选择模板", "Choose template")}>{TEMPLATES.map((item) => <button key={item.id} type="button" aria-pressed={item.id === template} className={item.id === template ? styles.templateActive : ""} onClick={() => setTemplate(item.id)}>{en ? item.enLabel : item.label}</button>)}</nav>
      <div className={styles.workspace}>
        <section id="character-settings" className={styles.settings} aria-label={tr("角色设置", "Character settings")}><div className={styles.sectionHeading}><div><h2>{tr("角色配置", "Character settings")}</h2><p>{tr("按需填写；输入或调整后预览会实时更新。", "Fill in what you need; the preview updates as you edit.")}</p></div><label className={styles.search}><Search size={16} /><span className={styles.srOnly}>{tr("搜索配置项", "Search settings")}</span><input value={search} placeholder={tr("搜索配置项", "Search settings")} onChange={(event) => setSearch(event.target.value)} /></label></div><div className={styles.groups}>{visibleGroups.length ? visibleGroups.map((group) => <FieldGroup key={group.id} title={en ? group.enLabel : group.label} fields={group.filteredFields} values={values} en={en} initialOpen={false} open={Boolean(search.trim()) || expandedGroups.has(group.id)} onToggle={(isOpen) => { if (!search.trim()) setExpandedGroups((previous) => { const next = new Set(previous); if (isOpen) next.add(group.id); else next.delete(group.id); return next; }); }} onChange={changeField} />) : <p className={styles.empty}>{tr("没有找到相关配置项。", "No matching settings.")}</p>}</div></section>
        <section id="character-preview" className={styles.preview} aria-label={tr("提示词预览", "Prompt preview")}><div className={styles.previewHeading}><div><h2>{tr("提示词预览", "Prompt preview")}</h2><p>{tr("实时生成 · 复制到你常用的 AI 工具中使用", "Updates live · Copy to your preferred AI tool")}</p></div><div className={styles.selectControl}><span>{tr("目标模型", "Target model")}</span><CharacterSelect label={tr("目标模型", "Target model")} value={model} onChange={setModel} options={MODELS.map((item) => ({ value: item, label: item }))} /></div></div><div className={styles.outputTabs} aria-label={tr("输出类型", "Output type")}>{outputTypes.map((item) => <button key={item.id} type="button" aria-pressed={output === item.id} className={output === item.id ? styles.outputActive : ""} onClick={() => { setOutput(item.id); const language = item.id === "zh" ? "中文" : item.id === "en" ? "英文" : item.id === "bilingual" ? "中英双语" : null; if (language) setValues((previous) => ({ ...previous, outputLanguage: language })); }}>{en ? item.en : item.zh}</button>)}</div><div className={styles.meta}><span>{tr("角色 ID", "Character ID")}：{data.characterId}</span><span>{Array.from(content).length} {tr("字", "characters")}</span></div>{(output === "en" || output === "bilingual") && <p className={styles.translationNote}>{tr("英文预览不会自动翻译自定义输入，请按需检查。", "Custom text is not automatically translated; review the English output.")}</p>}<pre className={styles.output} aria-label={tr("提示词内容", "Prompt content")} tabIndex={0}>{content}</pre><div className={styles.previewActions}><button className={styles.copy} type="button" onClick={() => void copy("preview")}><Copy size={16} />{tr("复制提示词", "Copy prompt")}</button>{copyFeedback?.target === "preview" && copyFeedback.content === content ? <span role={copyFeedback.success ? "status" : "alert"}>{copyFeedback.success ? tr("已复制当前内容。", "Copied.") : tr("复制失败，请选择预览内容手动复制。", "Copy failed. Select the preview text and copy it manually.")}</span> : <span>{tr("无需生图 · 可直接复制", "Text only · ready to copy")}</span>}</div></section>
      </div>
      </details>
      <div className={styles.mobileActions}><a href="#character-settings">{tr("返回配置", "Back to settings")}</a><a href="#character-preview">{tr("查看预览", "View preview")}</a><button type="button" onClick={() => void copy("mobile")}>{tr("复制当前内容", "Copy current output")}</button>{copyFeedback?.target === "mobile" && copyFeedback.content === content && <span className={feedback.mobileCopy} role={copyFeedback.success ? "status" : "alert"}>{copyFeedback.success ? tr("已复制当前内容。", "Copied.") : tr("复制失败，请查看预览并手动复制。", "Copy failed. Open the preview and copy manually.")}</span>}</div>
      <AlertDialog.Root open={confirmDelete} onOpenChange={setConfirmDelete}><AlertDialog.Portal><AlertDialog.Backdrop className={styles.dialogBackdrop} /><AlertDialog.Popup className={styles.dialog}><AlertDialog.Title>{tr("删除本机预设？", "Delete local preset?")}</AlertDialog.Title><AlertDialog.Description>{tr(`“${selected}”将从当前浏览器删除，无法撤销。`, `“${selected}” will be removed from this browser.`)}</AlertDialog.Description><div><AlertDialog.Close>{tr("取消", "Cancel")}</AlertDialog.Close><button type="button" onClick={remove}>{tr("确认删除", "Delete")}</button></div></AlertDialog.Popup></AlertDialog.Portal></AlertDialog.Root>
      <Dialog.Root open={loginOpen} onOpenChange={setLoginOpen}><Dialog.Portal><Dialog.Backdrop className={styles.dialogBackdrop} /><Dialog.Popup className={styles.dialog}><Dialog.Title>{assetLoadError ? tr("登录后打开角色", "Sign in to open your character") : tr("登录后保存角色", "Sign in to save your character")}</Dialog.Title><Dialog.Description>{assetLoadError ? tr("登录后将返回当前角色。", "Sign in to return to this character.") : tr("登录后可保存到个人角色库，当前设定会保留。", "Sign in to save to your library. Your settings will be kept.")}</Dialog.Description><div><Dialog.Close>{tr("稍后再说", "Not now")}</Dialog.Close><a onClick={(event) => { event.preventDefault(); const href = event.currentTarget.href; void prepareLogin().then((ready) => { if (ready) { markCharacterLoginResume(); window.location.assign(href); } else setLoginOpen(false); }); }} href={`${en ? "/en" : ""}/login?returnTo=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname + window.location.search : "/character-setting")}`}>{tr("登录", "Sign in")}</a></div></Dialog.Popup></Dialog.Portal></Dialog.Root>
      <AlertDialog.Root open={confirmLeave} onOpenChange={setConfirmLeave}><AlertDialog.Portal><AlertDialog.Backdrop className={styles.dialogBackdrop} /><AlertDialog.Popup className={styles.dialog}><AlertDialog.Title>{tr("离开角色设定？", "Leave character setup?")}</AlertDialog.Title><AlertDialog.Description>{tr("当前配置尚未保存为预设。返回此标签页时可恢复草稿；关闭标签页前请保存预设或导出文件。", "This configuration has not been saved as a preset. The draft can be restored in this tab; save a preset or export it before closing the tab.")}</AlertDialog.Description><div><AlertDialog.Close>{tr("继续编辑", "Keep editing")}</AlertDialog.Close><button type="button" onClick={() => { setConfirmLeave(false); router.push(leaveHref); }}>{tr("仍然离开", "Leave")}</button></div></AlertDialog.Popup></AlertDialog.Portal></AlertDialog.Root>
    </main>
  </div>;
}
