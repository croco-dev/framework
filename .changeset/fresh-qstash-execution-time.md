---
"@croco/triggers-qstash": patch
---

Record each cron execution's processing time in its metadata. Preserve the schedule sync timestamp in the immutable execution payload and webhook passed to the target so repeated deliveries retain their idempotency identity.
