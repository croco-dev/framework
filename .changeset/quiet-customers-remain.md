---
"@croco/metrics-core": major
"@croco/problems-core": patch
"@croco/warehouse-postgres": major
---

Calculate logo churn from the starting cohort's customer losses. Replace positional starting and ending totals with `{ startingCustomers, churnedStartingCustomers }`. Treat `null` as unavailable when the cohort is empty or its losses cannot be established. PostgreSQL and TimescaleDB retention reads return `null` for logo churn because their stored metrics contain aggregate counts and amounts.
