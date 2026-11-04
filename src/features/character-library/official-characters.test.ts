import { existsSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { parsePreset } from "@/features/character-builder/character-presets";
import { getOfficialCharacter, OFFICIAL_CHARACTERS } from "./official-characters";

describe("官方角色", () => {
  it("保留原有角色并提供 100 个独立、可编辑的角色", () => {
    expect(OFFICIAL_CHARACTERS).toHaveLength(100);
    expect(new Set(OFFICIAL_CHARACTERS.map(({ id }) => id)).size).toBe(100);
    expect(new Set(OFFICIAL_CHARACTERS.map(({ name }) => name)).size).toBe(100);
    for (const id of ["urban-woman", "urban-man", "professional-woman", "ancient-man", "scifi-woman"]) {
      expect(getOfficialCharacter(id)?.id).toBe(id);
    }
    for (const character of OFFICIAL_CHARACTERS) {
      expect(parsePreset(character)).not.toBeNull();
      expect(character.values.name).toBe(character.name);
      expect(character.values.occupation).toBeTruthy();
      expect(character.values.top).toBeTruthy();
      expect(character.values.bottom).toBeTruthy();
      expect(character.values.shoes).toBeTruthy();
      expect(getOfficialCharacter(character.id)).toBe(character);
    }
  });

  it("每个新增角色都引用独立且存在的形象素材", () => {
    const added = OFFICIAL_CHARACTERS.slice(5);
    expect(new Set(added.map(({ image }) => image)).size).toBe(95);
    for (const { image } of added) {
      expect(existsSync(join(process.cwd(), "public", image))).toBe(true);
    }
  });

  it("新增角色使用适合编辑页放大展示的透明高清素材", async () => {
    const results = await Promise.all(OFFICIAL_CHARACTERS.slice(5).map(async ({ id, image }) => {
      const metadata = await sharp(join(process.cwd(), "public", image)).metadata();
      return { id, height: metadata.height ?? 0, hasAlpha: metadata.hasAlpha };
    }));
    expect(results.filter(({ height, hasAlpha }) => height < 1024 || !hasAlpha)).toEqual([]);
  });

  it("现代和古装角色的基本设置与形象同步", () => {
    expect(getOfficialCharacter("drama-01-01")?.values).toMatchObject({ gender: "女性", top: "粉色开衫", bottom: "白色百褶裙", shoes: "白色运动鞋" });
    expect(getOfficialCharacter("drama-07-01")?.values).toMatchObject({ gender: "女性", occupation: "皇后", top: "红金色凤袍", regionalStyle: "东方古代" });
  });

  it("中年古装人物的设定与形象年龄一致", () => {
    expect(getOfficialCharacter("drama-07-03")).toMatchObject({ name: "威严帝王", values: { age: "45岁", maturity: "成熟" } });
    for (const id of ["drama-08-03", "drama-10-05"]) {
      expect(getOfficialCharacter(id)?.values).toMatchObject({ age: "45岁", maturity: "成熟" });
    }
  });
});
