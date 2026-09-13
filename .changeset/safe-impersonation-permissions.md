---
"@croco/auth-core": patch
"@croco/impersonation-core": patch
---

Treat missing or malformed permission collections as denied so impersonation management requests return the standard
forbidden response instead of crashing.
