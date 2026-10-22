---
"@croco/ratelimit-core": patch
"@croco/ratelimit-upstash": patch
---

Legacy fixed-window policies enforce Redis quotas and support receipt-based refunds just like explicit fixed policies. Malformed algorithms and mixed policy fields fail validation before storage access; actual Redis failures retain the existing fail-open behavior.
