---
"@croco/retry-core": patch
"@croco/problems-core": patch
---

Reject invalid retry, circuit-breaker, Lambda deadline, and Redis TTL numeric configuration before state or I/O side effects.
`INVALID_RETRY_CONFIGURATION` is now a non-retryable `ValidationError` (HTTP 422 instead of 500) and exposes only
the option name, constraint, and string-form received value as diagnostic metadata.
