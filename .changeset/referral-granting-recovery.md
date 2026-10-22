---
"@croco/referral-core": patch
"@croco/referral-drizzle": patch
---

Resume interrupted referral benefit grants with the original idempotency key and attempt-fenced state transitions. Reconciliation finishes pending sides without repeating confirmed grants or releasing unknown-outcome budgets. Custom referral stores must enforce the optional fulfillment attempt predicate atomically with status.
