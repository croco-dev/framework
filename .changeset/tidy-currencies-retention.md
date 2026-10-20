---
"@croco/warehouse-postgres": patch
"@croco/problems-core": patch
---

Reject mixed-currency PostgreSQL metrics histories and baseline/movement currency mismatches before retention calculation, with an operator-only Problem identifying the tenant, period and movement field.
