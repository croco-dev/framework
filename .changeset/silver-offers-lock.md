---
"@croco/promotions-drizzle": patch
---

Concurrent offer reservations preserve one budget reservation per logical claim and enforce scoped subject limits and stacking conflicts across policies. Transactions use READ COMMITTED and transaction advisory locks; drain older writers during rollout before relying on the new admission locks.
