import { DRAFT_KEY } from "./character-presets";

const LOGIN_RESUME_KEY = "aigc-character-login-resume-v1";
const FRESH_START_KEY = "aigc-character-fresh-start-v1";

export function characterDraftKey(search: string): string {
  const params = new URLSearchParams(search);
  const asset = params.get("asset"), preset = params.get("preset");
  return asset ? `${DRAFT_KEY}:asset:${asset}` : preset ? `${DRAFT_KEY}:preset:${preset}` : params.get("new") === "1" ? `${DRAFT_KEY}:new` : DRAFT_KEY;
}

export function markCharacterFreshStart(search: string) {
  try { sessionStorage.setItem(FRESH_START_KEY, characterDraftKey(search)); } catch { /* Editor will report storage errors. */ }
}

export function consumeCharacterFreshStart(key: string): boolean {
  try {
    const matches = sessionStorage.getItem(FRESH_START_KEY) === key;
    if (matches) sessionStorage.removeItem(FRESH_START_KEY);
    return matches;
  } catch { return false; }
}

export function markCharacterLoginResume() {
  try { sessionStorage.setItem(LOGIN_RESUME_KEY, characterDraftKey(window.location.search)); } catch { /* Storage errors are reported by the editor. */ }
}

export function consumeCharacterLoginResume(key: string): boolean {
  try {
    const matches = sessionStorage.getItem(LOGIN_RESUME_KEY) === key;
    if (matches) sessionStorage.removeItem(LOGIN_RESUME_KEY);
    return matches;
  } catch { return false; }
}
