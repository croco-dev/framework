---
"@croco/ratelimit-core": patch
"@croco/ratelimit-upstash": patch
"@croco/problems-core": patch
---

Reject invalid numeric rate-limit policies before enforcement, refunds or storage access, without hiding configuration errors behind fail-open fallback. Preserve fractional refill rates and existing pruning scheduler semantics.
