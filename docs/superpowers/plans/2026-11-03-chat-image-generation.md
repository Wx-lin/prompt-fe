# Chat Image Generation Implementation Plan

**Goal:** Add real image generation and follow-up editing to the existing private creation conversation.

**Architecture:** Extend the existing durable conversation turn with an explicit `image` mode, store generated images as private owned assets, and render those turns in the existing sidebar. Reuse parent revisions, idempotency, worker recovery and history; never automatically redispatch an uncertain paid request.

**Tech stack:** Next.js, React, TypeScript, FastAPI, PostgreSQL, Redis, private COS and the existing server-side OpenAI image configuration.

## Work and acceptance checks

1. Add failing tests for image-mode requests, queued and successful turns, private output ownership, image edit references, deletion and cleanup. Implement generation and editing through fixed server-side provider endpoints, with output persistence and protected dispatch.
2. Add failing tests for the browser client and proxy contract, including rejection of malformed or unsafe image URLs. Render generation progress, generated images, image preview and download, errors and follow-up messages within the existing conversation; preserve old prompt and chat behavior.
3. Exercise old and new conversation paths, identity isolation, history restoration and uncertain-request handling. Run relevant automated tests, type checks and desktop/mobile browser checks. Mock image providers during automated validation; do not issue paid live requests.
4. Review the combined change and report configuration, migration and live-provider verification limitations. Do not commit, push or deploy as part of this work.
