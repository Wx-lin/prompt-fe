import { expect, it } from "vitest";
import { fallbackCategories, legacyCategoryKeys } from "@/features/gallery/data/categories";
import { MAX_IMAGE_SIZE, validImage, validSubmission } from "./validation";

const submission = {
  title: "假如你家毛孩子也要上班",
  prompt_text: "一只正在花店工作的猫咪",
  description: "",
  category: "sticker",
  models: ["GPT Image 2.0"],
  upload_ids: ["00000000-0000-4000-8000-000000000001"]
};

it.each(fallbackCategories)("accepts the current $key submission category", ({ key }) => {
  expect(validSubmission({ ...submission, category: key })).toBe(true);
});

it.each([...legacyCategoryKeys, "all", "unknown", "", null, 123, {}, ["portrait"]])("rejects invalid category %j", (category) => {
  expect(validSubmission({ ...submission, category })).toBe(false);
});

it.each([null, undefined, "submission", 1])("rejects a non-object payload %j", (value) => {
  expect(validSubmission(value)).toBe(false);
});

it.each([
  { title: " " },
  { title: "x".repeat(201) },
  { prompt_text: "" },
  { prompt_text: "x".repeat(20001) },
  { description: "x".repeat(5001) },
  { models: [] },
  { models: [" "] },
  { models: ["x".repeat(51)] },
  { models: [123] },
  { models: Array(11).fill("GPT Image 2.0") },
  { upload_ids: [] },
  { upload_ids: ["invalid-uuid"] },
  { upload_ids: [123] },
  { upload_ids: Array(7).fill(submission.upload_ids[0]) }
])("rejects invalid submission fields %j", (change) => {
  expect(validSubmission({ ...submission, ...change })).toBe(false);
});

it("accepts only non-empty supported images up to the upload limit", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp"])
    expect(validImage({ type, size: MAX_IMAGE_SIZE })).toBe(true);
  expect(validImage({ type: "image/png", size: 0 })).toBe(false);
  expect(validImage({ type: "image/png", size: MAX_IMAGE_SIZE + 1 })).toBe(false);
  expect(validImage({ type: "image/svg+xml", size: 1 })).toBe(false);
});
