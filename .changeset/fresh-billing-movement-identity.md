---
"@croco/metrics-core": patch
"@croco/metrics-billing": patch
"@croco/warehouse-postgres": patch
"@croco/problems-core": patch
---

Preserve distinct billing movements that share a timestamp by separating legacy primary-key lookups from claimed event identities. Event replay and shared cancellation/revocation churn remain idempotent.
