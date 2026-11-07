---
"create-croco-app": patch
"@croco/esbuild-plugin": patch
---

Next.js-hosted tRPC development regenerates the compiled DI graph after service and configuration edits, rejects invalid or stale graphs, and disposes replaced application scopes after active callbacks finish.
