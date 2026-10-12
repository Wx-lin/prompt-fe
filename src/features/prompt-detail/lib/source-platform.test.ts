import { describe, expect, it } from "vitest";
import { getSourcePlatform } from "./source-platform";

describe("getSourcePlatform", () => {
  it.each([
    ["https://www.xiaohongshu.com/explore/123", "xiaohongshu"],
    ["https://xhslink.com/abc", "xiaohongshu"],
    ["https://weibo.com/123/abc", "weibo"],
    ["https://m.weibo.cn/detail/123", "weibo"],
    ["https://v.kuaishou.com/abc", "kuaishou"],
    ["https://www.kuaishou.com/short-video/123", "kuaishou"],
  ] as const)("recognizes %s", (url, platform) => {
    expect(getSourcePlatform(url)).toEqual({ platform, url });
  });

  it.each(["javascript:alert(1)", "http://weibo.com/post", "https://weibo.com.evil.example/post", "https://example.com/post", "not-a-url", null])(
    "rejects an untrusted or unsupported source: %s",
    (url) => expect(getSourcePlatform(url)).toBeNull(),
  );
});
