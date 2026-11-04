"use client";

import { useEffect, useRef, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import styles from "./gallery-page.module.css";

const MIN_CHAT = 420;
const MIN_GALLERY = 600;
const STEP = 24;
type Props = { workspace: RefObject<HTMLDivElement | null>; pane: RefObject<HTMLDivElement | null>; label: string };

function syncAria(area: HTMLElement, pane: HTMLElement, handle: HTMLElement) {
  const total = area.getBoundingClientRect().width;
  const width = pane.getBoundingClientRect().width;
  if (!total || width < MIN_CHAT - 1) return;
  handle.setAttribute("aria-valuenow", String(Math.round(width)));
  handle.setAttribute("aria-valuemax", String(Math.round(Math.max(MIN_CHAT, total - MIN_GALLERY))));
  handle.setAttribute("aria-valuetext", `${Math.round(width)} px`);
}

function applyWidth(area: HTMLElement, handle: HTMLElement, width: number) {
  const total = area.getBoundingClientRect().width;
  if (!total) return;
  const maximum = Math.max(MIN_CHAT, total - MIN_GALLERY);
  const value = Math.min(maximum, Math.max(MIN_CHAT, width));
  area.style.setProperty("--chat-width", `${value}px`);
  handle.setAttribute("aria-valuenow", String(Math.round(value)));
  handle.setAttribute("aria-valuemax", String(Math.round(maximum)));
  handle.setAttribute("aria-valuetext", `${Math.round(value)} px`);
}

function beginPointerResize(area: HTMLElement, pane: HTMLElement, handle: HTMLElement, event: PointerEvent<HTMLDivElement>) {
  const startX = event.clientX;
  const startWidth = pane.getBoundingClientRect().width;
  const pointerId = event.pointerId;
  const previousSelect = document.body.style.userSelect;
  const previousCursor = document.body.style.cursor;
  let frame = 0;
  let pending: number | null = null;
  let ended = false;
  area.setAttribute("data-resizing", "true");
  document.body.style.userSelect = "none";
  document.body.style.cursor = "col-resize";
  try { handle.setPointerCapture(pointerId); } catch { /* window listeners remain active */ }
  function move(next: globalThis.PointerEvent) {
    if (next.pointerId !== pointerId) return;
    pending = startWidth + startX - next.clientX;
    if (!frame) frame = requestAnimationFrame(() => {
      frame = 0;
      if (pending !== null) applyWidth(area, handle, pending);
      pending = null;
    });
  }
  function finish() {
    if (ended) return;
    ended = true;
    if (frame) cancelAnimationFrame(frame);
    if (pending !== null) applyWidth(area, handle, pending);
    area.removeAttribute("data-resizing");
    document.body.style.userSelect = previousSelect;
    document.body.style.cursor = previousCursor;
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", finish);
    window.removeEventListener("pointercancel", finish);
    window.removeEventListener("blur", finish);
    handle.removeEventListener("lostpointercapture", finish);
    if (handle.hasPointerCapture?.(pointerId)) handle.releasePointerCapture(pointerId);
  }
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", finish);
  window.addEventListener("pointercancel", finish);
  window.addEventListener("blur", finish);
  handle.addEventListener("lostpointercapture", finish);
  return finish;
}

/** Update CSS directly, so the gallery and conversation do not re-render during dragging. */
export function ChatPaneResizer({ workspace, pane, label }: Props) {
  const handle = useRef<HTMLDivElement>(null);
  const cancel = useRef<(() => void) | null>(null);
  useEffect(() => {
    const area = workspace.current, panel = pane.current, grip = handle.current;
    if (!area || !panel || !grip) return;
    const sync = () => syncAria(area, panel, grip);
    const resize = () => {
      const width = area.style.getPropertyValue("--chat-width");
      if (window.innerWidth >= 1280 && width) applyWidth(area, grip, Number.parseFloat(width));
      sync();
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(sync);
    observer?.observe(panel);
    observer?.observe(area);
    area.addEventListener("transitionend", sync);
    window.addEventListener("resize", resize);
    sync();
    return () => { cancel.current?.(); observer?.disconnect(); area.removeEventListener("transitionend", sync); window.removeEventListener("resize", resize); };
  }, [workspace, pane]);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !workspace.current || !pane.current) return;
    event.preventDefault();
    cancel.current?.();
    cancel.current = beginPointerResize(workspace.current, pane.current, event.currentTarget, event);
  }
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key) || !workspace.current || !pane.current) return;
    event.preventDefault();
    const target = Number.parseFloat(workspace.current.style.getPropertyValue("--chat-width"));
    const width = Number.isFinite(target) ? target : pane.current.getBoundingClientRect().width;
    const total = workspace.current.getBoundingClientRect().width;
    const amount = event.shiftKey ? STEP * 4 : STEP;
    applyWidth(workspace.current, event.currentTarget, event.key === "Home" ? MIN_CHAT : event.key === "End" ? total - MIN_GALLERY : width + (event.key === "ArrowLeft" ? amount : -amount));
  }
  function onFocus() {
    if (workspace.current && pane.current && handle.current) syncAria(workspace.current, pane.current, handle.current);
  }
  return <div ref={handle} role="separator" tabIndex={0} aria-label={label} aria-orientation="vertical" aria-valuemin={MIN_CHAT} aria-valuemax={MIN_CHAT} aria-valuenow={MIN_CHAT} className={styles.splitter} onPointerDown={onPointerDown} onKeyDown={onKeyDown} onFocus={onFocus} />;
}
