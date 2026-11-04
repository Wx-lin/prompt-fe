import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findOutfit, OUTFITS, OUTFIT_FILTERS } from "./character-outfits";

describe("服装套装", () => {
  it("现代 100 套，标识和服装内容唯一，保存后都能恢复对应选择", () => {
    expect(OUTFITS).toHaveLength(138);
    expect(new Set(OUTFITS.map((item) => item.id)).size).toBe(138);
    expect(new Set(OUTFITS.map((item) => JSON.stringify(item.parts))).size).toBe(138);
    for (const item of OUTFITS) {
      const values = JSON.parse(JSON.stringify({ top: item.parts[0], bottom: item.parts[1], shoes: item.parts[2] }));
      expect(findOutfit(values)?.id).toBe(item.id);
    }
  });

  it("青春套装名称、提示词和图片路径保持一致", () => {
    const outfit = OUTFITS.find((item) => item.id === "modern-youth-04-2");
    expect(outfit?.name).toBe("白 T 粉牛仔");
    expect(outfit?.parts).toEqual(["白色短袖T恤", "粉色牛仔裤", "白鞋"]);
    expect(outfit?.image.src).toBe("/character-outfits/catalog-modern-youth-04-02.webp");
  });

  it("所有套装素材存在，青春套装使用独立图并且路径唯一", () => {
    for (const item of OUTFITS) {
      expect(existsSync(join(process.cwd(), "public", item.image.src.slice(1))), item.image.src).toBe(true);
      expect(item.image.index).toBeGreaterThanOrEqual(0);
      expect(item.image.index).toBeLessThan(item.image.columns === 1 ? 1 : item.image.columns * 2);
    }
    const youthOutfits = OUTFITS.filter((item) => item.image.src.includes("catalog-modern-youth-"));
    expect(youthOutfits).toHaveLength(88);
    expect(youthOutfits.every(({ image }) => image.columns === 1 && image.index === 0)).toBe(true);
    expect(new Set(youthOutfits.map(({ image }) => `${image.src}:${image.index}`)).size).toBe(88);
  });

  it("每个风格都有素材，原有六套的标识和服装内容保持兼容", () => {
    expect(OUTFIT_FILTERS.map((style) => OUTFITS.filter((item) => item.style === style).length)).toEqual([100, 8, 6, 6, 6, 6, 6]);
    expect(OUTFITS.slice(0, 6).map(({ id, parts }) => ({ id, parts }))).toEqual([
      { id: "modern-01", parts: ["灰色短袖T恤", "蓝色直筒牛仔裤", "白色运动鞋"] },
      { id: "modern-02", parts: ["黑色西装外套和白色内搭", "黑色西裤", "黑色皮鞋"] },
      { id: "modern-03", parts: ["米白色针织上衣", "米色阔腿裤", "白鞋"] },
      { id: "modern-04", parts: ["浅灰色连帽运动上衣", "深色运动长裤", "白色运动鞋"] },
      { id: "modern-05", parts: ["深蓝校服西装、白衬衫和红领带", "百褶裙和黑袜", "黑色皮鞋"] },
      { id: "modern-06", parts: ["卡其色夹克和黑衬衫", "黑色长裤", "黑鞋"] },
    ]);
  });
});
