---
"@croco/retry-core": patch
---

Run configured recovery with the last upstream error when a circuit opens or the Lambda timeout guard stops retries. Without recovery, preserve the stopping Problem and attach the upstream error as its cause. Typed recovery handlers that do not match now follow normal exhaustion behavior: throw the upstream error, or RetryExhaustedProblem when wrapExhausted is enabled.
