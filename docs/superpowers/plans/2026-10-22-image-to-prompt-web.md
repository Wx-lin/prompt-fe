# Image to Prompt Website Implementation Plan

> **For agentic workers:** Use subagent-driven-development for isolated tasks and independent spec/security review. No commit or deployment is requested.

**Goal:** Implement the approved website two-column modal against the real shared backend.

**Architecture:** Keep gallery and search intact. An image-to-prompt launcher owns persistent workflow state and composes Base UI dialogs; thin Next BFF handlers reuse session/CSRF/body bounds and preserve the backend job envelope. Isolated local backend and worker provide real verification.

**Tech Stack:** Next16.4, React19.3, Base UI1.8, CSS Modules, next-intl, Vitest/RTL, Playwright, existing FastAPI.

## Tasks

- [x] Inspect current AGENT/code and yesterday's upload/result UI; isolate frontend at `feat/image-to-prompt-web`; preserve original checkout changes.
- [x] Baseline: `npm ci --no-audit --no-fund`, `npm test`, read local Next route-handler/client component docs.
- [x] Contract/BFF TDD: create `src/types/prompt-analysis.ts`, `src/lib/prompt-analysis/proxy.ts` plus tests and `/api/prompt-assets`, `[id]`, `/api/prompt-analyses`, `[id]`, `/api/prompt-examples` routes. RED cases cover missing sessions, CSRF, malformed UUID/body/query, missing idempotency, streaming limits, upstream failure/redirection and 202/204. GREEN must preserve safe envelope and no-store without reading credentials into browser code.
- [x] Client/workflow TDD: create `src/features/image-to-prompt/lib/client.ts`, `workflow.ts` and hooks/tests. `create(assetId,key,signal)` preserves the same key for unknown network outcome; selecting an image never calls a model; `GET` polling only, explicit new analysis gets a new key. Abort and generation fences prevent late output. Use actual response types from backend.
- [x] UI TDD: create focused single-image input, result editor, history list and modal/launcher under `src/features/image-to-prompt/components/`; create CSS modules using theme tokens. Verify file click/drop/paste validation, language switching, textarea editing/copy feedback, async/save/error states and active-job actions. Match stored reference images.
- [x] Homepage/auth integration: extend `SearchTriggerGroup` with separated launcher and preserve search/ref shortcut. Add optional `LoginPage` callbacks without changing route-based defaults; original selected file survives inline login. Add both `messages/zh.json` and `messages/en.json` imageToPrompt keys.
- [x] Test fixture/E2E: add `e2e/helpers/prompt-analysis-fixture.py` and `e2e/image-to-prompt.spec.ts` or equivalent existing fixture integration. Use isolated real PG/Redis and fake provider for deterministic full browser behavior; never insert demo responses into production routes. Verify desktop/mobile deep/light, close/reopen, failed state, bilingual edit/copy, reload history/delete and login.
- [x] Integrate real local backend on distinct loopback port, one user-owned sample request and real worker. Verify generated result and history; retain the single owned preview sample for the user, never modify unrelated records/objects.
- [x] Spec review then security/code review; resolve issues with regression tests.
- [x] `npm run lint`, `npm run typecheck`, `npm test`, focused coverage≥80%, critical Playwright, `npm run build`, `git diff --check`; update PROGRESS/AGENT and preserve a visible local preview plus screenshots.

## Verified outcome

414 Vitest tests passed; scoped line coverage96.02%, branch90.37%. New feature16 and existing homepage/search/filter32 Playwright checks passed. Lint, typecheck and production build passed. Real browser upload through the website BFF produced a Qwen3.8 result in15.64s with one dispatch; bilingual display, edit/save/restore and private history reopen did not create another model call. Local website3126 now points to the real loopback backend8027; deterministic fixture8026 has stopped and removed its own schema/keys. The one preview sample stays in the isolated test database for user review. No commit, push or deployment was performed. Details and caveats are recorded in PROGRESS.md.

## File ownership

Contract/BFF agent owns types, server proxy/routes and their tests. Workflow agent owns client, hook/state and tests. Root owns UI/CSS, homepage/auth and i18n. E2E agent later owns isolated fixture/spec. Do not edit another owner's files without coordination. Every behavior change starts with a failing test; inspect results before adapting implementation. Models/storage stay server-side.
