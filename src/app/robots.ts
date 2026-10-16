import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://aigc-prompt.com";
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/login", "/*/login", "/api/"] }],
    sitemap: `${siteUrl.replace(/\/$/, "")}/sitemap.xml`,
  };
}
