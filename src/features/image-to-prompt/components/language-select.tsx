"use client";

import { Select } from "@base-ui/react/select";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { SelectOptions } from "@/components/select-field/select-options";
import selectStyles from "@/components/select-field/select-field.module.css";
import styles from "./workspace.module.css";

export function OutputLanguage({ value, onChange }: { value: "zh" | "en"; onChange: (value: "zh" | "en") => void }) {
  const t = useTranslations("imageToPrompt");
  const options = [{ value: "zh", label: t("chinese") }, { value: "en", label: t("english") }];
  return <div className={styles.languageField}><span>{t("language")}</span>
    <Select.Root items={options} value={value} onValueChange={value => { if (value === "zh" || value === "en") onChange(value); }}>
      <Select.Trigger className={`${selectStyles.trigger} ${styles.languageTrigger}`} aria-label={t("language")}><Select.Value /><Select.Icon><ChevronDown size={14} /></Select.Icon></Select.Trigger>
      <Select.Portal><Select.Positioner alignItemWithTrigger={false} side="top" sideOffset={8} className={styles.languagePositioner}>
        <Select.Popup className={selectStyles.popup}><Select.List className={selectStyles.list}><SelectOptions options={options} /></Select.List></Select.Popup>
      </Select.Positioner></Select.Portal>
    </Select.Root>
  </div>;
}
