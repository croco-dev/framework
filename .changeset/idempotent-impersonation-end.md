---
"@croco/impersonation-core": major
"@croco/problems-core": patch
---

Make impersonation end requests idempotent for the original actor by retaining the canonical committed end intent after publication. Custom impersonation stores must implement `findCommittedEndIntent()` and preserve the committed end record for retries.
