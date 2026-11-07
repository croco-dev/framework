---
"@croco/etl-core": patch
"@croco/warehouse-postgres": patch
---

Load partition-local ETL input ranges with one durable write per batch and set-based PostgreSQL reads and inserts. Versioned run bindings keep chunk boundaries fixed during retry; earlier row-at-a-time runs require inspection and a new run. Preserve exact values, duplicate/conflict checks, current access and privacy fences, and uncertain-commit receipt reconciliation.
