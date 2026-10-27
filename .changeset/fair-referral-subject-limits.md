---
"@croco/referral-core": patch
"@croco/referral-drizzle": patch
---

Enforce family/cycle subject limits atomically when preclaimed referrals qualify, preventing competing benefits from exceeding receipt limits. PostgreSQL retains subject admission locks through transaction end with fresh committed counts. Ordering and counts use canonical identity fields so extra subject metadata cannot fragment receipt limits or invert lock order. Deploy the updated service and store together after draining older writers; no schema migration is required.
