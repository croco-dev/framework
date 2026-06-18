---
"@croco/transports-http": patch
---

HTTP request telemetry now wraps controller execution, Problem responses include trace/request metadata, middleware short-circuit responses keep their intended status, and Lambda handlers can run an explicit flush callback before returning.
