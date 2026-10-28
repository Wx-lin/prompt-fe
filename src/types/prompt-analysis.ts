export type BilingualPrompt = { zh: string; en: string };

export type AnalysisResult = {
  schema_version: "1";
  title: string;
  prompt: BilingualPrompt;
  breakdown: Record<"subject" | "composition" | "lighting" | "style", BilingualPrompt>;
  uncertain_details: string[];
};

export type AnalysisStatus = "queued" | "running" | "succeeded" | "failed" | "unknown" | "canceled";

export type AnalysisAsset = {
  id: string;
  width: number;
  height: number;
  byte_size: number;
  preview_url: string;
  thumbnail_url: string;
  preview_expires_at: string;
};

type AnalysisRecord = {
  id: string;
  asset_id: string | null;
  input_type?: "image" | "text";
  idea_text?: string | null;
  purpose?: "wallpaper" | "avatar" | "poster" | "product" | "illustration" | null;
  style?: "cinematic" | "photorealistic" | "illustration" | "anime" | "minimalist" | null;
  conversation_id?: string;
  parent_analysis_id?: string | null;
  user_message?: string;
  version?: number;
  status: AnalysisStatus;
  phase: string;
  revision: number;
  created_at: string;
  finished_at: string | null;
  title: string | null;
  error_code: string | null;
  history_retain_until: string;
  image_available: boolean;
  preview_url: string | null;
  thumbnail_url: string | null;
  preview_expires_at: string | null;
  preview_status?: "temporarily_unavailable";
};

export type AnalysisDetail = AnalysisRecord & {
  result: AnalysisResult | null;
  prompt: BilingualPrompt | null;
  saved_to_history: boolean;
};

export type AnalysisSummary = AnalysisRecord & { summary: Partial<BilingualPrompt> };

export type AnalysisHistory = {
  items: AnalysisSummary[];
  pagination: { limit: number; has_more: boolean; next_cursor: string | null };
};

export type ApiEnvelope<T> = {
  success: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
  request_id: string;
};
