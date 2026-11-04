# Character assets

The four `public/character-*` asset directories remain in Git for local development and rollback, but are not included in production release archives. Production uses the COS prefix in `src/lib/character-assets.json`.

When changing those assets, upload every file from the intended Git revision to a **new versioned prefix** with the same directory structure under `public/` and a lowercase SHA-256 in COS object metadata `x-cos-meta-sha256`. Update `character-assets.json` to the new prefix in the same change. The deploy workflow checks every committed file's public HEAD response, byte size and SHA-256 metadata before it builds or switches production. Transient network, 429, or 5xx failures are retried up to three times; missing or inconsistent assets block release; the check does not upload or modify COS. To run it manually, use `node deploy/verify-character-assets.mjs <full-git-commit-sha>`.
