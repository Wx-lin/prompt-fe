import characterAssets from "./character-assets.json";

/** Built-in assets are served from COS in production; user and API URLs stay untouched. */
export function characterAssetUrl(src: string, environment = process.env.NODE_ENV): string {
  if (environment !== "production" || !/^\/character-(?:library|outfits|visuals|demo)\//.test(src)) return src;
  return `${characterAssets.baseUrl}${src}`;
}
