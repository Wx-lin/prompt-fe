import { expect, it } from "vitest";
import { fallbackCategories } from "./categories";
import zh from "../../../../messages/zh.json";
import en from "../../../../messages/en.json";
import { existsSync, readFileSync } from "node:fs";
it("keeps fallback and both translations aligned with the twelve-category requirement", () => {
 const keys = ["portrait", "avatar", "poster", "product", "illustration", "character", "sticker", "wallpaper", "infographic", "branding", "architecture", "scene"];
 expect(fallbackCategories.map(c => c.key)).toEqual(keys);
 const requirementPath = "../aigc-prompt-backend/docs/aigc-prompt-分类优化需求.md";
 const requirement = existsSync(requirementPath) ? readFileSync(requirementPath, "utf8") : null;
 keys.forEach((key, index) => {
  const category = fallbackCategories[index];
  if (requirement) expect(requirement).toContain(`| ${index + 1} | ${key} | ${category.label} | ${category.label_en} |`);
  expect(zh.categories[key as keyof typeof zh.categories]).toBe(category.label);
  expect(en.categories[key as keyof typeof en.categories]).toBe(category.label_en);
 });
});
