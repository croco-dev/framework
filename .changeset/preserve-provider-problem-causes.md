---
"@croco/auth-better-auth": patch
"@croco/auth-clerk": patch
"@croco/framework-logger": patch
"@croco/batch-qstash": patch
"@croco/metering-core": patch
"@croco/metering-upstash": patch
"@croco/ratelimit-upstash": patch
"@croco/tasks-qstash": patch
---

Preserve upstream Error identity and causal chains on provider Problems while keeping causes out of public Problem JSON. String failures retain their existing details without a synthetic Error cause.

Structured logs keep Problem message and stack diagnostics without expanding private upstream causes, including when another Error wraps the Problem. Ordinary Error cause diagnostics remain available.
