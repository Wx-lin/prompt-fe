"use client";

import { Select } from "@base-ui/react/select";
import styles from "./select-field.module.css";

export interface SelectOption {
  label: string;
  value: string;
  group?: string;
}

function OptionItem({ option }: { option: SelectOption }) {
  return (
    <Select.Item value={option.value} className={styles.item}>
      <Select.ItemText>{option.label}</Select.ItemText>
      <Select.ItemIndicator className={styles.indicator}>
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="m3 8 3 3 7-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Select.ItemIndicator>
    </Select.Item>
  );
}

export function SelectOptions({ options }: { options: SelectOption[] }) {
  const groups = [...new Set(options.map(option => option.group).filter(Boolean))];
  return <>
    {options.filter(option => !option.group).map(option => <OptionItem key={option.value} option={option} />)}
    {groups.map(group => (
      <Select.Group key={group}>
        <Select.GroupLabel className={styles.groupLabel}>{group}</Select.GroupLabel>
        {options.filter(option => option.group === group).map(option => <OptionItem key={option.value} option={option} />)}
      </Select.Group>
    ))}
  </>;
}
