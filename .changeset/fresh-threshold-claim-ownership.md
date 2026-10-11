---
"@croco/lifecycle-core": patch
---

Give each threshold claim a fresh ownership token so stale release and acknowledgement calls cannot affect a replacement lease, while preserving signal identity across retries.
