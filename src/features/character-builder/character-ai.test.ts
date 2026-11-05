import { describe, expect, it } from "vitest";
import { createInitialValues, TEMPLATES, UNSPECIFIED, type CharacterValues } from "./character-data";
import { applyCharacterInterpretation } from "./character-ai";
import { buildOutputs } from "./prompt-builder";

describe("AI character interpretation", () => {
  it("replaces untouched example defaults for a new character and updates every template", () => {
    const current = createInitialValues();
    const result = applyCharacterInterpretation(current, { values: { age: "30岁", gender: "男性", hairLength: "长发", top: "白衬衫" }, unmapped: "右手有一道细疤" }, { clearDefaults: true, touched: new Set() });
    expect(result.age).toBe("30岁");
    expect(result.occupation).toBe(UNSPECIFIED);
    expect(result.bottom).toBe(UNSPECIFIED);
    expect(result.aiDetails).toContain("右手有一道细疤");
    for (const template of TEMPLATES) {
      const text = buildOutputs(result, template.id, "通用").zh;
      expect(text).toContain("30岁");
      expect(text).toContain("右手有一道细疤");
      expect(text).not.toContain("运动背心");
    }
  });

  it("preserves explicit edits and merges unmapped details without losing existing description", () => {
    const current: CharacterValues = { ...createInitialValues(), description: "左手戴银戒", occupation: "医生" };
    const result = applyCharacterInterpretation(current, { values: { age: "32岁" }, unmapped: "右手有细疤" }, { clearDefaults: true, touched: new Set(["occupation", "description"]) });
    expect(result.occupation).toBe("医生");
    expect(result.description).toContain("左手戴银戒");
    expect(result.aiDetails).toContain("右手有细疤");
    expect(current.age).toBe("25岁");
  });

  it("replaces old AI-only details without altering the user's own description", () => {
    const first = applyCharacterInterpretation({ ...createInitialValues(), description: "银戒指" }, { values: {}, unmapped: "左手拿伞" }, { clearDefaults: false, touched: new Set() });
    const second = applyCharacterInterpretation(first, { values: {}, unmapped: "左手空着" }, { clearDefaults: false, touched: new Set() });
    expect(second.description).toBe("银戒指");
    expect(second.aiDetails).toBe("左手空着");
    expect(buildOutputs(second, "basic", "通用").zh).not.toContain("左手拿伞");
  });

  it("retains unmentioned fields when editing an existing character", () => {
    const current = createInitialValues();
    const result = applyCharacterInterpretation(current, { values: { age: "32岁" }, unmapped: "" }, { clearDefaults: false, touched: new Set() });
    expect(result.top).toBe(current.top);
    expect(result.age).toBe("32岁");
  });

  it("rejects unrecognized fields and invalid values without applying them", () => {
    expect(() => applyCharacterInterpretation(createInitialValues(), { values: { seed: "99" }, unmapped: "" }, { clearDefaults: false, touched: new Set() })).toThrow();
    expect(() => applyCharacterInterpretation(createInitialValues(), { values: { age: 22 }, unmapped: "" }, { clearDefaults: false, touched: new Set() })).toThrow();
    expect(() => applyCharacterInterpretation(createInitialValues(), { values: { name: "人".repeat(81) }, unmapped: "" }, { clearDefaults: false, touched: new Set() })).toThrow();
  });
});
