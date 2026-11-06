---
"@croco/warehouse-postgres": patch
---

Reject metric definitions bound to a different fact semantic hash before querying PostgreSQL, while preserving structural MetricFact inputs.
