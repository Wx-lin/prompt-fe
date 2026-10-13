import { expect, it } from "vitest";
import { safeReturnTo } from "./return-to";

it("only permits the two local publishing destinations", () => {
  expect(safeReturnTo("/publish")).toBe("/publish");
  expect(safeReturnTo("/my-works")).toBe("/my-works");
  for (const value of [null, "https://evil.example", "//evil.example", "/publish?next=https://evil.example", "/\\evil.example"]) {
    expect(safeReturnTo(value)).toBe("/");
  }
});
