---
"@croco/referral-core": patch
"@croco/referral-drizzle": patch
---

Resume interrupted referral benefit grants with the original idempotency key and attempt-fenced state transitions. Reconciliation finishes pending sides without repeating confirmed grants or releasing unknown-outcome budgets. Late grants after terminal operator decisions remain visible in the audit trail without overwriting settlement or budget accounting. Custom referral stores must enforce the optional fulfillment attempt predicate atomically with status.
