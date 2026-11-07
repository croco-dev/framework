---
"@croco/retry-core": patch
---

Evaluate custom retry policies once per actual failed attempt without synthetic previous or zero attempts. Policies that reject the final attempt because of their budget can provide `isRetryable(error)` to retain exhaustion recovery; absent or false classification propagates the original failure. Default retry classification, exhaustion and recovery remain intact.
