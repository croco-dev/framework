---
"@croco/metrics-core": major
"@croco/metrics-billing": major
"@croco/warehouse-postgres": patch
"@croco/problems-core": patch
---

Preserve distinct billing movements that share a timestamp by separating legacy primary-key lookups from claimed event identities. Event replay and shared cancellation/revocation churn remain idempotent.

MetricsRepository providers must explicitly implement movement identity version 2. Upgrade warehouse-postgres with metrics-core and metrics-billing, or implement tenant-scoped historical-primary lookups in custom providers before declaring version 2. BillingEventHandler rejects unsupported providers at construction before recording events.
