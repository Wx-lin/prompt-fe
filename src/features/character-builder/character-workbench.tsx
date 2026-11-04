"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Tabs } from "@base-ui/react/tabs";
import { Dialog } from "@base-ui/react/dialog";
import { Check, Download, FileText, PersonStanding, Shirt, Smile, UserRound, Settings } from "lucide-react";
import { GROUPS, UNSPECIFIED, type CharacterValues } from "./character-data";
import { CharacterVisualControls } from "./character-visual-controls";
import { CharacterFieldControl } from "./character-fields";
import { markCharacterLoginResume } from "./character-draft-scope";
import { findOutfit, OUTFITS, OUTFIT_FILTERS, OUTFIT_FILTER_ENGLISH, type OutfitFilter } from "./character-outfits";
import styles from "./character-workbench.module.css";

type Category = "basic" | "face" | "hair" | "clothing" | "body" | "skin" | "makeup" | "expression";
const categories = [
  { id: "basic", zh: "基础信息", en: "Basic information", icon: FileText },
  { id: "face", zh: "脸部与发型", en: "Face and hair", icon: UserRound },
  { id: "body", zh: "身材与皮肤", en: "Body and skin", icon: PersonStanding },
  { id: "clothing", zh: "服装与妆饰", en: "Clothing and makeup", icon: Shirt },
  { id: "expression", zh: "表情与动作", en: "Expression and pose", icon: Smile },
] as const;
const promptGroups = new Set(["basic", "role", "face", "hair", "body", "skin", "makeup", "expression"]);

export type CharacterPreviewResult = { src: string; signature: string };
type Props = { values: CharacterValues; en: boolean; onChange: (id: string, value: string) => void; onApplyOutfit: (changes: Readonly<Record<string, string>>) => void; canUndo: boolean; authenticated?: boolean; initialPreview?: CharacterPreviewResult | null; exampleImage?: string | null; onPreviewChange?: (result: CharacterPreviewResult) => void; onCopyPrompt?: () => void; copyResult?: boolean | null; onAdvanced?: () => void; onBeforeLogin?: () => Promise<boolean>; initialCategory?: Category };
function buildImagePrompt(values: CharacterValues, outfit: string, extra: string, previewExpression: string) {
  const details = GROUPS.filter((group) => promptGroups.has(group.id)).flatMap((group) => group.fields
    .filter((field) => field.type !== "toggle" && field.id !== "expressions" && !(previewExpression && ["baseExpression", "emotion"].includes(field.id)) && values[field.id]?.trim() && values[field.id] !== UNSPECIFIED)
    .map((field) => `${field.label}：${values[field.id]}`));
  return ["生成单张写实人物全身肖像，头顶到鞋子完整入画，摄影棚背景，柔和立体光线。不要拼图、文字或水印。", ...details, previewExpression ? `预览表情：${previewExpression}` : "", `服装：${outfit}。`, ...["clothingStyle", "clothingColor", "material", "fit", "exposure"].map((key) => values[key] && values[key] !== UNSPECIFIED ? `${key === "clothingStyle" ? "服装风格" : key === "clothingColor" ? "服装颜色" : key === "material" ? "材质" : key === "fit" ? "版型" : "露肤范围"}：${values[key]}` : ""), extra ? `造型补充：${extra}` : ""].filter(Boolean).join("\n");
}

export function CharacterWorkbench({ values, en, onChange, onApplyOutfit, canUndo, authenticated = true, initialPreview = null, exampleImage, onPreviewChange, onCopyPrompt, copyResult = null, onAdvanced, onBeforeLogin, initialCategory = "clothing" }: Props) {
  const tr = (zh: string, english: string) => en ? english : zh;
  const [category, setCategory] = useState<Category>(initialCategory);
  const activeCategory = category === "hair" ? "face" : category === "skin" ? "body" : category === "makeup" ? "clothing" : category;
  const [tab, setTab] = useState("outfit");
  const [styleCategory, setStyleCategory] = useState<"hair" | "makeup">("hair");
  const [chosenFilter, setFilter] = useState<OutfitFilter | null>(null);
  const savedInputs = (() => { try { const parsed: unknown = JSON.parse(initialPreview?.signature ?? "null"); return Array.isArray(parsed) ? parsed : []; } catch { return []; } })();
  const extra = values.outfitNotes ?? "";
  const [view, setView] = useState<"full" | "half">("full");
  const [previewExpression, setPreviewExpression] = useState(values.baseExpression || (typeof savedInputs[3] === "string" ? savedInputs[3] : ""));
  const [result, setResult] = useState<CharacterPreviewResult | null>(initialPreview);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loginOpen, setLoginOpen] = useState(false);
  const inFlight = useRef<AbortController | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const outfit = findOutfit(values);
  const filter = chosenFilter ?? outfit?.style ?? "现代";
  const selected = outfit?.id ?? null;
  const source = result?.src ?? (exampleImage === undefined ? "/character-outfits/stage-transparent.png" : exampleImage);
  const expressionChoices = (values.expressions ?? "").split(/[，,]/).map((value) => value.trim()).filter((value) => value && value !== UNSPECIFIED && value !== "无");
  const activePreviewExpression = expressionChoices.includes(previewExpression) ? previewExpression : expressionChoices[0] ?? "";
  const choosePreviewExpression = (value: string) => { setPreviewExpression(value); onChange("baseExpression", value); };
  const signature = useMemo(() => JSON.stringify([values, selected, extra, activePreviewExpression]), [values, selected, extra, activePreviewExpression]);
  useEffect(() => () => { inFlight.current?.abort(); }, []);

  async function generate() {
    if (!authenticated) { setLoginOpen(true); return; }
    if (inFlight.current) return;
    const controller = new AbortController();
    inFlight.current = controller;
    setBusy(true); setError("");
    if (window.matchMedia?.("(max-width: 850px)").matches) {
      stageRef.current?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
    try {
      const clothing = outfit?.description ?? [values.clothingCategory, values.top, values.bottom, values.shoes].filter((value) => value && value !== UNSPECIFIED).join("，");
      const response = await fetch("/api/character-preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: buildImagePrompt(values, clothing, extra, activePreviewExpression), aspect_ratio: "3:4" }), signal: controller.signal });
      if (response.status === 401) { setLoginOpen(true); return; }
      if (!response.ok) throw new Error(response.status === 429 ? tr("生成次数已达上限，请稍后重试。", "Generation limit reached. Please try again later.") : response.status === 503 ? tr("角色预览服务暂不可用，请检查服务和 API 配置后重试。", "Preview service is unavailable. Check the service and API configuration.") : response.status === 502 ? tr("角色预览服务异常，请检查模型权限或稍后重试。", "Preview service failed. Check model access or try again later.") : tr("暂时无法生成，请稍后重试。", "Unable to generate. Please try again."));
      const body: unknown = await response.json();
      const data = body && typeof body === "object" && "data" in body ? body.data : null;
      if (!data || typeof data !== "object" || !("image_base64" in data) || !("mime_type" in data) || data.mime_type !== "image/png" || typeof data.image_base64 !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(data.image_base64)) throw new Error(tr("生成结果异常，请重试。", "Invalid image response. Please try again."));
      const nextResult = { src: `data:image/png;base64,${data.image_base64}`, signature };
      setResult(nextResult); onPreviewChange?.(nextResult);
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error && !(err instanceof TypeError) ? err.message : tr("暂时无法生成，请检查网络后重试。", "Unable to generate. Check your connection."));
    } finally { if (inFlight.current === controller) { inFlight.current = null; setBusy(false); } }
  }
  return <section className={styles.workbench} aria-label={tr("角色造型工作台", "Character styling workspace")}>
    <nav className={styles.side} aria-label={tr("角色调整", "Character settings")}>{categories.map(({ id, zh, en: english, icon: Icon }) => <button type="button" key={id} className={activeCategory === id ? styles.sideActive : ""} aria-pressed={activeCategory === id} onClick={() => setCategory(id)}><Icon size={18} />{tr(zh, english)}</button>)}<a href="#advanced-character-options" onClick={onAdvanced}><Settings size={18} />{tr("高级设置", "Advanced settings")}</a></nav>
    <div className={styles.stage} ref={stageRef}>
      <div className={styles.stageLabel}>{result ? tr("AI 生成预览", "AI preview") : source ? tr("角色示例", "Example character") : tr("角色预览", "Character preview")}</div>
      <div className={styles.viewSwitch} aria-label={tr("预览范围", "Preview framing")}><button type="button" aria-pressed={view === "half"} onClick={() => setView("half")}>{tr("半身", "Upper body")}</button><button type="button" aria-pressed={view === "full"} onClick={() => setView("full")}>{tr("全身", "Full body")}</button></div>
      <div className={view === "half" ? styles.stageImageHalf : styles.stageImageFull}>
      {source ? <Image src={source} width={1024} height={1536} alt={result ? tr("AI 生成的角色预览", "AI character preview") : tr("角色示例图", "Example character")} unoptimized={Boolean(result)} priority /> : <div className={styles.stagePlaceholder}><UserRound size={48} strokeWidth={1.2} /><span>{tr("尚未生成角色预览", "No character preview yet")}</span></div>}
      {busy && <div className={styles.generatingOverlay} role="status" aria-live="polite">
        <span className={styles.dotWave} aria-hidden="true" />
        <div className={styles.generatingCard}><strong>{tr("正在生成角色", "Generating your character")}</strong></div>
        <span className={styles.generatingStatus} aria-hidden="true">{tr("生成中", "Generating")}</span>
      </div>}
      </div>
      <div className={styles.stageFoot}><div><strong>{result || !source ? tr("角色预览", "Character preview") : tr("全身角色示例", "Full-body example")}</strong><p>{result ? result.signature === signature ? tr("本次生成结果", "Current result") : tr("配置已更改，当前展示上次生成结果", "Settings changed; showing previous result") : source ? tr("示例图仅供展示，生成后显示你的角色", "Example only; your result appears after generation") : tr("生成后将在这里显示角色图片", "Your generated character will appear here")}</p></div>{result && <a href={result.src} download="character-preview.png"><Download size={15} />{tr("下载", "Download")}</a>}</div>
    </div>
    <div className={styles.panel}>
      {(activeCategory === "face" || activeCategory === "body") && <div className={styles.sectionSwitch} aria-label={tr("选择配置分类", "Choose configuration group")}>{(activeCategory === "face" ? [{ id: "face" as const, zh: "脸部五官", en: "Facial features" }, { id: "hair" as const, zh: "发型", en: "Hair" }] : [{ id: "body" as const, zh: "身材体态", en: "Body and posture" }, { id: "skin" as const, zh: "肤色皮肤", en: "Skin" }]).map((item) => <button key={item.id} type="button" aria-pressed={category === item.id} onClick={() => setCategory(item.id)}>{tr(item.zh, item.en)}</button>)}</div>}
      {category === "basic" ? <div className={styles.basicFields}><div className={styles.panelTitle}><h2>{tr("基础信息", "Basic information")}</h2></div>{GROUPS.find((group) => group.id === "basic")?.fields.map((field) => <CharacterFieldControl key={field.id} field={field} value={values[field.id] ?? ""} en={en} onChange={(value) => onChange(field.id, value)} />)}<details><summary>{tr("使用图示选择", "Choose with illustrations")}</summary><CharacterVisualControls category="basic" values={values} en={en} onChange={onChange} previewExpression={activePreviewExpression} onPreviewExpressionChange={choosePreviewExpression} /></details></div> : category === "clothing" ? <Tabs.Root value={tab} onValueChange={(value) => { if (value) setTab(value); }}>
        <Tabs.List className={styles.tabs} aria-label={tr("造型类别", "Styling categories")}><Tabs.Tab value="style">{tr("造型", "Style")}</Tabs.Tab><Tabs.Tab value="outfit">{tr("服装", "Outfits")}</Tabs.Tab><Tabs.Tab value="ai">{tr("AI 生成", "AI")}</Tabs.Tab></Tabs.List>
        <Tabs.Panel value="outfit"><div className={styles.panelTitle}><h2>{tr("服装风格", "Outfit style")}</h2><span>{tr("整套搭配", "Full outfits")}</span></div><div className={styles.filters} aria-label={tr("服装风格", "Outfit style")}>{OUTFIT_FILTERS.map((item) => <button type="button" key={item} aria-pressed={filter === item} onClick={() => setFilter(item)}>{en ? OUTFIT_FILTER_ENGLISH[item] : item}</button>)}</div><div className={styles.grid} role="group" aria-label={tr("可选套装", "Available outfits")}>{OUTFITS.filter((item) => item.style === filter).map((item) => <button key={item.id} type="button" aria-label={en ? item.en : item.name} aria-pressed={selected === item.id} className={styles.outfit} onClick={() => { if (selected === item.id) return; onApplyOutfit({ clothingCategory: item.category, top: item.parts[0], bottom: item.parts[1], shoes: item.parts[2], clothingStyle: UNSPECIFIED, clothingColor: UNSPECIFIED, material: UNSPECIFIED, fit: UNSPECIFIED, exposure: UNSPECIFIED }); }}><span className={styles.outfitImage}>
          {item.image.columns === 1 ? <Image src={item.image.src} alt="" width={240} height={360} loading="lazy" /> : <span className={styles.outfitSprite} aria-hidden="true" style={{ backgroundImage: `url("${item.image.src}")`, backgroundSize: `${item.image.columns * 100}% 200%`, backgroundPosition: `${(item.image.index % item.image.columns) * 100 / (item.image.columns - 1)}% ${Math.floor(item.image.index / item.image.columns) * 100}%` }} />}{selected === item.id && <span className={styles.check}><Check size={13} /></span>}</span><span>{en ? item.en : item.name}</span></button>)}</div></Tabs.Panel>
        <Tabs.Panel value="style"><div className={styles.panelTitle}><h2>{tr("发型与妆容", "Hair and makeup")}</h2></div><div className={styles.visualSections} aria-label={tr("造型类型", "Styling type")}><button type="button" aria-pressed={styleCategory === "hair"} onClick={() => setStyleCategory("hair")}>{tr("发型", "Hair")}</button><button type="button" aria-pressed={styleCategory === "makeup"} onClick={() => setStyleCategory("makeup")}>{tr("妆容配饰", "Makeup and accessories")}</button></div><CharacterVisualControls key={styleCategory} category={styleCategory} values={values} en={en} onChange={onChange} previewExpression={activePreviewExpression} onPreviewExpressionChange={choosePreviewExpression} /></Tabs.Panel>
        <Tabs.Panel value="ai"><div className={styles.panelTitle}><h2>{tr("描述你的造型", "Describe your look")}</h2></div><label className={styles.description}><span>{tr("补充描述", "Additional description")}</span><textarea value={extra} maxLength={1000} onChange={(event) => onChange("outfitNotes", event.target.value)} placeholder={tr("例如：衣服偏宽松，搭配银色耳饰", "For example: a relaxed fit with silver earrings")} /></label><p className={styles.help}>{tr("将描述和所选服装一起用于生成。参考图上传暂未开放。", "Your description is used with the selected outfit. Reference image upload is not available yet.")}</p></Tabs.Panel>
      </Tabs.Root> : <CharacterVisualControls key={category} category={category} values={values} en={en} onChange={onChange} previewExpression={activePreviewExpression} onPreviewExpressionChange={choosePreviewExpression} />}
      <div className={styles.panelFooter}>{outfit && canUndo && <a className={styles.undoLink} href="#character-change-notice">{tr("查看撤销操作 ↑", "Review undo options ↑")}</a>}{error && <p role="alert" className={styles.error}>{error}</p>}<button type="button" className={styles.generate} disabled={busy} onClick={() => void generate()}>{busy ? tr("生成中，请稍候…", "Generating…") : tr("确认生成", "Generate preview")}</button>{!authenticated && <p>{tr("登录后可生成", "Sign in to generate")}</p>}<p>{tr("选择后预览不会立即变化；确认后将重新生图，人物外貌可能变化。每次生成消耗 API 额度。", "Selection does not change the preview immediately. Generating creates a new image and the character's appearance may change. Each generation uses API credits.")}</p><div className={styles.outputActions}>{onCopyPrompt && <button type="button" aria-label={tr("复制当前角色提示词", "Copy current character prompt")} onClick={onCopyPrompt}>{tr("复制提示词", "Copy prompt")}</button>}{result ? <a href={result.src} download="character-preview.png">{tr("下载图片", "Download image")}</a> : <button type="button" disabled>{tr("下载图片", "Download image")}</button>}</div>{copyResult !== null && <p role={copyResult ? "status" : "alert"}>{copyResult ? tr("已复制当前提示词。", "Prompt copied.") : tr("复制失败，请到提示词预览中手动复制。", "Copy failed. Copy the prompt manually from the preview.")}</p>}</div>
    </div>
    <Dialog.Root open={loginOpen} onOpenChange={setLoginOpen}><Dialog.Portal><Dialog.Backdrop className={styles.loginBackdrop} /><Dialog.Popup className={styles.loginDialog}><Dialog.Title>{tr("登录后生成角色预览", "Sign in to generate a preview")}</Dialog.Title><Dialog.Description>{tr("登录后即可生成角色预览并保存到个人角色库。当前设定会保留。", "Sign in to generate and save your character. Your settings will be kept.")}</Dialog.Description><div><Dialog.Close>{tr("稍后再说", "Not now")}</Dialog.Close><a onClick={(event) => { if (!onBeforeLogin) { markCharacterLoginResume(); return; } event.preventDefault(); const href = event.currentTarget.href; void onBeforeLogin().then((ready) => { if (ready) { markCharacterLoginResume(); window.location.assign(href); } else setLoginOpen(false); }); }} href={`${en ? "/en" : ""}/login?returnTo=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname + window.location.search : "/character-setting")}`}>{tr("登录", "Sign in")}</a></div></Dialog.Popup></Dialog.Portal></Dialog.Root>
  </section>;
}
