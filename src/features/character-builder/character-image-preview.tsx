"use client";

import { useEffect, useRef, useState } from "react";
import { Download, ImagePlus } from "lucide-react";
import { Dialog } from "@base-ui/react/dialog";
import { markCharacterLoginResume } from "./character-draft-scope";
import styles from "./character-builder.module.css";

type GeneratedImage = { src: string; prompt: string; ratio: string };
const SUPPORTED_RATIOS = new Set(["1:1", "3:4", "4:3", "9:16", "16:9", "21:9"]);

export function CharacterImagePreview({ prompt, aspectRatio = "1:1", en, authenticated = true }: { prompt: string; aspectRatio?: string; en: boolean; authenticated?: boolean }) {
  const ratio = SUPPORTED_RATIOS.has(aspectRatio) ? aspectRatio : "1:1";
  const tr = (zh: string, english: string) => en ? english : zh;
  const [busy, setBusy] = useState(false);
  const [image, setImage] = useState<GeneratedImage | null>(null);
  const [error, setError] = useState("");
  const [loginOpen, setLoginOpen] = useState(false);
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => () => { inFlight.current?.abort(); }, []);

  async function generate() {
    if (!authenticated) { setLoginOpen(true); return; }
    if (inFlight.current) return;
    const controller = new AbortController();
    inFlight.current = controller;
    const submittedPrompt = prompt;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/character-preview", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: submittedPrompt, aspect_ratio: ratio }), signal: controller.signal,
      });
      if (response.status === 401) { setLoginOpen(true); return; }
      if (response.status === 429) {
        setError(tr("生成次数已达上限或操作过于频繁，请稍后再试。", "Generation limit reached. Please try again later."));
        return;
      }
      if (!response.ok) throw new Error("request failed");
      const body: unknown = await response.json();
      const payload = body && typeof body === "object" && "data" in body ? body.data : null;
      if (!payload || typeof payload !== "object" || !("image_base64" in payload) || !("mime_type" in payload) || payload.mime_type !== "image/png" || typeof payload.image_base64 !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(payload.image_base64)) throw new Error("invalid image");
      setImage({ src: `data:image/png;base64,${payload.image_base64}`, prompt: submittedPrompt, ratio });
    } catch {
      if (!controller.signal.aborted) setError(tr("暂时无法生成，请稍后重试。", "Unable to generate right now. Please try again."));
    } finally {
      if (inFlight.current === controller) { inFlight.current = null; setBusy(false); }
    }
  }

  return <section className={styles.imagePreview} aria-label={tr("角色图片预览", "Character image preview")}>
    <div className={styles.imagePreviewHeading}><div><h3>{tr("角色图片预览", "Character image preview")}</h3><p>{tr("根据当前配置生成效果图，实际效果以所用模型为准。", "Generate a preview from your settings; results vary by model.")}</p></div></div>
    {image && <div className={styles.imageResult}>
      {/* eslint-disable-next-line @next/next/no-img-element -- generated private data URL */}
      <img src={image.src} alt={tr("角色预览图", "Character preview")} />
      {(image.prompt !== prompt || image.ratio !== ratio) && <p role="status">{tr("配置已更改，此图片为之前的生成结果。", "Settings changed; this image reflects an earlier configuration.")}</p>}
      <a href={image.src} download="character-preview.png"><Download size={16} />{tr("下载图片", "Download image")}</a>
    </div>}
    {!SUPPORTED_RATIOS.has(aspectRatio) && <p className={styles.imageHint}>{tr("当前比例暂不支持预览，将按 1:1 生成。", "This aspect ratio is not supported for previews; 1:1 will be used.")}</p>}
    {error && <p role="alert" className={styles.imageError}>{error}</p>}
    <div className={styles.imagePreviewActions}>
      <button type="button" onClick={() => void generate()} disabled={busy}><ImagePlus size={16} />{busy ? tr("生成中…", "Generating…") : image || error ? tr("重新生成", "Generate again") : tr("生成角色预览图", "Generate character preview")}</button>
      <span>{tr("每次生成会消耗 API 额度", "Each generation consumes API credits")}</span>
    </div>
    {busy && <p className={styles.imageHint} role="status">{tr("正在生成，可能需要一些时间，请稍候。", "Generating your image. This may take a moment.")}</p>}
    <Dialog.Root open={loginOpen} onOpenChange={setLoginOpen}><Dialog.Portal><Dialog.Backdrop className={styles.dialogBackdrop} /><Dialog.Popup className={styles.dialog}><Dialog.Title>{tr("登录后生成角色预览", "Sign in to generate a preview")}</Dialog.Title><Dialog.Description>{tr("登录后即可生成角色预览，当前设定会保留。", "Sign in to generate a preview. Your settings will be kept.")}</Dialog.Description><div><Dialog.Close>{tr("稍后再说", "Not now")}</Dialog.Close><a onClick={markCharacterLoginResume} href={`${en ? "/en" : ""}/login?returnTo=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname + window.location.search : "/character-setting")}`}>{tr("登录", "Sign in")}</a></div></Dialog.Popup></Dialog.Portal></Dialog.Root>
  </section>;
}
