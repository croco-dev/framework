---
"@croco/audit-core": patch
---

Sanitize interceptor audit payloads and HTTP metadata before persistence, and preserve successful handler responses when audit storage fails while recording the failure through telemetry.
