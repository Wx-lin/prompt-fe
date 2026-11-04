"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CharacterSettings = Readonly<{ role: string; hair: string; clothing: string; clothingPart: "上装" | "服装"; bottom: string; hosiery: string; expression: string }>;
type Generated = Readonly<{ id: string; image: string; role: string; signature: string }>;
const API = "http://127.0.0.1:3139/generate";

export function useLiveGeneration() {
  const [settings, setSettings] = useState<CharacterSettings>({ role: "都市女性", hair: "齐肩短发", clothing: "白色 T 恤", clothingPart: "上装", bottom: "", hosiery: "", expression: "自然" });
  const [result, setResult] = useState<Generated | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [auto, setAuto] = useState(false);
  const pending = useRef(false);
  const attempted = useRef("");
  const generate = useCallback(async (choice: CharacterSettings) => {
    if (pending.current) return;
    pending.current = true;
    attempted.current = JSON.stringify(choice);
    setBusy(true);
    setError("");
    try {
      const previous = result?.role === choice.role ? result.id : undefined;
      const clothing = [choice.clothing, choice.bottom, choice.hosiery].filter(Boolean).join("，搭配");
      const response = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: choice.role, hair: choice.hair, clothing, expression: choice.expression, ...(previous ? { previous_id: previous } : {}) }) });
      const data: unknown = await response.json();
      if (!response.ok) {
        if (response.status === 404) { setResult(null); setAuto(false); }
        const message = typeof data === "object" && data !== null && "error" in data && typeof data.error === "string" ? data.error : "生成失败，请稍后重试";
        throw new Error(message);
      }
      if (typeof data !== "object" || data === null || !("id" in data) || typeof data.id !== "string" || !("image" in data) || typeof data.image !== "string" || !data.image.startsWith("data:image/png;base64,")) throw new Error("生成结果格式异常，请重试");
      setResult({ id: data.id, image: data.image, role: choice.role, signature: JSON.stringify(choice) });
    } catch (e) {
      setError(e instanceof TypeError ? "无法连接本地生图服务，请确认服务已启动。" : e instanceof Error ? e.message : "生成失败，请稍后重试。");
    } finally { pending.current = false; setBusy(false); }
  }, [result]);
  useEffect(() => {
    if (!auto || !result || busy || attempted.current === JSON.stringify(settings)) return;
    const timer = window.setTimeout(() => { void generate(settings); }, 800);
    return () => window.clearTimeout(timer);
  }, [auto, result, busy, settings, generate]);
  const update = (category: "角色" | "发型" | "服装" | "表情", value: string, part?: "服装" | "上装" | "下装" | "丝袜") => {
    if (category === "服装") {
      setSettings((previous) => {
        if (part === "丝袜") return { ...previous, hosiery: value };
        if (part === "下装") return { ...previous, bottom: value, clothing: previous.clothingPart === "服装" ? "" : previous.clothing, clothingPart: "上装" };
        if (part === "上装") return { ...previous, clothing: value, clothingPart: "上装" };
        return { ...previous, clothing: value, clothingPart: "服装", bottom: "" };
      });
      return;
    }
    const key = { "角色": "role", "发型": "hair", "表情": "expression" } as const;
    setSettings((previous) => ({ ...previous, [key[category]]: value }));
  };
  const clear = () => { setResult(null); setError(""); attempted.current = ""; };
  return { settings, result, busy, error, auto, setAuto, update, clear, generate: () => generate(settings) };
}
