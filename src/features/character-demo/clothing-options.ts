export type ClothingMaterial = Readonly<{ name: string; image: string; prompt: string; part?: "服装" | "上装" | "下装" | "丝袜" }>;
type Part = "服装" | "上装" | "下装" | "丝袜";
const material = (name: string, file: string, part: Part = "服装"): ClothingMaterial => ({
  name, image: `/character-demo/clothing/${file}.png`, part,
  prompt: `${part === "丝袜" ? `为角色穿上${name}，保留现有服装` : `将角色${part}改为${name}，保留其他衣物`}，保持角色五官、发型、体型、姿势和画面布局，所有视角保持一致。`,
});
export const sweetClothes: readonly ClothingMaterial[] = [
  material("粉色百褶短裙", "sweet_01_pink_pleated_skirt", "下装"),
  material("蓝色 A 字短裙", "sweet_02_blue_a_skirt", "下装"),
  material("粉色碎花连衣裙", "sweet_03_floral_dress"),
  material("奶黄色连衣裙", "sweet_04_yellow_dress"),
  material("柠檬黄针织开衫", "sweet_05_cardigan", "上装"),
  material("薄荷绿短外套", "sweet_06_mint_jacket", "上装"),
  material("薰衣草紫瑜伽裤", "sweet_07_lavender_yoga", "下装"),
  material("蜜桃粉瑜伽裤", "sweet_08_peach_yoga", "下装"),
  material("黑色透肤丝袜", "sweet_09_black_tights", "丝袜"),
  material("黑色波点丝袜", "sweet_10_dotted_tights", "丝袜"),
];
export const basicClothes: readonly ClothingMaterial[] = [
  material("白色 T 恤", "clothing_01_tshirt", "上装"), material("深灰西装", "clothing_02_blazer", "上装"),
  material("米色毛衣", "clothing_03_sweater", "上装"), material("深色卫衣", "clothing_04_hoodie", "上装"),
  material("黑色晚礼服", "clothing_05_dress"), material("古风汉服", "clothing_06_hanfu"),
  material("运动外套", "clothing_07_sport", "上装"), material("未来风外套", "clothing_08_cyber", "上装"),
  material("浅蓝衬衫", "clothing_09_shirt", "上装"), material("米色风衣", "clothing_10_trench", "上装"),
];
