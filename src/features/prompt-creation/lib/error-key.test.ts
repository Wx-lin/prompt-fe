import { expect, it } from "vitest";
import { ApiError } from "@/features/image-to-prompt/lib/client";
import { creationErrorKey } from "./error-key";
import zh from "../../../../messages/zh.json";
import en from "../../../../messages/en.json";

it.each([
  [401, "ANY", "signin"], [0, "INVALID_IMAGE", "imageInvalid"], [415, "UNSUPPORTED_IMAGE", "imageInvalid"], [413, "PAYLOAD_TOO_LARGE", "imageInvalid"],
  [422, "SOURCE_IMAGE_UNAVAILABLE", "sourceImageUnavailable"],
  [422, "INVALID_REQUEST", "inputRequired"], [0, "UNSAVED_EDIT", "unsaved"], [409, "REVISION_CONFLICT", "saveConflict"], [409, "PARENT_REVISION_CONFLICT", "saveConflict"],
  [0, "INVALID_PROMPT", "invalidPrompt"], [409, "ANALYSIS_IN_PROGRESS", "inProgress"], [429, "CONVERSATION_LIMIT", "conversationLimit"],
  [429, "QUOTA_EXCEEDED", "quotaLimit"], [429, "DAILY_LIMIT", "quotaLimit"], [429, "TOO_MANY", "rateLimit"], [404, "NOT_FOUND", "notFound"],
  [503, "SERVICE_UNAVAILABLE", "unavailable"], [409, "NOT_EDITABLE", "notEditable"], [409, "NOT_RETRYABLE", "notEditable"], [502, "UNRECOGNISED_PROVIDER_BODY", "networkError"],
] as const)("maps %s/%s to a safe local message %s", (status, code, key) => {
  expect(creationErrorKey(new ApiError(status, code))).toBe(key);
});

it.each([
  ["Chinese", zh.promptCreation, "这张作品图片暂无法导入，请上传参考图片。"],
  ["English", en.promptCreation, "This gallery image cannot be imported right now. Please upload a reference image."],
] as const)("provides actionable gallery import guidance in %s", (_language, messages, expected) => {
  expect(messages[creationErrorKey(new ApiError(422, "SOURCE_IMAGE_UNAVAILABLE"))]).toBe(expected);
});
