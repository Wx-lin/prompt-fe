import type { Category } from "@/types/prompt";

// API outage fallback. The requirement contract test prevents catalog drift.
export const fallbackCategories: Category[] = [
  {
    "key": "portrait",
    "label": "人像写真",
    "label_en": "Portraits",
    "order": 1,
    "count": 0
  },
  {
    "key": "avatar",
    "label": "头像",
    "label_en": "Avatars",
    "order": 2,
    "count": 0
  },
  {
    "key": "poster",
    "label": "海报与封面",
    "label_en": "Posters & Covers",
    "order": 3,
    "count": 0
  },
  {
    "key": "product",
    "label": "商品与电商",
    "label_en": "Products & E-commerce",
    "order": 4,
    "count": 0
  },
  {
    "key": "illustration",
    "label": "插画与绘本",
    "label_en": "Illustrations & Storybooks",
    "order": 5,
    "count": 0
  },
  {
    "key": "character",
    "label": "角色与 IP",
    "label_en": "Characters & IP",
    "order": 6,
    "count": 0
  },
  {
    "key": "sticker",
    "label": "表情包与贴纸",
    "label_en": "Memes & Stickers",
    "order": 7,
    "count": 0
  },
  {
    "key": "wallpaper",
    "label": "壁纸与背景",
    "label_en": "Wallpapers & Backgrounds",
    "order": 8,
    "count": 0
  },
  {
    "key": "infographic",
    "label": "信息图解",
    "label_en": "Infographics",
    "order": 9,
    "count": 0
  },
  {
    "key": "branding",
    "label": "Logo 与品牌",
    "label_en": "Logos & Branding",
    "order": 10,
    "count": 0
  },
  {
    "key": "architecture",
    "label": "空间与建筑",
    "label_en": "Spaces & Architecture",
    "order": 11,
    "count": 0
  },
  {
    "key": "scene",
    "label": "风景与静物",
    "label_en": "Scenery & Still Life",
    "order": 12,
    "count": 0
  }
];

export const legacyCategoryKeys = ["photography", "image_edit", "workflow"];
export function isCurrentCategory(key: string): boolean {
  return fallbackCategories.some(category => category.key === key);
}
