import type { AnalysisDetail, AnalysisStatus } from "./prompt-analysis";

export type ConversationMode = "auto" | "generate" | "image" | "smart";
export type GeneratedImage = { id: string; url: string; expires_at: string; width: number; height: number };
export type CreateConversationInput = { message?: string; asset_id?: string; generated_image_id?: string; mode?: ConversationMode };

export type SendConversationInput = CreateConversationInput & {
  parent_analysis_id: string;
  parent_revision: number;
};

export type ConversationTurn = AnalysisDetail & {
  conversation_id: string;
  parent_analysis_id: string | null;
  user_message: string;
  version: number;
  response_type?: "assistant" | "prompt" | "image" | null;
  generated_image?: GeneratedImage | null;
  image_status?: "available" | "temporarily_unavailable" | null;
  generation_mode?: "image" | null;
  assistant_reply?: string | null;
  prompt_number?: number | null;
};

export type PromptConversationDetail = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  turns: ConversationTurn[];
};

export type PromptConversationSummary = {
  id: string;
  title: string;
  status: AnalysisStatus;
  created_at: string;
  updated_at: string;
  latest_analysis_id: string;
  version: number;
};

export type PromptConversationHistory = {
  items: PromptConversationSummary[];
  pagination: { limit: number; has_more: boolean; next_cursor: string | null };
};
