# Character Library Implementation Plan

**Goal:** Add a browsable official character library and authenticated personal library, with a focused editor that preserves the existing character settings and outfit selection.

**Architecture:** Keep the existing character prompt builder and outfit data as the source of truth. Route library selections into the editor with explicit identifiers; store personal character settings and generated preview references per authenticated user via backend endpoints. Require authentication at the backend for both preview generation and personal assets, and preserve draft state while prompting for login.

**Tech stack:** Next.js, React, TypeScript, FastAPI, SQLAlchemy, PostgreSQL and the existing session authentication.

## Work and acceptance checks

1. **Personal assets and generation:** add a user-owned persistence model, schema, migration and authenticated CRUD routes; reject anonymous and cross-user requests. Require authentication at the preview endpoint and preserve existing rate limits. Verify isolation, input validation and authentication using focused API tests.
2. **Library:** add official and personal tabs, filtering, search, creation and edit navigation. Keep the full-body display, subtle stage, desktop hover action and touch-accessible edit action. Point the home entry at the library. Verify selection, empty and logged-out states.
3. **Editor:** organize existing settings by category without dropping supported fields. Keep the existing outfit cards and selections, upper/full-body preview, prompt copy and download. Preserve current draft during login, prevent anonymous generation and save, and show the black-and white indeterminate dot animation during generation.
4. **Integration:** exercise the route from the homepage through official selection, edit, authentication boundary, save, personal list and re-edit. Test failure/empty states and desktop/mobile light/dark presentation. Run relevant frontend and backend tests and type checking; review the resulting changes for security and integration regressions.

Do not submit, push or deploy as part of this task. Do not invoke a paid live image API during automated testing; mock the provider.
