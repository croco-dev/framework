---
"@croco/diagnostics-core": patch
"@croco/problems-core": patch
"@croco/transports-http": patch
---

Make HTTP middleware short-circuit semantics explicit with a `shortCircuit(reason)` marker, stable middleware diagnostics, and runtime inspection details for short-circuit outcomes.

The legacy `transports-http/middleware-next-called-multiple-times` compatibility code now maps to the new `CROCO_HTTP_MIDDLEWARE_002` multiple-next diagnostic and is classified as not retryable.
