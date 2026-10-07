---
"@croco/protocols-core": patch
"@croco/transports-http": patch
---

Reject routes with the same HTTP method and matching path template even when parameter names differ. HTTP bootstrap and contract generation report both conflicting authored routes, preventing unreachable handlers and identical OpenAPI paths.
