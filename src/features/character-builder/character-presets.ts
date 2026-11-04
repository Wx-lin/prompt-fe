import { GROUPS, MODELS, TEMPLATES, createInitialValues, type CharacterValues, type TemplateId } from "./character-data";
import { isValidNumber, NUMBER_LIMITS } from "./number-limits";

export type CharacterPreset = Readonly<{ name: string; values: CharacterValues; template: TemplateId; model: string }>;
export const PRESET_KEY = "aigc-character-presets-v1";
export const DRAFT_KEY = "aigc-character-draft-v1";
export const MAX_IMPORT_BYTES = 256 * 1024;

function builtIn(name: string, updates: CharacterValues): CharacterPreset {
  return { name, values: { ...createInitialValues(), ...updates }, template: "basic", model: "通用" };
}

export const BUILT_IN_PRESETS: readonly CharacterPreset[] = [
  builtIn("冷静的都市角色", { name: "林岚", age: "28岁", occupation: "建筑师", personality: "冷静，坚韧", clothingCategory: "职业装", top: "西装外套", bottom: "西裤", shoes: "皮鞋", material: "羊毛", exposure: "手部", clothingStyle: "简约通勤" }),
  builtIn("乐观的校园角色", { name: "夏知", age: "20岁", occupation: "大学生", genre: "校园", personality: "活泼，勇敢", temperament: "活泼", presence: "温和", hairLength: "长发", clothingCategory: "日常", top: "白衬衫", bottom: "半身裙", shoes: "帆布鞋", clothingColor: "白色", exposure: "手部，腿部", clothingStyle: "轻松日常", background: "自然场景", scene: "校园", location: "校园" }),
  builtIn("古风行旅角色", { name: "云衡", age: "30岁", gender: "男性", occupation: "旅行者", genre: "古装", regionalStyle: "东方古代", personality: "敏锐，温柔", hairLength: "长发", hairStyle: "马尾", clothingCategory: "古装", top: "汉服上衣", bottom: "长裤", shoes: "布鞋", clothingColor: "棕色", material: "亚麻", exposure: "手部", clothingStyle: "古风长袍", background: "自然场景", scene: "庭院", location: "庭院" }),
  builtIn("未来探索角色", { name: "路遥", age: "32岁", gender: "中性", occupation: "探索员", genre: "科幻", regionalStyle: "未来都市", personality: "自信，理性", hairLength: "短发", hairStyle: "短碎发", fringe: "碎刘海", clothingCategory: "幻想服装", top: "夹克", bottom: "工装裤", shoes: "靴子", material: "科技面料", exposure: "手部", clothingStyle: "功能性外套", background: "自然场景", scene: "未来城市", location: "未来城市" }),
  builtIn("悬疑调查角色", { name: "许宁", age: "35岁", gender: "男性", occupation: "调查员", genre: "悬疑", personality: "冷静，敏锐", hairLength: "短发", hairStyle: "短碎发", fringe: "侧分刘海", clothingCategory: "正装", top: "西装外套", bottom: "西裤", shoes: "皮鞋", clothingColor: "黑色", material: "羊毛", exposure: "手部", clothingStyle: "深色大衣", background: "自然场景", scene: "街道", location: "街道" }),
];

export function parsePreset(input: unknown): CharacterPreset | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  if (typeof raw.name !== "string" || !raw.name.trim() || raw.name.length > 80 || typeof raw.template !== "string" || !TEMPLATES.some((item) => item.id === raw.template) || typeof raw.model !== "string" || !MODELS.some((item) => item === raw.model) || !raw.values || typeof raw.values !== "object" || Array.isArray(raw.values)) return null;
  const values = createInitialValues();
  const fields = new Map(GROUPS.flatMap((group) => group.fields).map((field) => [field.id, field]));
  for (const [key, value] of Object.entries(raw.values)) {
    const field = fields.get(key);
    if (!field || typeof value !== "string" || value.length > 2000 || (field.type === "toggle" && value !== "true" && value !== "false") || (field.id in NUMBER_LIMITS && !isValidNumber(field.id, value))) return null;
    values[key] = value;
  }
  return { name: raw.name.trim(), values, template: raw.template as TemplateId, model: raw.model };
}

export function parseFile(text: string): CharacterPreset | null {
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const document = parsed as Record<string, unknown>;
    if (document.version !== 1) return null;
    return parsePreset(document.preset ?? { name: "导入的角色", template: document.template, model: document.model, values: document.values });
  } catch { return null; }
}

export function readPresets(): CharacterPreset[] {
  try { return readPresetsStrict(); } catch { return []; }
}

export function readPresetsStrict(): CharacterPreset[] {
  const stored = localStorage.getItem(PRESET_KEY);
  if (!stored) return [];
  const parsed: unknown = JSON.parse(stored);
  if (!Array.isArray(parsed)) throw new Error("Invalid preset storage");
  const presets = parsed.map(parsePreset);
  if (presets.some((preset) => preset === null)) throw new Error("Invalid preset storage");
  return presets as CharacterPreset[];
}
