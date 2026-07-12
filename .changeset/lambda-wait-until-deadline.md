---
"@croco/transports-http": patch
---

Drain transitively registered Lambda `waitUntil` work before responding, and fail with deterministic outstanding-task diagnostics when the invocation deadline prevents a stable drain.
