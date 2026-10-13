"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { useTranslations } from "next-intl";
import { SelectOptions } from "@/components/select-field/select-options";
import { Select } from "@base-ui/react/select";
import { useRouter } from "@/i18n/navigation";
import { ImageUpload } from "./image-upload";
import type { Category } from "@/types/prompt";
import type { SubmissionUpload } from "@/types/submission";
import styles from "./submissions.module.css";
import selectStyles from "@/components/select-field/select-field.module.css";

interface Option {
  key: string;
  label: string;
  group?: string;
}

function Choice({ label, options, value, onChange }: {
  label: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
}) {
  return <Select.Root
    items={options.map(item => ({ value: item.key, label: item.label }))}
    value={value}
    onValueChange={next => {
      if (next)
        onChange(next);
    }}>
    <Select.Trigger className={selectStyles.trigger} aria-label={label}>
      <Select.Value placeholder={label} />
      <Select.Icon>
        ⌄
      </Select.Icon>
    </Select.Trigger>
    <Select.Portal>
      <Select.Positioner className={selectStyles.positioner} alignItemWithTrigger={false} sideOffset={6}>
        <Select.Popup className={selectStyles.popup}>
          <Select.List className={selectStyles.list}>
            <SelectOptions
              options={options.map(option => ({
                value: option.key,
                label: option.label,
                group: option.group
              }))}
            />
          </Select.List>
        </Select.Popup>
      </Select.Positioner>
    </Select.Portal>
  </Select.Root>;
}

export function PublishForm({ categories, models }: {
  categories: Category[];
  models: Option[];
}) {
  const t = useTranslations("submissions");
  const router = useRouter();
  const [uploads, setUploads] = useState<SubmissionUpload[]>([]);
  const [category, setCategory] = useState("");
  const [model, setModel] = useState("");
  const [version, setVersion] = useState("");
  const selectedModel = models.find(option => option.key === model);
  const canAddVersion = Boolean(selectedModel?.group && selectedModel.key === selectedModel.group);
  const fullModel = canAddVersion && version.trim() ? `${model} ${version.trim()}` : model;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const [uploadBlocked, setUploadBlocked] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || uploadBlocked)
      return;
    if (!uploads.length || !category || !model || fullModel.length > 50) {
      setError(t("required"));
      return;
    }
    const data = new FormData(event.currentTarget);
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: String(data.get("title")).trim(),
          prompt_text: String(data.get("prompt_text")).trim(),
          description: String(data.get("description")).trim(),
          category,
          models: [fullModel],
          upload_ids: uploads.map(item => item.id)
        })
      });
      if (response.status === 401) {
        router.push("/login?returnTo=/publish");
        return;
      }
      if (!response.ok)
        throw new Error("submit");
      router.push("/my-works?submitted=1");
      router.refresh();
    }
    catch {
      setError(t("submitError"));
    }
    finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return <form className={styles.form} onSubmit={submit}>
    <p className={styles.muted}>
      {t("reviewHint")}
    </p>
    <fieldset disabled={busy} className={styles.fields}>
      <ImageUpload disabled={busy} onUnauthorized={() => router.push("/login?returnTo=/publish")} onChange={(next, blocked) => { setUploads(next); setUploadBlocked(blocked); }} />
      <label htmlFor="work-title">
        {t("title")}
      </label>
      <input id="work-title" name="title" required maxLength={200} />
      <label htmlFor="work-prompt">
        {t("prompt")}
      </label>
      <textarea id="work-prompt" name="prompt_text" required maxLength={20000} rows={7} />
      <label htmlFor="work-description">
        {t("description")}
      </label>
      <textarea id="work-description" name="description" maxLength={5000} rows={3} />
      <div className={styles.choices}>
        <div>
          <p>
            {t("category")}
          </p>
          <Choice
            label={t("category")}
            options={categories.filter(item => item.key !== "all")}
            value={category}
            onChange={setCategory}
          />
        </div>
        <div>
          <p>
            {t("model")}
          </p>
          <Choice
            label={t("model")}
            options={models}
            value={model}
            onChange={value => {
              setModel(value);
              setVersion("");
            }}
          />
        </div>
      </div>
      {canAddVersion && <>
        <label htmlFor="work-model-version">
          {t("version")}
        </label>
        <input
          id="work-model-version"
          value={version}
          maxLength={Math.max(0, 49 - model.length)}
          placeholder="V6.1"
          aria-describedby="version-hint"
          onChange={event => setVersion(event.target.value)}
        />
        <p id="version-hint" className={styles.muted}>
          {t("versionHint")}
        </p>
      </>}
    </fieldset>
    {error && <p role="alert" className={styles.error}>
      {error}
    </p>}
    <button
      className={styles.primary}
      disabled={busy || uploadBlocked || !models.length || !categories.length}
      type="submit"
    >
      {busy ? t("processing") : t("submit")}
    </button>
  </form>;
}
