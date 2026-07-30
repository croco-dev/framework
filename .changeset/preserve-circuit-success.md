---
"@croco/retry-core": patch
---

Preserve successful protected-operation results when circuit breaker success bookkeeping fails, and report the degraded state through telemetry without incrementing failure counters.
