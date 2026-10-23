---
"@croco/testing": patch
---

Contract fuzzing reports unsupported automatic generation instead of hanging when a body schema accepts every JSON candidate, while retaining invalid cases from other input groups and caller-owned arbitraries.
