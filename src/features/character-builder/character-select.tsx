"use client";

import { Select } from "@base-ui/react/select";
import { ChevronDown } from "lucide-react";
import { SelectOptions, type SelectOption } from "@/components/select-field/select-options";
import styles from "@/components/select-field/select-field.module.css";

export function CharacterSelect({ label, value, options, onChange }: { label: string; value: string; options: SelectOption[]; onChange: (value: string) => void }) {
  return <Select.Root items={options} value={value} onValueChange={(next) => { if (next !== null) onChange(next); }}>
    <Select.Trigger aria-label={label} className={styles.trigger}><Select.Value /><Select.Icon className={styles.icon}><ChevronDown size={14} /></Select.Icon></Select.Trigger>
    <Select.Portal><Select.Positioner className={styles.positioner} alignItemWithTrigger={false} side="bottom" align="start" sideOffset={6} collisionPadding={12}><Select.Popup className={styles.popup}><Select.List className={styles.list}><SelectOptions options={options} /></Select.List></Select.Popup></Select.Positioner></Select.Portal>
  </Select.Root>;
}
