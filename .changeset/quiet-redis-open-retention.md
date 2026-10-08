---
"@croco/retry-core": patch
---

Keep Redis circuit breakers OPEN for the configured open duration before allowing HALF_OPEN probes, even when the duration exceeds the store TTL.
