import type { ApiError } from "@/features/image-to-prompt/lib/client";

export function creationErrorKey(error: ApiError) {
  if (error.status === 401) return "signin";
  if (error.code === "SOURCE_IMAGE_UNAVAILABLE") return "sourceImageUnavailable";
  if (error.code === "INVALID_IMAGE" || error.code === "UNSUPPORTED_IMAGE" || error.code === "PAYLOAD_TOO_LARGE") return "imageInvalid";
  if (error.code === "INVALID_REQUEST") return "inputRequired";
  if (error.code === "UNSAVED_EDIT") return "unsaved";
  if (error.code === "REVISION_CONFLICT" || error.code === "PARENT_REVISION_CONFLICT") return "saveConflict";
  if (error.code === "INVALID_PROMPT") return "invalidPrompt";
  if (error.code === "ANALYSIS_IN_PROGRESS") return "inProgress";
  if (error.code === "CONVERSATION_LIMIT") return "conversationLimit";
  if (error.code.includes("QUOTA") || error.code.includes("DAILY")) return "quotaLimit";
  if (error.status === 429) return "rateLimit";
  if (error.status === 404) return "notFound";
  if (error.status === 503) return "unavailable";
  if (error.code === "NOT_EDITABLE" || error.code === "NOT_RETRYABLE") return "notEditable";
  return "networkError";
}
