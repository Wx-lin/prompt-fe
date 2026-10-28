"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "@/i18n/navigation";
import { LoginPage } from "@/features/auth/components/login-page";
import { createConversationWorkflow, type ConversationState, type ConversationWorkflow } from "../lib/workflow";

type ContextValue = {
  state: ConversationState; workflow: ConversationWorkflow; syncIdentity: (identity: string | null) => void;
  guard: (action: () => void) => void; pendingAction: boolean; discard: () => void; keep: () => void;
};
const Context = createContext<ContextValue | null>(null);

/** Lives above query-keyed Suspense so gallery filters cannot discard a private draft. */
export function CreationProvider({ children }: { children: ReactNode }) {
  const [workflow] = useState(() => createConversationWorkflow());
  const state = useSyncExternalStore(workflow.subscribe, workflow.getSnapshot, workflow.getSnapshot);
  const [login, setLogin] = useState(false);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const authEpoch = useRef(0);
  const identity = useRef<string | null>(null);
  const mounted = useRef(false);
  const router = useRouter();
  const syncIdentity = useCallback((next: string | null) => {
    if (identity.current !== next) { authEpoch.current += 1; identity.current = next; setPending(null); }
    workflow.setIdentity(next);
  }, [workflow]);
  const guard = useCallback((action: () => void) => {
    if (workflow.hasUnsavedEdit()) { workflow.setExpanded(true); setPending(() => action); }
    else action();
  }, [workflow]);
  useEffect(() => {
    workflow.setOnUnauthorized(() => { authEpoch.current += 1; identity.current = null; setPending(null); setLogin(true); });
  }, [workflow]);
  useEffect(() => {
    mounted.current = true; workflow.setEnabled(true);
    const beforeUnload = (event: BeforeUnloadEvent) => { if (workflow.hasUnsavedEdit()) { event.preventDefault(); event.returnValue = ""; } };
    const beforeNavigate = (event: MouseEvent) => {
      if (!workflow.hasUnsavedEdit() || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement) || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return;
      let target: URL;
      try { target = new URL(anchor.href); } catch { return; }
      if (!["http:", "https:"].includes(target.protocol) || target.origin !== window.location.origin || target.pathname === window.location.pathname) return;
      event.preventDefault(); event.stopPropagation();
      const href = anchor.href;
      // Replay the original Link only after discard, preserving locale cookies and its navigation options.
      guard(() => {
        if (anchor.isConnected && anchor.href === href && !anchor.hasAttribute("download") && (!anchor.target || anchor.target === "_self")) anchor.click();
      });
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", beforeNavigate, true);
    return () => {
      mounted.current = false; authEpoch.current += 1; workflow.setEnabled(false);
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", beforeNavigate, true);
      queueMicrotask(() => { if (!mounted.current) workflow.destroy(); });
    };
  }, [guard, workflow]);
  const authenticated = useCallback(async () => {
    const epoch = ++authEpoch.current;
    const response = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store", redirect: "error" });
    const value: unknown = response.ok ? await response.json() : null;
    if (epoch !== authEpoch.current) return;
    if (!value || typeof value !== "object" || !("id" in value) || typeof value.id !== "string") throw new Error("session_unavailable");
    syncIdentity(value.id); setLogin(false); router.refresh(); await workflow.resumeIntent();
  }, [router, syncIdentity, workflow]);
  function discard() {
    if (workflow.getSnapshot().saving) return;
    const action = pending; setPending(null); workflow.cancelEdit(); action?.();
  }
  return <Context.Provider value={{ state, workflow, syncIdentity, guard, pendingAction: pending !== null, discard, keep: () => setPending(null) }}>
    {children}
    {login && <LoginPage onAuthenticated={authenticated} onClose={() => { authEpoch.current += 1; workflow.cancelLogin(); setLogin(false); }} />}
  </Context.Provider>;
}

export function useCreation() {
  const value = useContext(Context);
  if (!value) throw new Error("CreationProvider is required");
  return value;
}
