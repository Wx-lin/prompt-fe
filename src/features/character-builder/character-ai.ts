import { createInitialValues, GROUPS, UNSPECIFIED, type CharacterValues } from "./character-data";

const characterGroups = new Set(["basic", "role", "face", "hair", "body", "skin", "makeup", "clothing", "expression"]);
const characterFields = new Map(GROUPS.filter((group) => characterGroups.has(group.id)).flatMap((group) => group.fields.filter((field) => field.type !== "toggle").map((field) => [field.id, field] as const)));

export function applyCharacterInterpretation(current: CharacterValues, input: unknown, options: { clearDefaults: boolean; touched: ReadonlySet<string> }): CharacterValues {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid interpretation");
  const raw = input as Record<string, unknown>;
  if (!raw.values || typeof raw.values !== "object" || Array.isArray(raw.values) || typeof raw.unmapped !== "string" || raw.unmapped.length > 2000) throw new Error("Invalid interpretation");
  const updates: CharacterValues = {};
  for (const [key, value] of Object.entries(raw.values)) {
    const field = characterFields.get(key);
    const limit = key === "name" ? 80 : field?.type === "textarea" || field?.type === "tags" ? 2000 : 500;
    if (key === "aiDetails" || !field || typeof value !== "string" || !value.trim() || value.length > limit) throw new Error("Invalid interpretation");
    updates[key] = value;
  }
  const defaults = createInitialValues();
  const cleared = options.clearDefaults ? Object.fromEntries([...characterFields.keys()].filter((key) => key !== "name" && !options.touched.has(key) && current[key] === defaults[key]).map((key) => [key, UNSPECIFIED])) : {};
  const result = { ...current, ...cleared, ...updates };
  result.aiDetails = raw.unmapped.trim() || UNSPECIFIED;
  return result;
}
