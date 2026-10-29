---
"@croco/referral-core": patch
---

Reject reuse of a referral link ID with a different token hash in the in-memory store, preserving the original link and matching the PostgreSQL conflict behavior.
