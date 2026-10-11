"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select } from "@base-ui/react/select";
import { Icon } from "@/components/icons/icon";
import styles from "./select-field.module.css";

interface SelectOption {
  label: string;
  value: string;
}

interface SelectFieldProps {
  label: string;
  name: string;
  options: SelectOption[];
  defaultValue: string;
}

export function SelectField({ label, name, options, defaultValue }: SelectFieldProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateFilter(value: string | null) {
    if (!value) return;

    const params = new URLSearchParams(searchParams.toString());
    if (value === "all" || value === "latest") {
      params.delete(name);
    } else {
      params.set(name, value);
    }

    const query = params.toString();
    router.push(query ? `/?${query}` : "/");
  }

  return (
    <Select.Root
      items={options}
      value={defaultValue}
      onValueChange={updateFilter}
    >
      <Select.Trigger
        aria-label={label}
        className={`${styles.trigger} ${name === "models" ? styles.modelFilter : ""}`}
      >
        <Select.Value />
        <Select.Icon className={styles.icon}>
          <Icon name="chevron" size={14} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        {/* Base UI otherwise aligns the selected item over the trigger on mouse input. */}
        <Select.Positioner
          className={styles.positioner}
          alignItemWithTrigger={false}
          side="bottom"
          align="end"
          sideOffset={6}
          collisionPadding={12}
        >
          <Select.Popup className={styles.popup}>
            <Select.List className={styles.list}>
              {options.map((option) => (
                <Select.Item key={option.value} value={option.value} className={styles.item}>
                  <Select.ItemText>{option.label}</Select.ItemText>
                  <Select.ItemIndicator className={styles.indicator}>
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="m3 8 3 3 7-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
