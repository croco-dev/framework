---
"@croco/referral-core": minor
"@croco/referral-drizzle": minor
"@croco/problems-core": patch
---

Referral recovery can resume from the last processed page and reach payout work beyond the first 1,000 pending attributions. Applications can narrow a sweep by scope and recovery state in memory and on PostgreSQL with UTF-8 database and client encodings.

On UTF-8 PostgreSQL databases, migration `0002_referral_recovery_order` lets recovery pages seek from the cursor using an ordered index.
