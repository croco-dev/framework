---
"@croco/retry-core": patch
"@croco/problems-core": patch
---

Prevent failed success hooks from retrying an already successful callback, and expose the committed callback state through `RetrySuccessHookProblem`.
