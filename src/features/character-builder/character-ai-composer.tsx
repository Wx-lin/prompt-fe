"use client";

import { ArrowRight, GripVertical, Sparkles } from "lucide-react";
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import styles from "./character-ai-composer.module.css";

type Position = Readonly<{ x: number; y: number }>;
type Props = {
  en: boolean;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  busy?: boolean;
  error?: string;
};

function boundedPosition(element: HTMLElement, position: Position): Position {
  const parent = element.parentElement;
  if (!parent) return position;
  const container = parent.getBoundingClientRect();
  const box = element.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(position.x, container.width - box.width)),
    y: Math.max(0, Math.min(position.y, container.height - box.height)),
  };
}

function currentPosition(element: HTMLElement): Position {
  const parent = element.parentElement?.getBoundingClientRect();
  const box = element.getBoundingClientRect();
  return { x: box.left - (parent?.left ?? 0), y: box.top - (parent?.top ?? 0) };
}

export function CharacterAiComposer({ en, value, onChange, onSubmit, busy = false, error = "" }: Props) {
  const composer = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const drag = useRef<{ pointer: number; startX: number; startY: number; origin: Position } | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const label = en ? "Describe a character for AI" : "描述角色，AI 快速创建";
  const canSubmit = Boolean(value.trim()) && !busy;

  useLayoutEffect(() => {
    const textarea = input.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 22), 110)}px`;
    if (composer.current && position) {
      const next = boundedPosition(composer.current, position);
      if (next.x !== position.x || next.y !== position.y) setPosition(next);
    }
  }, [value, position, error]);

  useLayoutEffect(() => {
    const element = composer.current;
    if (!element?.parentElement || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      setPosition((previous) => {
        if (!previous) return previous;
        const next = boundedPosition(element, previous);
        return next.x === previous.x && next.y === previous.y ? previous : next;
      });
    });
    observer.observe(element.parentElement);
    return () => observer.disconnect();
  }, []);

  function submit() {
    if (canSubmit) onSubmit();
  }

  function startDrag(event: PointerEvent<HTMLButtonElement>) {
    if (!composer.current || event.button !== 0) return;
    drag.current = { pointer: event.pointerId, startX: event.clientX, startY: event.clientY, origin: currentPosition(composer.current) };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    if (!composer.current || !drag.current || drag.current.pointer !== event.pointerId) return;
    const { origin, startX, startY } = drag.current;
    setPosition(boundedPosition(composer.current, { x: origin.x + event.clientX - startX, y: origin.y + event.clientY - startY }));
  }

  function moveWithKeyboard(event: KeyboardEvent<HTMLButtonElement>) {
    const movements: Record<string, Position> = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } };
    const movement = movements[event.key];
    if (!movement || !composer.current) return;
    event.preventDefault();
    const origin = position ?? currentPosition(composer.current);
    const step = event.shiftKey ? 40 : 10;
    setPosition(boundedPosition(composer.current, { x: origin.x + movement.x * step, y: origin.y + movement.y * step }));
  }

  return <form ref={composer} className={styles.composer} style={position ? { left: position.x, top: position.y, bottom: "auto", transform: "none" } : undefined} onSubmit={(event) => { event.preventDefault(); submit(); }}>
    <button className={styles.handle} type="button" aria-label={en ? "Move input with arrow keys" : "移动输入框，可使用方向键"} title={en ? "Drag to move" : "拖动调整位置"} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onKeyDown={moveWithKeyboard}><GripVertical size={18} aria-hidden="true" /></button>
    <Sparkles size={16} className={styles.sparkle} aria-hidden="true" />
    <div className={styles.field}>
      <textarea ref={input} rows={1} maxLength={1000} value={value} disabled={busy} aria-label={label} placeholder={label} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); } }} />
      {error && <span role="alert" className={styles.error}>{error}</span>}
    </div>
    <button className={styles.send} type="submit" aria-label={busy ? (en ? "Generating" : "生成中") : (en ? "Generate character" : "生成角色")} title={en ? "Generate character" : "生成角色"} disabled={!canSubmit}><ArrowRight size={17} aria-hidden="true" /></button>
  </form>;
}
