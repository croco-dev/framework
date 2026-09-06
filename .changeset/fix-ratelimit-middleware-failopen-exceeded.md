---
"@croco/ratelimit-core": patch
---

Ensure `createRateLimitMiddleware` throws `RateLimitExceededProblem` whenever `result.success` is false, preventing `failOpen: true` from bypassing rate limit enforcement on quota exhaustion.
