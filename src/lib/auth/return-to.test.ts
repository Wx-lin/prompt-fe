import { expect, it } from "vitest";
import { safeReturnTo } from "./return-to";

it("only permits explicitly supported local destinations", () => {
  expect(safeReturnTo("/publish")).toBe("/publish");
  expect(safeReturnTo("/my-works")).toBe("/my-works");
  for (const value of [null, "https://evil.example", "//evil.example", "/publish?next=https://evil.example", "/\\evil.example"]) {
    expect(safeReturnTo(value)).toBe("/");
  }
});

it("preserves only approved character library and editor routes", () => {
  const id = "fbb28667-5f69-418f-8ad7-9e7b34d33a5c";
  for (const value of ["/character-library", "/character-library?tab=mine", "/character-setting", "/character-setting?new=1", "/character-setting?preset=urban-woman", `/character-setting?asset=${id}`]) expect(safeReturnTo(value)).toBe(value);
  expect(safeReturnTo("/en/character-setting?preset=urban-man")).toBe("/character-setting?preset=urban-man");
  expect(safeReturnTo("/en/character-library?tab=mine")).toBe("/character-library?tab=mine");
  for (const value of ["//evil.example/character-library", "/character-library?tab=mine&next=https://evil.example", "/character-setting?new=1&new=1", "/character-setting?preset=evil", "/character-setting?asset=../../evil", "/character-setting#x", "/en//evil.example"]) expect(safeReturnTo(value)).toBe("/");
});
