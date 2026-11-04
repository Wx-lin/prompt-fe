"use client";

import { Combobox } from "@base-ui/react/combobox";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import styles from "./character-builder.module.css";

const CUSTOM_CHOICE = "\u0000custom";

export function CharacterCombobox({ id, label, value, options, en, onChange }: { id: string; label: string; value: string; options: readonly string[]; en: boolean; onChange: (value: string) => void }) {
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState(value);
  const [open, setOpen] = useState(false);
  const draftRef = useRef(value);
  const selectOnPointerUp = useRef(false);
  const submittedOnTab = useRef(false);
  useEffect(() => {
    draftRef.current = value;
    // The parent can replace values through reset, preset or import while this field remains mounted.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(value);
  }, [value]);
  const updateDraft = (next: string) => { draftRef.current = next; setDraft(next); };
  const commit = (next: string) => { updateDraft(next); if (next !== value) onChange(next); };
  const filtered = options.filter((option) => option.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const customAvailable = Boolean(query.trim()) && !options.includes(query);
  const items = customAvailable ? [...options, CUSTOM_CHOICE] : [...options];
  const visibleItems = customAvailable ? [...filtered, CUSTOM_CHOICE] : filtered;
  return <Combobox.Root items={items} filteredItems={visibleItems} value={value} inputValue={draft} open={open} autoHighlight
    onOpenChange={(nextOpen, details) => {
      setOpen(nextOpen);
      if (!nextOpen) {
        if (details.reason !== "item-press" && !submittedOnTab.current) updateDraft(value);
        setQuery("");
      } else {
        submittedOnTab.current = false;
        if (details.reason !== "input-change") setQuery("");
      }
    }}
    onInputValueChange={(next, details) => { if (details.reason === "input-change" || details.reason === "input-clear") { setQuery(next); updateDraft(next); } }}
    onValueChange={(next) => { if (typeof next === "string") { commit(next === CUSTOM_CHOICE ? draftRef.current : next); setQuery(""); } }}>
    <div className={styles.combobox}><Combobox.Input id={id} aria-label={label} maxLength={500} onPointerDown={(event) => { selectOnPointerUp.current = document.activeElement !== event.currentTarget; }} onFocus={(event) => event.currentTarget.select()} onMouseUp={(event) => { if (selectOnPointerUp.current) { event.preventDefault(); event.currentTarget.select(); selectOnPointerUp.current = false; } }} onBlur={(event) => { selectOnPointerUp.current = false; if (!submittedOnTab.current && !event.relatedTarget?.closest('[role="listbox"]')) updateDraft(value); }} onKeyDown={(event) => { if (event.key === "Tab" && !event.nativeEvent.isComposing && query.trim() && filtered.length === 0) { submittedOnTab.current = true; commit(draftRef.current); } if (event.key === "Enter" && !event.nativeEvent.isComposing && ((!draft.trim() && Boolean(value)) || filtered.length === 0 || event.ctrlKey || event.metaKey)) { event.preventDefault(); commit(draftRef.current); setOpen(false); setQuery(""); } }} /><Combobox.Trigger aria-label={en ? `Show ${label} options` : `展开${label}选项`}><ChevronDown size={15} /></Combobox.Trigger></div>
    <Combobox.Portal><Combobox.Positioner sideOffset={6} collisionPadding={12} align="start" className={styles.comboPositioner}><Combobox.Popup className={styles.comboPopup}><Combobox.Empty className={styles.comboEmpty}>{en ? "No matching options" : "没有匹配选项"}</Combobox.Empty><Combobox.List className={styles.comboList}>{(item: string) => <Combobox.Item key={item} value={item} className={styles.comboItem}><span>{item === CUSTOM_CHOICE ? (en ? `Use “${draft}”` : `使用输入内容：${draft}`) : item}</span>{item === value && <Check size={16} aria-hidden="true" />}</Combobox.Item>}</Combobox.List>{!draft.trim() && value && <div className={styles.comboEmpty}>{en ? "Press Enter to clear this value" : "按回车清空此项"}</div>}{query && filtered.length > 0 && <div className={styles.comboEmpty}>{en ? "Enter selects the highlighted option · Ctrl/⌘ + Enter uses your text" : "回车选择高亮选项 · Ctrl/⌘ + 回车使用输入内容"}</div>}</Combobox.Popup></Combobox.Positioner></Combobox.Portal>
  </Combobox.Root>;
}
