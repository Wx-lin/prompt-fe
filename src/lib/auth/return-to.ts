/** Permit only known destinations and their explicitly supported parameters. */
export function safeReturnTo(value: string | null): string {
  if (!value || value.includes("#") || value.includes("\\") || /[\u0000-\u0020\u007f]/.test(value)) return "/";
  const normalized = value.startsWith("/en/") ? value.slice(3) : value;
  if (normalized === "/publish" || normalized === "/my-works" || normalized === "/character-library" || normalized === "/character-setting") return normalized;
  if (normalized === "/character-library?tab=mine") return normalized;
  if (normalized === "/character-setting?new=1") return normalized;
  if (/^\/character-setting\?preset=(?:urban-woman|urban-man|professional-woman|ancient-man|scifi-woman)$/.test(normalized)) return normalized;
  if (/^\/character-setting\?asset=[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalized)) return normalized;
  return "/";
}
