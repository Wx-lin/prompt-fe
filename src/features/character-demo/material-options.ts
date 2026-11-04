import type { ClothingMaterial } from "./clothing-options";

type MaterialCategory = "角色" | "发型" | "表情";
const make = (category: MaterialCategory, name: string, file: string): ClothingMaterial => ({
  name,
  image: `/character-demo/${category === "角色" ? "characters" : category === "发型" ? "hair" : "expressions"}/${file}.png`,
  prompt: category === "角色"
    ? `以${name}为角色参考，创建角色设定，保持角色在各视角中的特征一致。`
    : category === "发型"
      ? `把角色发型改为${name}，保持人物五官、表情、服装、姿势和布局不变。`
      : `把角色表情改为${name}，保持人物五官、发型、服装、姿势和布局不变。`,
});
export const characterMaterials = [
  make("角色", "都市女性", "character_01_urban_woman"), make("角色", "都市男性", "character_02_urban_man"),
  make("角色", "成熟女性", "character_03_elegant_woman"), make("角色", "成熟男性", "character_04_mature_man"),
  make("角色", "短发女性", "character_05_short_hair_woman"), make("角色", "中长发男性", "character_06_long_hair_man"),
  make("角色", "卷发女性", "character_07_female_character"), make("角色", "短发男性", "character_08_male_character"),
  make("角色", "棕发女性", "character_09_female_character"), make("角色", "棕发男性", "character_10_male_character"),
] as const;
export const hairMaterials = [
  make("发型", "齐肩短发", "hair_01_bob"), make("发型", "长直发", "hair_02_long_straight"),
  make("发型", "微卷长发", "hair_03_soft_waves"), make("发型", "高马尾", "hair_04_ponytail"),
  make("发型", "低盘发", "hair_05_bun"), make("发型", "利落短发", "hair_06_pixie"),
  make("发型", "刘海长发", "hair_07_bangs"), make("发型", "侧编发", "hair_08_braid"),
  make("发型", "纹理短发", "hair_09_mens_short"), make("发型", "侧分中短发", "hair_10_mens_medium"),
] as const;
export const expressionMaterials = [
  make("表情", "自然", "expression_01_neutral"), make("表情", "微笑", "expression_02_smile"),
  make("表情", "开心", "expression_03_happy"), make("表情", "难过", "expression_04_sad"),
  make("表情", "生气", "expression_05_angry"), make("表情", "惊讶", "expression_06_surprised"),
  make("表情", "紧张", "expression_07_anxious"), make("表情", "思考", "expression_08_thoughtful"),
  make("表情", "自信", "expression_09_confident"), make("表情", "疲惫", "expression_10_tired"),
] as const;
