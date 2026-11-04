import { createInitialValues, UNSPECIFIED, type CharacterValues } from "@/features/character-builder/character-data";
import type { CharacterPreset } from "@/features/character-builder/character-presets";
import { DRAMA_GROUPS } from "./drama-characters";

export type OfficialCharacter = CharacterPreset & Readonly<{
  id: string;
  englishName: string;
  image: string;
  gender: "female" | "male";
  style: "modern" | "ancient" | "scifi";
}>;

function official(id: string, name: string, englishName: string, image: string, gender: OfficialCharacter["gender"], style: OfficialCharacter["style"], values: CharacterValues): OfficialCharacter {
  return { id, name, englishName, image, gender, style, template: "basic", model: "通用", values: { ...createInitialValues(), ...values } };
}

export const OFFICIAL_CHARACTERS: readonly OfficialCharacter[] = [
  official("urban-woman", "都市女生", "City woman", "/character-outfits/stage-transparent.png", "female", "modern", { name: "都市女生", gender: "女性", age: "25岁", regionalStyle: "现代都市", genre: "都市", hairLength: "齐肩发", hairStyle: "直发", clothingCategory: "日常", top: "灰色短袖T恤", bottom: "蓝色直筒牛仔裤", shoes: "白色运动鞋", clothingStyle: "休闲", clothingColor: "灰色" }),
  official("urban-man", "阳光青年", "Easygoing young man", "/character-library/urban-man.png", "male", "modern", { name: "阳光青年", gender: "男性", age: "25岁", regionalStyle: "现代都市", genre: "都市", hairLength: "短发", hairStyle: "短碎发", clothingCategory: "日常", top: "米白色针织上衣", bottom: "米色休闲长裤", shoes: "白色运动鞋", clothingStyle: "休闲", clothingColor: "米色" }),
  official("professional-woman", "职场精英", "Business professional", "/character-library/professional-woman.png", "female", "modern", { name: "职场精英", gender: "女性", age: "30岁", regionalStyle: "现代都市", genre: "都市", hairLength: "长发", hairStyle: "波浪发", clothingCategory: "职业装", top: "黑色西装外套和白衬衫", bottom: "黑色西裤", shoes: "黑色皮鞋", clothingStyle: "商务", clothingColor: "黑色" }),
  official("ancient-man", "古风侠客", "Ancient wanderer", "/character-library/ancient-man.png", "male", "ancient", { name: "古风侠客", gender: "男性", age: "28岁", regionalStyle: "东方古代", genre: "古装", hairLength: "长发", hairStyle: "马尾", clothingCategory: "古装", top: "黑色古风长袍", bottom: "黑色长裤", shoes: "黑色靴子", clothingStyle: "古典", clothingColor: "黑色" }),
  official("scifi-woman", "科幻旅者", "Sci-fi explorer", "/character-library/scifi-woman.png", "female", "scifi", { name: "科幻旅者", gender: "女性", age: "28岁", regionalStyle: "未来都市", genre: "科幻", hairLength: "长发", hairStyle: "马尾", clothingCategory: "幻想服装", top: "浅灰色机能夹克", bottom: "浅灰色工装裤", shoes: "灰色靴子", clothingStyle: "未来感", clothingColor: "灰色" }),
  ...DRAMA_GROUPS.flatMap((group, groupIndex) => group.seeds.map(([name, englishName, gender, age, occupation, hair, top, bottom, shoes, personality], index) => {
    const sheet = String(groupIndex + 1).padStart(2, "0");
    const cell = String(index + 1).padStart(2, "0");
    const category = group.genre === "仙侠" ? "幻想服装" : group.style === "ancient" ? "古装" : /婚纱/.test(top) ? "礼服" : /旗袍/.test(top) ? "传统服饰" : /西装|大褂|制服|厨师服|军装|中山装/.test(top) ? "职业装" : /运动/.test(top) ? "运动装" : "日常";
    const image = `/character-library/drama-${sheet}-${cell}-hd.webp`;
    return official(`drama-${sheet}-${cell}`, name, englishName, image, gender, group.style, {
      name, age: `${age}岁`, gender: gender === "female" ? "女性" : "男性", occupation, personality,
      regionalStyle: group.style === "ancient" ? "东方古代" : group.genre === "民国" ? "民国" : "现代都市", genre: group.genre,
      hairLength: hair.includes("短") ? "短发" : hair.includes("中长") ? "中长发" : "长发",
      hairColor: hair.startsWith("白") ? "白色" : hair.startsWith("灰") ? "灰黑色" : "黑色", hairStyle: hair,
      hairEnds: UNSPECIFIED, fringe: UNSPECIFIED, maturity: age < 25 ? "青年" : age < 40 ? "轻熟" : "成熟",
      height: gender === "male" ? "178cm" : "165cm", makeupStyle: gender === "male" ? UNSPECIFIED : "自然淡妆",
      clothingCategory: category, top, bottom, shoes,
      clothingStyle: group.genre, clothingColor: UNSPECIFIED, material: UNSPECIFIED, exposure: UNSPECIFIED,
      accessories: UNSPECIFIED, jewelry: UNSPECIFIED,
    });
  })),
];

export function getOfficialCharacter(id: string): OfficialCharacter | undefined {
  return OFFICIAL_CHARACTERS.find((character) => character.id === id);
}
