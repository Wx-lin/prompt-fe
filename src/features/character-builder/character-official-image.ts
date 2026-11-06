import { characterAssetUrl } from "@/lib/character-asset-url";

/** Read a built-in image through Next's same-origin optimizer before converting it to PNG. */
export async function officialImagePng(source: string): Promise<string> {
  if (source !== "/character-outfits/stage-transparent.png" && !/^\/character-library\/[a-zA-Z0-9_-]+\.(?:png|webp|jpe?g)$/.test(source)) throw new Error("Invalid official image");
  const params = new URLSearchParams({ url: characterAssetUrl(source), w: "1080", q: "75" });
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Could not load official image"));
    image.src = `/_next/image?${params}`;
  });
  if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 16_000_000) throw new Error("Invalid official image dimensions");
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare official image");
  context.drawImage(image, 0, 0);
  const result = canvas.toDataURL("image/png");
  if (!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(result) || result.length > 20 * 1024 * 1024) throw new Error("Invalid official image");
  return result;
}
