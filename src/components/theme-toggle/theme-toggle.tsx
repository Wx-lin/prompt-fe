"use client";

import { Select } from "@base-ui/react/select";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/icons/icon";
import type { Theme, ThemePreference } from "@/lib/theme/theme";
import selectStyles from "@/components/select-field/select-field.module.css";
import styles from "./theme-toggle.module.css";

interface ThemeToggleProps {
  theme: Theme;
  preference: ThemePreference;
  onPreferenceChange: (value: ThemePreference) => void;
}

export function ThemeToggle({ theme, preference, onPreferenceChange }: ThemeToggleProps) {
  const t = useTranslations("theme");
  const options = (["system", "light", "dark"] as const).map(value => ({ value, label: t(value) }));
  return <Select.Root items={options} value={preference} onValueChange={value => { if (value) onPreferenceChange(value); }}>
    <Select.Trigger className={styles.button} aria-label={`${t("label")}: ${t(preference)}`}>
      <Icon name={theme === "light" ? "sun" : "moon"} size={20} />
    </Select.Trigger>
    <Select.Portal>
      <Select.Positioner className={selectStyles.positioner} alignItemWithTrigger={false} align="end" sideOffset={6}>
        <Select.Popup className={selectStyles.popup}>
          <Select.List>{options.map(option => <Select.Item className={selectStyles.item} key={option.value} value={option.value}>
            <Select.ItemText>{option.label}</Select.ItemText>
            <Select.ItemIndicator>✓</Select.ItemIndicator>
          </Select.Item>)}</Select.List>
        </Select.Popup>
      </Select.Positioner>
    </Select.Portal>
  </Select.Root>;
}
