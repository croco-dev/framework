---
"@croco/ratelimit-core": patch
---

Return the configured rate-limit policy name in `RateLimitResult.policyName` across healthy, refund, and degraded paths instead of returning the policy algorithm.
