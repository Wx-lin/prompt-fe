import {
  BookOpen, BriefcaseBusiness, Camera, ChefHat, Clapperboard, Code2, Compass,
  Crown, Dumbbell, FireExtinguisher, Flower2, GraduationCap,
  Landmark, Library, Microscope, Music2, Newspaper, Palette, PawPrint, Pill,
  Plane, Rocket, Scale, Search, Shield, Ship, Stethoscope, Store, Sword,
  type LucideIcon,
} from "lucide-react";

// Flag assets are stored locally so they also work on platforms without emoji flags.
export const countryFlagCodes: Readonly<Record<string, string>> = {
  中国: "cn", 日本: "jp", 韩国: "kr", 美国: "us", 英国: "gb", 法国: "fr", 意大利: "it",
};

export const occupationIcons: Readonly<Record<string, LucideIcon>> = {
  学生: GraduationCap, 医生: Stethoscope, 教师: BookOpen, 记者: Newspaper,
  设计师: Palette, 律师: Scale, 警察: Shield, 研究员: Microscope,
  创业者: BriefcaseBusiness, 演员: Clapperboard, 厨师: ChefHat, 探险家: Compass,
  王族: Crown, 骑士: Sword, 侦探: Search, 旅行者: Compass,
  航天工程师: Rocket, 消防员: FireExtinguisher, 摄影师: Camera, 音乐人: Music2,
  舞蹈演员: Music2, 运动员: Dumbbell, 兽医: PawPrint, 园艺师: Flower2,
  程序员: Code2, 考古学家: Landmark, 画家: Palette, 飞行员: Plane,
  船长: Ship, 药师: Pill, 店主: Store, 图书管理员: Library,
};

// Color chips are approximate cues, not the final color of a generated image.
export const extraFieldColors: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  undertone: { 中性: "#c99b82", 暖调: "#cf9a72", 冷调: "#d1a6a1", 橄榄调: "#b1a077" },
  lipMakeup: { 自然: "#be8c80", 裸色: "#c79d90", 豆沙色: "#ad7474", 正红: "#b53d42" },
  blush: { 淡粉: "#dca1ac", 珊瑚: "#dc8f80", 自然: "#c38c84" },
};

export const regionalTiles: Readonly<Record<string, { file: string; index: number }>> = Object.fromEntries([
  ["现代都市", "东方古代", "欧式古典", "未来都市", "架空世界", "民国城市"].map((choice, index) => [choice, { file: "worlds-1", index }]),
  ["东方仙侠", "西部荒野", "海滨小镇", "蒸汽时代", "近未来空间站"].map((choice, index) => [choice, { file: "worlds-2", index }]),
].flat());
