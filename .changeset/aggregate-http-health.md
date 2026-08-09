---
"@croco/transports-http": minor
---

Make the aggregate `/health` endpoint report registered dependency health with sanitized details and
a 503 response for failed or timed-out checks, while preserving `/health/live` as dependency-independent
process liveness.
