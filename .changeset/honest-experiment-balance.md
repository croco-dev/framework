---
"@croco/metrics-core": patch
---

Experiment reviews explain when balance SMD is undefined because the groups have different constant values or too few observations. The standalone SMD calculator reports these cases with `ExperimentInputProblem`. Identical constant groups with enough observations still return zero.
