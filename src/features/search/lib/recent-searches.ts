const STORAGE_KEY = "aigc-recent-searches";
const CHANGE_EVENT = "aigc-recent-searches-change";
let cachedStorageValue: string | null | undefined;
let cachedSearches: string[] = [];

export function readRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const storageValue = window.localStorage.getItem(STORAGE_KEY);
    if (storageValue === cachedStorageValue) return cachedSearches;
    const saved: unknown = JSON.parse(storageValue ?? "[]");
    cachedStorageValue = storageValue;
    cachedSearches = Array.isArray(saved) ? saved.filter((item): item is string => typeof item === "string") : [];
    return cachedSearches;
  } catch {
    return [];
  }
}

export function saveRecentSearch(term: string): string[] {
  const normalized = term.trim();
  if (!normalized || typeof window === "undefined") return readRecentSearches();
  const next = [normalized, ...readRecentSearches().filter((item) => item !== normalized)].slice(0, 8);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    cachedStorageValue = JSON.stringify(next);
    cachedSearches = next;
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // Search still works when browser storage is unavailable.
  }
  return next;
}

export function clearRecentSearches(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    cachedStorageValue = null;
    cachedSearches = [];
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // Clearing local-only history is best effort.
  }
}

export function subscribeToRecentSearches(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}
