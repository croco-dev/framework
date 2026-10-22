---
"@croco/promotions-core": patch
"@croco/referral-core": patch
---

Discard all in-memory transaction writes when the callback fails, preserving committed budgets, claims, attribution indexes and audit trails. Publish isolated transaction state only after success while retaining serialized execution.
