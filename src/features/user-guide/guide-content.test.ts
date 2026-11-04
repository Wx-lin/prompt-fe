import { describe, expect, it } from "vitest";
import { getGuideSections } from "./guide-content";

describe("guide chapter anchors", () => {
  it("uses stable Chinese title slugs and disambiguates repeated headings", () => {
    const markdown = "# 手册\n\n## 快速开始\n内容\n\n## 角色库\n内容\n\n## 角色库\n";
    const before = getGuideSections(markdown);
    const after = getGuideSections(markdown.replace("内容", "新增介绍\n\n更多内容"));
    expect(before.map(section => section.id)).toEqual(["快速开始", "角色库", "角色库-1"]);
    expect(after.map(section => section.id)).toEqual(before.map(section => section.id));
    expect(after[1].line).not.toBe(before[1].line);
  });
});
