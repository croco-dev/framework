---
"@croco/retry-core": minor
"@croco/problems-core": patch
"@croco/testing": patch
---

Allow retry templates, orchestrators, and decorated methods to stop before another attempt when their caller aborts, including while a backoff wait is pending. Custom backoff policies and injected sleepers must declare abort support; existing implementations should opt in after forwarding the signal, otherwise cancellation fails before callback invocation with `retry-core/backoff-cancellation-unsupported`.
