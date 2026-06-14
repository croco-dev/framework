---
"@croco/metering-core": patch
---

`RedisUsageStorage.resetBillingCycle(tenantId)` now deletes tenant-wide billing cycle usage with bounded Redis `SCAN` batches instead of blocking `KEYS`.
