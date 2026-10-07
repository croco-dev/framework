---
"@croco/billing-core": patch
---

Money multiplication and division accept finite decimal rates whose intermediate ratios exceed safe integer limits, while preserving rounding modes and rejecting unsafe final amounts.
