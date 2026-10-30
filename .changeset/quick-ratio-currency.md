---
"@croco/metrics-core": patch
---

Quick Ratio rejects mixed currencies in new, expansion, churned and contraction MRR before calculation, including zero amounts, with the existing MixedCurrencyMRRProblem. Same-currency results and the null result for a zero denominator remain unchanged.
