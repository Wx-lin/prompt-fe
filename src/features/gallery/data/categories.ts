import type { Category } from "@/types/prompt";

// 2026-10-09 与后端 app/routers/categories.py 的 CATEGORY_LABELS 同步更新为
// 按"创作意图"分类的八分类体系，仅用于后端分类接口不可用时的兜底展示。
export const fallbackCategories: Category[] = [
  { key: "portrait", label: "人像写真", count: 0 },
  { key: "avatar", label: "头像 & IP", count: 0 },
  { key: "poster", label: "海报 & 封面", count: 0 },
  { key: "illustration", label: "插画 & 概念艺术", count: 0 },
  { key: "photography", label: "模拟摄影", count: 0 },
  { key: "character", label: "角色 & 人物设计", count: 0 },
  { key: "image_edit", label: "图片编辑", count: 0 },
  { key: "workflow", label: "工作流 & 技巧", count: 0 },
];
