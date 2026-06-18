---
"@croco/rpc-codegen": patch
"create-croco-app": patch
---

Generated RPC clients now expose a package barrel, preserve JSON-safe literal/enum/union/record schema types, and fail generation for unsupported Zod schemas instead of widening contracts through implicit fallback types.
