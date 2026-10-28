import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "node_modules/next/dist/compiled/server-only/empty.js"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    exclude: ["e2e/**", "node_modules/**", "test-results/**"],
    coverage: {
      provider: "v8",
      include: ["src/lib/seo/**/*.ts", "src/app/sitemap.ts", "src/lib/api/client.ts", "src/lib/theme/**/*.ts", "src/features/gallery/lib/**/*.ts", "src/features/search/lib/**/*.ts", "src/lib/prompt-analysis/**/*.ts", "src/features/image-to-prompt/**/*.{ts,tsx}", "src/features/prompt-creation/**/*.{ts,tsx}", "src/app/api/prompt-conversations/**/route.ts", "src/app/api/prompt-analyses/**/route.ts", "src/app/api/prompt-assets/**/route.ts", "src/app/api/prompt-examples/route.ts"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
