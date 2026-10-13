import { notFound } from "next/navigation";
import { getRecommendations } from "@/features/prompt-detail/lib/recommendations";
import { DetailPage } from "@/features/prompt-detail/components/detail-page";
import { demoPrompts } from "@/features/gallery/data/demo-prompts";
import { getSessionToken } from "@/lib/auth/session";
import { getPromptDetail } from "@/lib/api/client";
import type { GalleryCard, PromptDetail } from "@/types/prompt";

type RouteParameters = Promise<{ id: string }>;

async function loadPrompt(id: string, accessToken?: string): Promise<PromptDetail | GalleryCard | null> {
  try {
    return await getPromptDetail(id, accessToken);
  } catch {
    return process.env.NODE_ENV === "production" ? null : demoPrompts.find((item) => item.id === id) ?? null;
  }
}

export default async function PromptModalRoute({ params }: { params: RouteParameters }) {
  const { id } = await params;
  const token = await getSessionToken();
  const prompt = await loadPrompt(id, token ?? undefined);
  if (!prompt) notFound();
  const recommendations = await getRecommendations(id);
  return <DetailPage prompt={prompt} recommendations={recommendations} />;
}
