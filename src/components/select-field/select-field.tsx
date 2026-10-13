"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select } from "@base-ui/react/select";
import { Icon } from "@/components/icons/icon";
import { SelectOptions, type SelectOption } from "./select-options";
import styles from "./select-field.module.css";

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
    if (value === "all" || (name === "sort" && value === "recommended" && !params.get("q"))) {
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
              <SelectOptions options={options} />
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
