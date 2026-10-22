---
"@croco/referral-core": patch
"@croco/referral-drizzle": patch
---

Persist rejected qualifications and duplicate claim holds before returning their Problems, preserving budget releases and audit records after PostgreSQL commits. Keep the first-valid winner through competing claims and prevent duplicate holds from qualifying.
