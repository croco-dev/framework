---
"@croco/preset-cloudflare": minor
"create-croco-app": minor
"@croco/problems-core": patch
"@croco/esbuild-plugin": patch
---

Run Cloudflare Cron declarations through native scheduled callbacks with application-owned DI and common task execution semantics. Generated Workers validate UTC schedules and refuse stale Wrangler output before deployment.
Collect metadata in local workerd for Worker-only imports, validate named-environment schedules, preserve CRLF ownership blocks, and bind execution recovery to its original provider and method.
