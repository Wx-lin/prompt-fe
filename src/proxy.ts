import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

// Next.js 16 renamed middleware.ts to proxy.ts; next-intl's middleware factory
// still returns a standard (request) => response handler, so it plugs in directly.
// Must live inside src/ (next to src/app/), not the project root, since this project
// uses the src/ directory convention — Next.js silently skips a root-level proxy.ts
// when src/ exists, which looks like "the middleware just isn't running" with no error.
const proxy = createMiddleware(routing);

export default proxy;

export const config = {
  // Skip API routes, static assets, and files with an extension (e.g. demo images,
  // sitemap.xml, robots.txt) so locale redirects don't intercept non-page requests.
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
