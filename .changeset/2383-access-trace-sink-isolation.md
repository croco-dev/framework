---
"@croco/access-core": patch
"@croco/problems-core": patch
---

AccessEngine isolates trace sink failures so a rejecting audit sink no longer turns an allow decision into an error. Sink failures are reported through access.observability-delivery-failed telemetry with sanitized error identity.
