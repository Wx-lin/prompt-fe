export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function validImage(file: Pick<File, "size" | "type">) {
  return file.size > 0 && file.size <= MAX_IMAGE_SIZE && IMAGE_TYPES.includes(file.type);
}

export function validSubmission(value: unknown): boolean {
  if (!value || typeof value !== "object")
    return false;
  const data = value as Record<string, unknown>;
  const text = (key: string, min: number, max: number) => typeof data[key] === "string" && (data[key] as string).trim().length >= min && (data[key] as string).length <= max;
  return text("title", 1, 200) && text("prompt_text", 1, 20000) && text("description", 0, 5000) && ["portrait", "avatar", "poster", "illustration", "photography", "character", "image_edit", "workflow"].includes(String(data.category))
    && Array.isArray(data.models) && data.models.length >= 1 && data.models.length <= 10 && data.models.every(item => typeof item === "string" && item.trim().length > 0 && item.length <= 50)
    && Array.isArray(data.upload_ids) && data.upload_ids.length >= 1 && data.upload_ids.length <= 6 && data.upload_ids.every(item => typeof item === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item));
}
