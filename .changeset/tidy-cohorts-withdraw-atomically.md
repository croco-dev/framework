---
"@croco/cohort-drizzle": patch
---

Reject cohort rollback when its source publication is withdrawn before the new publication transaction, and serialize withdrawal with publication across PostgreSQL isolation levels.
