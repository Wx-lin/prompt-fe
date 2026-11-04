"use client";

import { useState } from "react";
import Image from "next/image";
import { characterAssetUrl } from "@/lib/character-asset-url";
import { Check } from "lucide-react";
import { GROUPS, UNSPECIFIED, type CharacterValues } from "./character-data";
import { CharacterSlider } from "./character-slider";
import { translateValue } from "./prompt-builder";
import { countryFlagCodes, extraFieldColors, occupationIcons, regionalTiles } from "./character-visual-embellishments";
import styles from "./character-workbench.module.css";
import visualStyles from "./character-visual-embellishments.module.css";

type Category = "basic" | "face" | "hair" | "body" | "skin" | "makeup" | "expression";
const defaults: Record<Category, string> = { basic: "gender", face: "faceShape", hair: "hairStyle", body: "bodyType", skin: "skinTone", makeup: "makeupStyle", expression: "expressions" };
const asset = (name: string) => `/character-visuals/${name}.png`;
const referenceImages: Record<string, Record<string, string>> = {
  faceShape: { 鹅蛋脸: asset("face-oval"), 圆脸: asset("face-round"), 方脸: asset("face-square"), 长脸: asset("face-long"), 心形脸: asset("face-heart"), 菱形脸: asset("face-diamond") },
  bodyType: { 纤细: asset("body-slim"), 匀称: asset("body-balanced"), 健壮: asset("body-athletic"), 丰满: asset("body-curvy") },
  gesture: { 站立: asset("pose-standing"), 行走: asset("pose-walking"), 坐下: asset("pose-sitting"), 转身: asset("pose-turning") },
  hairStyle: { 直发: "/character-demo/hair/hair_02_long_straight.png", 卷发: "/character-demo/hair/hair_03_soft_waves.png", 马尾: "/character-demo/hair/hair_04_ponytail.png", 盘发: "/character-demo/hair/hair_05_bun.png", 编发: "/character-demo/hair/hair_08_braid.png", 短碎发: "/character-demo/hair/hair_06_pixie.png", 波浪发: "/character-demo/hair/hair_03_soft_waves.png", 波波头: "/character-demo/hair/hair_01_bob.png", 高马尾: "/character-demo/hair/hair_04_ponytail.png", 低盘发: "/character-demo/hair/hair_05_bun.png" },
  expressions: { 平静: "/character-demo/expressions/expression_01_neutral.png", 微笑: "/character-demo/expressions/expression_02_smile.png", 开心: "/character-demo/expressions/expression_03_happy.png", 悲伤: "/character-demo/expressions/expression_04_sad.png", 愤怒: "/character-demo/expressions/expression_05_angry.png", 惊讶: "/character-demo/expressions/expression_06_surprised.png", 紧张: "/character-demo/expressions/expression_07_anxious.png", 思考: "/character-demo/expressions/expression_08_thoughtful.png" },
};
const spriteImages: Record<string, { file: string; choices: readonly string[] }> = {
  boneStructure: { file: "bone-structure", choices: ["柔和", "立体", "清晰", "圆润", "精致", "棱角分明"] },
  jawline: { file: "jawline", choices: ["柔和", "清晰", "圆润", "窄下颌", "方正"] },
  cheekbones: { file: "cheekbones", choices: ["柔和", "明显", "平缓", "适中", "略高"] },
  eyeShape: { file: "eyes", choices: ["杏眼", "圆眼", "丹凤眼", "细长眼", "下垂眼"] },
  eyeExpression: { file: "eye-expression", choices: ["坚定", "温和", "专注", "清澈", "疏离", "好奇"] },
  eyelids: { file: "eyelids", choices: ["自然双眼皮", "单眼皮", "内双", "平行双眼皮", "", "自然眼睑"] },
  eyelashes: { file: "eyelashes", choices: ["自然", "纤长", "浓密", "短睫毛"] },
  eyebrows: { file: "eyebrows", choices: ["自然眉", "平眉", "弯眉", "剑眉", "浓眉", "细眉"] },
  nose: { file: "nose", choices: ["直鼻", "小巧鼻", "圆鼻尖", "挺鼻梁", "宽鼻翼", "微翘鼻"] },
  lips: { file: "lips", choices: ["自然唇形", "饱满", "偏薄", "唇峰明显", "圆润"] },
  fringe: { file: "fringe", choices: ["无刘海", "齐刘海", "侧分刘海", "空气刘海", "碎刘海", "八字刘海"] },
  hairTexture: { file: "hair-texture", choices: ["柔顺", "蓬松", "细软", "浓密", "自然毛躁", "湿润"] },
  hairEnds: { file: "hair-ends", choices: ["自然直落", "微卷", "内扣", "外翘", "层次剪裁"] },
  hairCondition: { file: "hair-condition", choices: ["整洁", "随风飘动", "微乱", "湿发", "蓬松"] },
  hairLength: { file: "hair-length", choices: ["短发", "齐肩发", "中长发", "长发", "超长发", "光头"] },
  posture: { file: "posture", choices: ["挺拔", "放松", "优雅", "利落", "自然站姿", "略微前倾"] },
  shoulders: { file: "shoulders", choices: ["自然", "宽肩", "窄肩", "平肩", "柔和肩线", "颈部修长"] },
  legs: { file: "legs", choices: ["匀称", "修长", "健壮", "自然"] },
  pose: { file: "pose", choices: ["自然站姿", "双臂自然下垂", "双手交叠", "叉腰", "坐姿", "侧身"] },
  gazeDirection: { file: "gaze", choices: ["看向镜头", "望向远方", "侧看", "低头", "抬头", "闭眼"] },
  eyeMakeup: { file: "eye-makeup", choices: ["自然", "大地色", "淡眼线", "烟熏", "复古"] },
  makeupStyle: { file: "makeup", choices: ["素颜", "自然淡妆", "日常", "复古", "舞台", "古风"] },
  skinFinish: { file: "skin-finish", choices: ["自然", "哑光", "轻微光泽", "晒后"] },
};
// These generated boards have unequal row heights; preserve each cell's real aspect ratio.
const spriteDimensions: Record<string, { width: number; height: number; split: number }> = {
  pose: { width: 1024, height: 1536, split: 693 },
  posture: { width: 1024, height: 1536, split: 737 },
  legs: { width: 1223, height: 1286, split: 620 },
};
const colors: Record<string, string> = { 黑色: "#252322", 深棕: "#49342c", 浅棕: "#97725a", 金色: "#cfb577", 银色: "#c4c6c7", 红色: "#a74435", 蓝色: "#405979", 乌黑: "#18191b", 亚麻棕: "#8c7660", 栗棕色: "#76513d", 灰白色: "#d3d1cc", 铜红色: "#9f5338", 深紫色: "#514052", 墨蓝色: "#253e50", 浅粉: "#dcaca8", 豆沙色: "#ad7474", 珊瑚色: "#d6887c", 深红: "#923c47", 裸色: "#c79d90", 自然: "#be8c80", 白皙: "#f2d7c5", 浅肤色: "#eac7ac", 自然肤色: "#d6a687", 小麦色: "#b77f5d", 古铜色: "#945a3d", 深肤色: "#613e30", 蜜糖色: "#bc8461", 暖棕色肤色: "#a16d4e", 深棕色肤色: "#603b2a", 冷白肤色: "#eed3ce", 橄榄色肤色: "#b39a6f" };
const scaleChoices: Record<string, readonly string[]> = { hairLength: ["光头", "短发", "齐肩发", "中长发", "长发", "超长发"], eyeSpacing: ["略窄", "适中", "略宽"], actionIntensity: ["轻微", "适中", "明显"], emotionIntensity: ["轻微", "适中", "强烈"], skinDetailLevel: ["柔和", "适中", "丰富"] };
const quickSliders: Record<string, readonly { id: string; zh: string; en: string; choices: readonly string[] }[]> = {
  face: [
    { id: "boneStructure", zh: "骨相", en: "Bone structure", choices: ["柔和", "精致", "立体", "清晰", "棱角分明"] },
    { id: "jawline", zh: "下颌线", en: "Jawline", choices: ["柔和", "圆润", "清晰", "方正"] },
    { id: "cheekbones", zh: "颧骨", en: "Cheekbones", choices: ["平缓", "柔和", "适中", "略高", "明显"] },
  ],
  body: [{ id: "musculature", zh: "肌肉感", en: "Musculature", choices: ["自然", "轻微运动感", "结实", "肌肉明显"] }],
};

export function CharacterVisualControls({ category, values, en, onChange, previewExpression, onPreviewExpressionChange }: { category: Category; values: CharacterValues; en: boolean; onChange: (id: string, value: string) => void; previewExpression: string; onPreviewExpressionChange: (value: string) => void }) {
  const group = GROUPS.find((item) => item.id === category)!;
  const [fieldId, setFieldId] = useState(defaults[category]);
  const [custom, setCustom] = useState("");
  const field = group.fields.find((item) => item.id === fieldId) ?? group.fields[0];
  const value = values[field.id] ?? "";
  const selected = field.type === "tags" ? value.split(/[，,]/).map((part) => part.trim()).filter(Boolean) : [value];
  const choices = [...new Set([...(field.options ?? []), ...selected.filter((item) => item && item !== UNSPECIFIED)])];
  const choose = (choice: string) => {
    if (field.type !== "tags") { onChange(field.id, choice); return; }
    const next = selected.includes(choice) ? selected.filter((item) => item !== choice) : choice === "无" ? [choice] : [...selected.filter((item) => item !== "无" && item !== UNSPECIFIED), choice];
    const joined = next.join("，");
    if (joined.length <= 2000) onChange(field.id, joined);
  };
  const add = () => { const next = custom.trim(); if (!next) return; if (field.type === "tags" && selected.includes(next)) return; choose(next); setCustom(""); };
  const label = en ? field.enLabel : field.label;
  const images = referenceImages[field.id] ?? {};
  const sprite = spriteImages[field.id];
  const hasVisualImage = (choice: string) => Boolean(images[choice] || sprite?.choices.includes(choice) || (field.id === "regionalStyle" && regionalTiles[choice]));
  const hasImages = choices.some(hasVisualImage);
  const isColor = field.id === "hairColor" || field.id === "lipColor" || field.id === "skinTone";
  const levels = scaleChoices[field.id] ?? [];
  const visualChoices = hasImages ? choices.filter(hasVisualImage) : [];
  const textChoices = hasImages ? choices.filter((choice) => !hasVisualImage(choice)) : choices;
  const expressions = (values.expressions ?? "").split(/[，,]/).map((item) => item.trim()).filter((item) => item && item !== "无" && item !== UNSPECIFIED);
  const option = (choice: string, visual: boolean) => {
    const index = sprite?.choices.indexOf(choice) ?? -1;
    const dims = spriteDimensions[field.id];
    const rowHeight = dims ? index < 3 ? dims.split : dims.height - dims.split : 0;
    const tile = field.id === "regionalStyle" ? regionalTiles[choice] : undefined;
    const flag = field.id === "country" ? countryFlagCodes[choice] : undefined;
    const Icon = field.id === "occupation" ? occupationIcons[choice] : undefined;
    const color = extraFieldColors[field.id]?.[choice] ?? (isColor ? colors[choice] : undefined);
    return <button key={choice} type="button" aria-label={en ? translateValue(choice) : choice} aria-pressed={selected.includes(choice)} className={visual ? styles.visualOption : styles.choiceOption} onClick={() => choose(choice)}>
    {images[choice] ? <span className={`${styles.visualImage} ${field.id === "bodyType" || field.id === "gesture" ? styles.visualImageTall : ""}`}><Image src={characterAssetUrl(images[choice])} alt="" width={240} height={field.id === "bodyType" || field.id === "gesture" ? 360 : 240} loading="lazy" />{selected.includes(choice) && <span className={styles.check}><Check size={13} /></span>}</span> : sprite && index >= 0 ? <span className={`${styles.visualImage} ${styles.spriteImage}`} style={{ backgroundImage: `url(/_next/image?url=${encodeURIComponent(characterAssetUrl(asset(sprite.file)))}&w=640&q=75)`, backgroundSize: "300% auto", backgroundPosition: `${(index % 3) * 50}% ${index < 3 ? 0 : 100}%`, ...(dims ? { aspectRatio: `${dims.width} / ${rowHeight * 3}` } : {}) }}>{selected.includes(choice) && <span className={styles.check}><Check size={13} /></span>}</span> : tile ? <span className={`${styles.visualImage} ${styles.spriteImage}`} style={{ backgroundImage: `url(/_next/image?url=${encodeURIComponent(characterAssetUrl(asset(tile.file)))}&w=640&q=75)`, backgroundSize: "300% auto", backgroundPosition: `${(tile.index % 3) * 50}% ${tile.index < 3 ? 0 : 100}%` }}>{selected.includes(choice) && <span className={styles.check}><Check size={13} /></span>}</span> : flag ? <Image src={characterAssetUrl(`/character-visuals/flags/${flag}.svg`)} alt="" width={26} height={20} loading="eager" className={visualStyles.flag} /> : Icon ? <Icon size={18} className={visualStyles.optionIcon} aria-hidden="true" /> : color ? <span className={styles.swatch} style={{ backgroundColor: color }} /> : levels.includes(choice) ? <span className={styles.level} aria-hidden="true">{levels.map((level, index) => <i key={level} data-active={index <= levels.indexOf(choice)} />)}</span> : null}
    <span>{en ? translateValue(choice) : choice}</span>
  </button>;
  };
  return <div className={styles.visualControls}>
    <div className={styles.panelTitle}><h2>{en ? group.enLabel : group.label}</h2><span>{en ? "Choose a feature" : "选择调整部位"}</span></div>
    <div className={styles.visualSections} aria-label={en ? "Features" : "调整部位"}>{group.fields.map((item) => <button key={item.id} type="button" aria-pressed={field.id === item.id} onClick={() => { setFieldId(item.id); setCustom(""); }}>{en ? item.enLabel : item.label}</button>)}</div>
    {(quickSliders[category] ?? []).map((slider) => {
      const current = values[slider.id] ?? "";
      return <CharacterSlider key={slider.id} label={en ? slider.en : slider.zh} value={current} choices={slider.choices} onChange={(next) => onChange(slider.id, next)} formatValue={(next) => next ? (en ? translateValue(next) : next) : (en ? "Not specified" : "未指定")} />;
    })}
    <div className={styles.visualHeading}><strong>{label}</strong><span>{field.type === "tags" ? (en ? "Multiple" : "可多选") : choices.length ? (en ? "Select one" : "单选") : (en ? "Enter details" : "输入内容")}</span></div>
    {previewExpression && (field.id === "emotion" || field.id === "baseExpression") && <p className={styles.visualHint}>{en ? "Used for the design sheet. Single-image previews use the chosen preview expression." : "此项用于设定板；单张预览以所选预览表情为准。"}</p>}
    {field.id === "expressions" && expressions.length > 0 && <div className={styles.previewExpression}><strong>{en ? "Single-image preview" : "单张预览表情"}</strong><p>{en ? "The single-image preview uses this expression; the other choices apply to the design sheet." : "单张预览以此表情为准；其他表情配置用于设定板。"}</p><div className={styles.visualSections} aria-label={en ? "Preview expression" : "单张预览表情"}>{expressions.map((item) => <button key={item} type="button" aria-label={`${en ? "Preview" : "预览"} ${en ? translateValue(item) : item}`} aria-pressed={previewExpression === item} onClick={() => onPreviewExpressionChange(item)}>{en ? translateValue(item) : item}</button>)}</div></div>}
    {hasImages && <p className={styles.visualHint}>{en ? "Reference examples; generate to see the result." : "示例仅供参考，生成后查看效果"}</p>}
    {visualChoices.length > 0 && <div className={styles.visualGrid} aria-label={label}>{visualChoices.map((choice) => option(choice, true))}</div>}
    {textChoices.length > 0 && <><div className={styles.visualHeading}>{hasImages && <span>{en ? "More options" : "更多选项"}</span>}</div><div className={styles.choiceGrid} aria-label={label}>{textChoices.map((choice) => option(choice, false))}</div></>}
    <div className={styles.visualCustom}><input aria-label={`${label} ${en ? "custom" : "自定义"}`} value={custom} maxLength={field.type === "tags" ? 100 : field.type === "textarea" ? 2000 : 500} placeholder={en ? "Enter a custom value" : "输入自定义内容"} onChange={(event) => setCustom(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(); } }} /><button type="button" disabled={!custom.trim()} onClick={add}>{en ? "Apply" : "应用"}</button>{value && value !== UNSPECIFIED && <button type="button" aria-label={`${en ? "Clear" : "清除"} ${label}`} onClick={() => onChange(field.id, field.type === "tags" ? "" : UNSPECIFIED)}>{en ? "Clear" : "清除"}</button>}</div>
  </div>;
}
