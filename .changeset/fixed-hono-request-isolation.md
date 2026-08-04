---
"@croco/transports-http": patch
"@croco/preset-node": patch
"@croco/preset-lambda": patch
---

Require the fixed Hono release for HTTP and Lambda consumers so packed packages cannot resolve the affected request-isolation and repeated-header behavior.
