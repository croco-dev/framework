---
"@croco/analytics-core": patch
"@croco/analytics-drizzle": patch
"@croco/admin-core": patch
---

Preserve fractional seconds in Fact History effective intervals and carry the exact known-time cutoff into admin comparisons. Known-time cutoffs support up to six fractional-second digits, matching PostgreSQL receipt precision.
