import { YOUTH_OUTFIT_GROUPS } from "./character-youth-outfits";

/** Curated outfit presets. Sprite cells are ordered left-to-right, top-to-bottom. */
export const OUTFIT_FILTERS = ["现代", "古风", "仙侠", "民国", "科幻", "礼服", "民族"] as const;
export type OutfitFilter = typeof OUTFIT_FILTERS[number];
export const OUTFIT_FILTER_ENGLISH: Readonly<Record<OutfitFilter, string>> = {
  现代: "Modern", 古风: "Traditional", 仙侠: "Xianxia", 民国: "Republican", 科幻: "Sci-fi", 礼服: "Formal", 民族: "Ethnic-inspired",
};

type Parts = readonly [string, string, string];
type Seed = readonly [string, string, Parts];
export type Outfit = Readonly<{
  id: string; name: string; en: string; style: OutfitFilter; category: string;
  description: string; parts: Parts;
  image: Readonly<{ src: string; columns: number; index: number }>;
}>;

const ORIGINAL: readonly Outfit[] = [
  { id: "modern-01", name: "日常便装", en: "Everyday casual", style: "现代", category: "日常", description: "灰色短袖T恤，蓝色直筒牛仔裤，白色运动鞋", parts: ["灰色短袖T恤", "蓝色直筒牛仔裤", "白色运动鞋"], image: { src: "/character-outfits/modern-01.png", columns: 1, index: 0 } },
  { id: "modern-02", name: "经典西装", en: "Classic suit", style: "现代", category: "日常", description: "黑色西装外套，白色内搭，黑色西裤，黑色皮鞋", parts: ["黑色西装外套和白色内搭", "黑色西裤", "黑色皮鞋"], image: { src: "/character-outfits/modern-02.png", columns: 1, index: 0 } },
  { id: "modern-03", name: "温柔休闲", en: "Soft casual", style: "现代", category: "日常", description: "米白色针织上衣，米色阔腿裤，白鞋，棕色包", parts: ["米白色针织上衣", "米色阔腿裤", "白鞋"], image: { src: "/character-outfits/modern-03.png", columns: 1, index: 0 } },
  { id: "modern-04", name: "活力运动", en: "Activewear", style: "现代", category: "日常", description: "浅灰色连帽运动上衣，深色运动长裤，白色运动鞋", parts: ["浅灰色连帽运动上衣", "深色运动长裤", "白色运动鞋"], image: { src: "/character-outfits/modern-04.png", columns: 1, index: 0 } },
  { id: "modern-05", name: "学院套装", en: "Preppy outfit", style: "现代", category: "日常", description: "深蓝校服西装，白衬衫和红领带，百褶裙，黑袜皮鞋", parts: ["深蓝校服西装、白衬衫和红领带", "百褶裙和黑袜", "黑色皮鞋"], image: { src: "/character-outfits/modern-05.png", columns: 1, index: 0 } },
  { id: "modern-06", name: "都市夹克", en: "City jacket", style: "现代", category: "日常", description: "卡其色夹克，黑衬衫，黑色长裤，黑鞋", parts: ["卡其色夹克和黑衬衫", "黑色长裤", "黑鞋"], image: { src: "/character-outfits/modern-06.png", columns: 1, index: 0 } },
];

function group(key: string, style: OutfitFilter, category: string, columns: number, seeds: readonly Seed[]): Outfit[] {
  return seeds.map(([name, en, parts], index) => ({
    id: `${key}-${index + 1}`, name, en, style, category, parts,
    description: parts.join("，"), image: { src: `/character-outfits/catalog-${key}.png`, columns, index },
  }));
}

const MODERN: readonly Seed[] = [
  ["白衬衫牛仔", "White shirt and jeans", ["白色衬衫", "蓝色牛仔裤", "白色运动鞋"]],
  ["牛仔夹克", "Denim jacket", ["蓝色牛仔夹克和白色T恤", "卡其色长裤", "白色运动鞋"]],
  ["卡其风衣", "Khaki trench coat", ["驼色风衣和浅色内搭", "米白色长裤", "棕色鞋"]],
  ["黑色针织", "Black knitwear", ["黑色针织上衣", "灰色长裤", "黑色鞋"]],
  ["学院衬衫裙", "Preppy shirt dress", ["白色学院风衬衫", "浅蓝色百褶裙", "黑色皮鞋"]],
  ["机能飞行夹克", "Utility bomber jacket", ["绿色机能飞行夹克", "黑色工装裤", "黑色短靴"]],
];
const ANCIENT: readonly Seed[] = [
  ["粉色汉服", "Pink hanfu", ["粉色汉服上衣", "粉色飘逸长裙", "粉色布鞋"]],
  ["青色长袍", "Teal robe", ["蓝青色古风长袍", "蓝青色长袍下摆", "黑色布鞋"]],
  ["红色唐风", "Red Tang-inspired outfit", ["红色唐风上衣", "红色唐风长裙", "红色鞋"]],
  ["绿色宋风", "Green Song-inspired outfit", ["浅绿色宋风上衣", "浅绿色长裙", "浅色鞋"]],
  ["玄色武服", "Black martial attire", ["玄色交领武服", "玄色束腿长裤", "黑色长靴"]],
  ["白衣书生", "White scholar's robe", ["白色书生长衫", "白色长袍下摆", "白色布鞋"]],
  ["紫色襦裙", "Purple ruqun", ["紫色襦裙上衣", "紫色长裙", "紫色鞋"]],
  ["绛色铠甲", "Crimson armor", ["绛红色古风铠甲", "红色战袍下摆", "黑色长靴"]],
];
const XIANXIA: readonly Seed[] = [
  ["白衣仙子", "White fairy robes", ["白色仙侠长衫和青色腰带", "白色飘逸长裙", "白色布鞋"]],
  ["青衣修士", "Azure cultivator", ["浅蓝色仙侠长袍", "浅蓝色长袍下摆", "黑色布靴"]],
  ["青绿医者", "Jade healer", ["青绿色仙侠医者长衫", "青绿色长袍下摆", "青色布鞋"]],
  ["玄衣魔尊", "Dark fantasy lord", ["黑紫色仙侠长袍", "黑紫色长袍下摆", "黑色长靴"]],
  ["紫霞仙裙", "Violet fairy dress", ["紫色仙侠上衣", "紫色飘逸长裙", "浅色绣鞋"]],
  ["金纹仙袍", "Gold-trimmed celestial robe", ["白色金纹仙侠长袍", "白色金纹长袍下摆", "白色布鞋"]],
];
const REPUBLIC: readonly Seed[] = [
  ["红色旗袍", "Red qipao", ["红色旗袍上身", "红色旗袍裙摆", "黑色低跟鞋"]],
  ["蓝色旗袍", "Blue qipao", ["蓝色旗袍上身", "蓝色旗袍裙摆", "深色鞋"]],
  ["黑色长衫", "Black changshan", ["黑色民国长衫", "黑色长衫下摆", "黑色布鞋"]],
  ["灰色学生装", "Gray student uniform", ["灰色民国学生上衣", "深色学生裙", "黑色皮鞋"]],
  ["复古风衣", "Vintage trench coat", ["米色复古风衣和衬衫", "复古长裙", "棕色鞋"]],
  ["马甲西装", "Waistcoat suit", ["白衬衫和棕色复古马甲", "棕色西裤", "黑色皮鞋"]],
];
const SCIFI: readonly Seed[] = [
  ["白色探索服", "White explorer suit", ["白色科技探索上衣", "白色机能长裤", "白色机能靴"]],
  ["黑色战术服", "Black tactical suit", ["黑色科技战术夹克", "黑色工装裤", "黑色战术靴"]],
  ["蓝色飞行服", "Blue flight suit", ["蓝色未来飞行上衣", "蓝色飞行长裤", "深色靴子"]],
  ["银色宇航服", "Silver spacesuit", ["银色宇航上衣", "银色宇航裤", "银色宇航靴"]],
  ["紫色科技长衣", "Purple tech coat", ["紫色科技感长衣", "深色机能长裤", "深色机能靴"]],
  ["橙色机修服", "Orange mechanic suit", ["橙色未来机修上衣", "橙色机修长裤", "深色工装靴"]],
];
const FORMAL: readonly Seed[] = [
  ["黑色礼服西装", "Black formal suit", ["黑色礼服西装和白色衬衫", "黑色礼服西裤", "黑色皮鞋"]],
  ["象牙白西装", "Ivory suit", ["象牙白西装外套和白色衬衫", "象牙白西裤", "白色皮鞋"]],
  ["红色晚礼服", "Red evening gown", ["红色晚礼服上身", "红色晚礼服长裙", "红色高跟鞋"]],
  ["深蓝晚礼服", "Navy evening gown", ["深蓝晚礼服上身", "深蓝晚礼服长裙", "深色高跟鞋"]],
  ["香槟礼裙", "Champagne gown", ["香槟色礼服上身", "香槟色礼服长裙", "浅色高跟鞋"]],
  ["黑色晚礼服", "Black evening gown", ["黑色晚礼服上身", "黑色晚礼服长裙", "黑色高跟鞋"]],
];
const ETHNIC: readonly Seed[] = [
  ["苗族风格", "Miao-inspired attire", ["苗族风格靛蓝绣花上衣和银饰", "苗族风格绣花裙", "靛蓝色鞋"]],
  ["藏族风格", "Tibetan-inspired attire", ["藏族风格长袍上身", "藏族风格长袍和织物围裙", "藏式长靴"]],
  ["蒙古族风格", "Mongolian-inspired attire", ["蒙古族风格蓝色长袍和腰带", "蒙古族风格长袍下摆", "蒙古风格长靴"]],
  ["傣族风格", "Dai-inspired attire", ["傣族风格浅色修身上衣", "傣族风格长筒裙", "浅色鞋"]],
  ["彝族风格", "Yi-inspired attire", ["彝族风格深色绣花上衣", "彝族风格裙装", "黑色布鞋"]],
  ["壮族风格", "Zhuang-inspired attire", ["壮族风格靛蓝绣花上衣", "壮族风格长裤", "黑色布鞋"]],
];

export const OUTFITS: readonly Outfit[] = [
  ...ORIGINAL,
  ...group("modern", "现代", "日常", 3, MODERN),
  ...YOUTH_OUTFIT_GROUPS.flatMap(({ key, columns, seeds }) =>
    group(key, "现代", "日常", columns, seeds).map((item, index) => ({
      ...item,
      image: { src: `/character-outfits/catalog-${key}-${String(index + 1).padStart(2, "0")}.webp`, columns: 1, index: 0 },
    })),
  ),
  ...group("ancient", "古风", "古装", 4, ANCIENT),
  ...group("xianxia", "仙侠", "幻想服装", 3, XIANXIA),
  ...group("republic", "民国", "日常", 3, REPUBLIC),
  ...group("scifi", "科幻", "幻想服装", 3, SCIFI),
  ...group("formal", "礼服", "礼服", 3, FORMAL),
  ...group("ethnic", "民族", "传统服饰", 3, ETHNIC),
];

export function findOutfit(values: Readonly<Record<string, string>>): Outfit | undefined {
  return OUTFITS.find((item) => item.parts[0] === values.top && item.parts[1] === values.bottom && item.parts[2] === values.shoes);
}
