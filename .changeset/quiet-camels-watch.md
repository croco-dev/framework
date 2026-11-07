---
"create-croco-app": patch
"@croco/esbuild-plugin": patch
"@croco/problems-core": patch
---

Next.js-hosted tRPC development regenerates the compiled DI graph after service and configuration edits, rejects invalid or stale graphs, and disposes replaced application scopes after active callbacks finish.

The Problem registry includes `CROCO_DI_DEVELOPMENT_UNAVAILABLE` for failed or stale development graphs.
