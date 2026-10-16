import { expect, it } from "vitest";
import { galleryMetadata, parsePage, serializeJsonLd, localizedPath } from "./metadata";
it("targets broad image prompt keywords on the Chinese homepage", () => {
  const metadata = galleryMetadata("zh", {});
  expect(metadata.title).toContain("AI 提示词库");
  expect(metadata.description).toContain("文生图");
  expect(metadata.alternates?.canonical).toBe("/");
});
it("keeps each pagination page self canonical", () => {
  expect(galleryMetadata("en", { page: "3" }).alternates?.canonical).toBe("/en?page=3");
});
it("noindexes arbitrary query/filter combinations but indexes category landings", () => {
  expect(galleryMetadata("zh", { q: "cat" }).robots).toEqual({ index: false, follow: true });
  expect(galleryMetadata("zh", { models: "FLUX" }).robots).toEqual({ index: false, follow: true });
  expect(galleryMetadata("zh", {}, "avatar").alternates?.canonical).toBe("/category/avatar");
  expect(galleryMetadata("zh", {}, "avatar").title).toContain("头像");
});
it.each([undefined, "0", "-2", "1.5", "Infinity", "99999999999999999999"])("normalizes invalid page %s", value => expect(parsePage(value)).toBe(1));
it("supports valid pages and locale paths", () => {
  expect(parsePage("4")).toBe(4);
  expect(localizedPath("en", "/prompt/id")).toBe("/en/prompt/id");
});
it("escapes script terminators in JSON-LD user content", () => expect(serializeJsonLd({ name: "</script><script>bad" })).not.toContain("<"));
