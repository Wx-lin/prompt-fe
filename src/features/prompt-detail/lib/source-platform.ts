export type SourcePlatform = "xiaohongshu" | "weibo" | "kuaishou";

const platformDomains: ReadonlyArray<readonly [SourcePlatform, readonly string[]]> = [
  ["xiaohongshu", ["xiaohongshu.com", "xhslink.com"]],
  ["weibo", ["weibo.com", "weibo.cn"]],
  ["kuaishou", ["kuaishou.com", "v.kuaishou.com"]],
];

export function getSourcePlatform(sourceUrl: string | null | undefined): { platform: SourcePlatform; url: string } | null {
  if (!sourceUrl) return null;

  try {
    const url = new URL(sourceUrl);
    if (url.protocol !== "https:") return null;

    const hostname = url.hostname.toLowerCase();
    const match = platformDomains.find(([, domains]) =>
      domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`)),
    );

    return match ? { platform: match[0], url: url.href } : null;
  } catch {
    return null;
  }
}
