"use client";

import { useRef, useState } from "react";
import { characterAssetUrl } from "@/lib/character-asset-url";
import { ArrowLeft, ArrowUpRight, Copy, RotateCcw, Sparkles } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { ThemeToggleControl } from "@/components/theme-provider/theme-toggle-control";
import { Link } from "@/i18n/navigation";
import { basicClothes, sweetClothes, type ClothingMaterial } from "./clothing-options";
import { characterMaterials, hairMaterials, expressionMaterials } from "./material-options";
import { useLiveGeneration } from "./use-live-generation";
import styles from "./character-demo.module.css";

type Category = "角色" | "发型" | "服装" | "表情";
const categories: Category[] = ["角色", "发型", "服装", "表情"];

export function CharacterDemo() {
  const [category, setCategory] = useState<Category>("角色");
  const [selected, setSelected] = useState<ClothingMaterial | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const previewRef = useRef<HTMLElement>(null);
  const live = useLiveGeneration();
  const reference = characterMaterials.find((item) => item.name === live.settings.role) ?? characterMaterials[0];
  const canShowResult = live.result?.role === live.settings.role;
  const isCurrent = canShowResult && live.result?.signature === JSON.stringify(live.settings);
  const selectMaterial = (item: ClothingMaterial) => {
    live.update(category, item.name, item.part);
    setSelected(item);
    setCopyStatus("idle");
    if (window.matchMedia?.("(max-width: 760px)").matches) previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const copyPrompt = async () => {
    if (!selected) return;
    try { await navigator.clipboard.writeText(selected.prompt); setCopyStatus("copied"); }
    catch { setCopyStatus("error"); }
  };
  return <div className={styles.shell}>
    <header className={styles.header}><BrandLogo /><div className={styles.headerRight}><ThemeToggleControl /><Link href="/">返回图库 <ArrowUpRight size={15} /></Link></div></header>
    <main className={styles.main}>
      <Link className={styles.back} href="/"><ArrowLeft size={15} /> 返回提示词库</Link>
      <div className={styles.heading}><div className={styles.eyebrow}>CHARACTER STUDIO <span>体验版</span></div><h1>AI 角色工作台</h1><p>选择角色和造型，生成你的角色预览。</p></div>
      <div className={styles.notice}><Sparkles size={16} /><span>先选择角色、发型、服装和表情，再点击生成。图片将通过 GPT 图像模型生成。</span></div>
      <div className={styles.selectionSummary} aria-label="当前角色配置"><span>角色：{live.settings.role}</span><span>发型：{live.settings.hair}</span>{live.settings.clothing && <span>服装：{live.settings.clothing}</span>}{live.settings.bottom && <span>下装：{live.settings.bottom}</span>}{live.settings.hosiery && <span>丝袜：{live.settings.hosiery} <button type="button" aria-label="移除丝袜" onClick={() => live.update("服装", "", "丝袜")}>×</button></span>}<span>表情：{live.settings.expression}</span></div>
      <div className={styles.workspace}>
        <section className={styles.controlPanel} aria-label="角色调整">
          <div className={styles.panelHeading}><div><h2>设计你的角色</h2><p>选择角色、造型和表情</p></div><span className={styles.step}>01</span></div>
          <div className={styles.tabs} aria-label="调整类别">{categories.map((item) => <button type="button" key={item} className={category === item ? styles.activeTab : ""} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div>
          {category === "角色" && <MaterialGroup title="选择角色" items={characterMaterials} selectedName={live.settings.role} onSelect={selectMaterial} />}
          {category === "发型" && <MaterialGroup title="选择发型" items={hairMaterials} selectedName={live.settings.hair} onSelect={selectMaterial} />}
          {category === "表情" && <MaterialGroup title="选择表情" items={expressionMaterials} selectedName={live.settings.expression} onSelect={selectMaterial} />}
          {category === "服装" && <><MaterialGroup title="甜美多巴胺" items={sweetClothes} selectedName={`${live.settings.clothing}|${live.settings.bottom}|${live.settings.hosiery}`} onSelect={selectMaterial} /><MaterialGroup title="常见服装" items={basicClothes} selectedName={`${live.settings.clothing}|${live.settings.bottom}|${live.settings.hosiery}`} onSelect={selectMaterial} /></>}
          <div className={styles.divider} />
          <div className={styles.sectionTitle}><div><h3>修改说明</h3><p>所选素材的图片编辑指令</p></div></div>
          <div className={styles.prompt}>{selected?.prompt ?? "选择一个素材，查看对应的编辑指令。"}</div>
          <button className={styles.copy} type="button" onClick={copyPrompt} disabled={!selected}><Copy size={15} /> {copyStatus === "copied" ? "已复制" : "复制编辑指令"}</button>
          {copyStatus === "error" && <p className={styles.helper} role="alert">复制失败，请手动选择上方文字复制。</p>}
        </section>
        <section ref={previewRef} className={styles.previewPanel} aria-label="角色预览">
          <div className={styles.previewTop}><div><h2>角色预览</h2><p>{isCurrent ? "当前 AI 生成结果" : canShowResult ? "上一次生成的结果，当前配置尚未更新" : "角色参考图，选择造型后生成"}</p></div><span className={styles.status}>{isCurrent ? "AI 生成" : canShowResult ? "待更新" : "参考图"}</span></div>
          <div className={styles.stage}><img src={characterAssetUrl(canShowResult ? live.result!.image : reference.image)} alt={canShowResult ? "AI 生成的角色" : `角色参考图：${live.settings.role}`} /></div>
          <div className={styles.previewBottom}><div><strong>{isCurrent ? "本次生成" : canShowResult ? "上次生成" : live.settings.role}</strong><p>{canShowResult ? "模型生成的细节与角色一致性可能有变化。" : "参考素材不是生成结果。"}</p></div><button type="button" onClick={live.clear} disabled={!live.result || live.busy}><RotateCcw size={15} /> 恢复参考图</button></div>
          <div className={styles.generateArea}>
            <button className={styles.generate} type="button" disabled={live.busy} onClick={() => { void live.generate(); }}><Sparkles size={16} /> {live.busy ? "正在生成，请稍候…" : live.result ? "重新生成" : "生成角色"}</button>
            <label className={styles.auto}><input type="checkbox" checked={live.auto} onChange={(event) => live.setAuto(event.target.checked)} /> 选择后自动更新</label>
            <p className={styles.helper}>首次生成后，开启自动更新会生成尚未更新的配置，之后修改选项也会再次生图。每次调用可能产生费用，具体以 OpenAI 计费为准。</p>
            {live.error && <p role="alert" className={styles.helper}>{live.error}</p>}
          </div>
        </section>
      </div>
      <p className={styles.footer}>本地体验版 · 人物和素材为示例，生成结果取决于模型</p>
    </main>
  </div>;
}
function MaterialGroup({ title, items, selectedName, onSelect }: { title: string; items: readonly ClothingMaterial[]; selectedName: string; onSelect: (item: ClothingMaterial) => void }) {
  return <div className={styles.materialGroup}>
    <div className={styles.sectionTitle}><div><h3>{title}</h3><p>选择素材</p></div><span>{items.length} 款</span></div>
    <div className={styles.materialOptions}>{items.map((item) => <button type="button" key={item.name} aria-label={item.name} aria-pressed={selectedName.split("|").includes(item.name)} className={`${styles.option} ${styles.materialOption} ${selectedName.split("|").includes(item.name) ? styles.selectedOption : ""}`} onClick={() => onSelect(item)}>
      <span className={styles.materialImage}><img src={characterAssetUrl(item.image)} alt="" loading="lazy" /></span><span className={styles.optionName}>{item.name}</span>
    </button>)}</div>
  </div>;
}
