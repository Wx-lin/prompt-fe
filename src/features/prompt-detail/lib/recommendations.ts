import { getSimilarPrompts } from "@/lib/api/client";
import type { GalleryCard } from "@/types/prompt";

/** Preserve backend ranking; unpublished or fixture content must never fill an empty result. */
export async function getRecommendations(id: string): Promise<GalleryCard[]> {
  try {
    const items = await getSimilarPrompts(id);
    return items
      .filter(item => item.id !== id && Boolean(item.thumbnail_url?.trim()))
      .filter((item, index, candidates) => candidates.findIndex(candidate => candidate.id === item.id) === index)
      .slice(0, 3)
      .map(item => ({ ...item, image: item.thumbnail_url!, imageWidth: 300, imageHeight: 400 }));
  }
  catch {
    return [];
  }
}
