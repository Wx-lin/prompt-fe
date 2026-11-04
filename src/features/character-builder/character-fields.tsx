"use client";

import { useId, useState } from "react";
import { UNSPECIFIED, type CharacterField, type CharacterValues } from "./character-data";
import { translateValue } from "./prompt-builder";
import { isValidNumber, NUMBER_LIMITS } from "./number-limits";
import { CharacterCombobox } from "./character-combobox";
import styles from "./character-builder.module.css";

type Props = { field: CharacterField; value: string; en: boolean; onChange: (value: string) => void };

export function CharacterFieldControl({ field, value, en, onChange }: Props) {
  const id = useId();
  const [custom, setCustom] = useState("");
  const [numberError, setNumberError] = useState(false);
  const label = en ? field.enLabel : field.label;
  const options = field.options ?? [];
  if (field.type === "toggle") return <label className={styles.toggleRow}><span>{label}</span><input type="checkbox" checked={value === "true"} onChange={(event) => onChange(String(event.target.checked))} /></label>;
  if (field.type === "tags") {
    const selected = value.split(/[，,]/).map((part) => part.trim()).filter(Boolean);
    const choices = [...new Set([...options, ...selected])];
    const setTags = (next: string[]) => { const normalized = next.length > 1 ? next.filter((item) => item !== "无") : next; const joined = normalized.join("，"); if (joined.length > 2000) { setNumberError(true); return; } setNumberError(false); onChange(joined); };
    const toggle = (choice: string) => {
      if (selected.includes(choice)) { setTags(selected.filter((item) => item !== choice)); return; }
      setTags(choice === "无" ? ["无"] : [...selected.filter((item) => item !== "无"), choice]);
    };
    const add = () => { const next = custom.trim(); if (next && !selected.includes(next)) setTags(next === "无" ? ["无"] : [...selected.filter((item) => item !== "无"), next]); setCustom(""); };
    return <div className={styles.fieldWide}><span className={styles.fieldLabel}>{label}</span><div className={styles.tags} aria-label={label}>{choices.map((choice) => <button key={choice} type="button" aria-pressed={selected.includes(choice)} className={selected.includes(choice) ? styles.selectedTag : styles.tag} onClick={() => toggle(choice)}>{en ? translateValue(choice) : choice}</button>)}</div><div className={styles.customTag}><input aria-label={`${label} ${en ? "custom" : "自定义"}`} value={custom} maxLength={100} placeholder={en ? "Add a custom option" : "输入自定义选项"} onChange={(event) => setCustom(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(); } }} /><button type="button" onClick={add} disabled={!custom.trim()}>{en ? "Add" : "添加"}</button></div>{numberError && <small role="alert" className={styles.error}>{en ? "Selections cannot exceed 2000 characters." : "选项总长度不能超过 2000 字符。"}</small>}</div>;
  }
  if (field.id in NUMBER_LIMITS) {
    const limits = NUMBER_LIMITS[field.id];
    return <label className={styles.field} htmlFor={id}><span className={styles.fieldLabel}>{label}</span><input id={id} type="number" inputMode={limits.integer ? "numeric" : "decimal"} min={limits.min} max={limits.max} step={limits.integer ? 1 : "any"} value={value} onChange={(event) => { const next = event.target.value; if (!isValidNumber(field.id, next)) { setNumberError(true); return; } setNumberError(false); onChange(next); }} /><small className={styles.numericHint}>{en ? `${limits.integer ? "Whole number" : "Number"} ${limits.min}–${limits.max}` : `请输入 ${limits.min}–${limits.max} 的${limits.integer ? "整数" : "数值"}`}</small>{numberError && <small role="alert" className={styles.error}>{en ? "Enter a valid number in range." : "数值无效，请输入范围内的数值。"}</small>}</label>;
  }
  const displayValue = en && field.type === "select" && options.includes(value) ? translateValue(value) : value;
  return <label className={field.type === "textarea" ? styles.fieldWide : styles.field} htmlFor={id}><span className={styles.fieldLabel}>{label}</span>{field.type === "textarea" ? <textarea id={id} value={value === UNSPECIFIED ? "" : value} placeholder={value === UNSPECIFIED ? (en ? "Not specified" : UNSPECIFIED) : undefined} maxLength={2000} rows={3} onChange={(event) => onChange(event.target.value)} /> : field.type === "select" ? <CharacterCombobox id={id} label={label} value={displayValue} options={en ? options.map(translateValue) : options} en={en} onChange={(next) => onChange(en ? options.find((option) => translateValue(option) === next) ?? next : next)} /> : <input id={id} type="text" value={displayValue} maxLength={500} onChange={(event) => onChange(event.target.value)} />}</label>;
}

export function FieldGroup({ title, fields, values, en, initialOpen, open, onToggle, onChange }: { title: string; fields: readonly CharacterField[]; values: CharacterValues; en: boolean; initialOpen: boolean; open?: boolean; onToggle?: (open: boolean) => void; onChange: (id: string, value: string) => void }) {
  return <details className={styles.group} open={open ?? (initialOpen || undefined)}><summary onClick={(event) => { if (open !== undefined && onToggle) { event.preventDefault(); onToggle(!open); } }}><span>{title}</span><small>{fields.length} {en ? "fields" : "项"}</small></summary><div className={styles.fieldGrid}>{fields.map((field) => <CharacterFieldControl key={field.id} field={field} value={values[field.id] ?? ""} en={en} onChange={(value) => onChange(field.id, value)} />)}</div></details>;
}
