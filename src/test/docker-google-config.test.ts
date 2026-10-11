import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Docker Google OAuth configuration", () => {
  it("makes the public client ID available before Next.js compiles browser code", () => {
    const dockerfile = readFileSync(resolve(process.cwd(), "Dockerfile"), "utf8");
    const buildStage = dockerfile.split("FROM node:24-bookworm-slim AS runtime")[0];
    const beforeBuild = buildStage.split("RUN npm run build")[0];
    expect(beforeBuild).toMatch(/^ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID$/m);
    expect(beforeBuild).toMatch(/^ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=\$NEXT_PUBLIC_GOOGLE_CLIENT_ID$/m);
  });

  it("requires an explicit client ID in the production Compose overlay", () => {
    const overlay = readFileSync(resolve(process.cwd(), "deploy/compose.google.yml"), "utf8");
    expect(overlay).toContain("NEXT_PUBLIC_GOOGLE_CLIENT_ID: ${NEXT_PUBLIC_GOOGLE_CLIENT_ID:?");
  });
});
