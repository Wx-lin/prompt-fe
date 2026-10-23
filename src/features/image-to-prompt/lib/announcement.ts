export const ANNOUNCEMENT_END = Date.parse("2026-11-07T00:00:00+08:00");
export const ANNOUNCEMENT_STORAGE_KEY = "aigc:feature:image-to-prompt:v1:dismissed";
const DISMISS_EVENT = "aigc:image-prompt-announcement-dismissed";
type AnnouncementState = "unavailable" | "active" | "dismissed" | "ended";
let dismissedInSession = false;

export function isAnnouncementActive(now: number = Date.now()): boolean {
  return now < ANNOUNCEMENT_END;
}

export function getServerAnnouncementSnapshot(): AnnouncementState { return "unavailable"; }

export function getAnnouncementSnapshot(): AnnouncementState {
  if (typeof window === "undefined") return "unavailable";
  if (!isAnnouncementActive()) return "ended";
  if (dismissedInSession) return "dismissed";
  try {
    if (window.localStorage.getItem(ANNOUNCEMENT_STORAGE_KEY) === "1") return "dismissed";
  } catch { /* Storage is optional; the current SPA still remembers dismissal. */ }
  return "active";
}

export function dismissAnnouncement(): void {
  if (typeof window === "undefined") return;
  dismissedInSession = true;
  try { window.localStorage.setItem(ANNOUNCEMENT_STORAGE_KEY, "1"); }
  catch { /* Private browsing must not prevent closing an announcement. */ }
  window.dispatchEvent(new Event(DISMISS_EVENT));
}

export function subscribeAnnouncement(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const storageChange = (event: StorageEvent) => {
    if (event.key !== null && event.key !== ANNOUNCEMENT_STORAGE_KEY) return;
    if (event.newValue === "1") dismissedInSession = true;
    listener();
  };
  window.addEventListener("storage", storageChange);
  window.addEventListener(DISMISS_EVENT, listener);
  const remaining = ANNOUNCEMENT_END - Date.now();
  const timer = remaining > 0 ? window.setTimeout(listener, Math.min(remaining, 2_147_483_647)) : undefined;
  return () => {
    window.removeEventListener("storage", storageChange);
    window.removeEventListener(DISMISS_EVENT, listener);
    window.clearTimeout(timer);
  };
}
