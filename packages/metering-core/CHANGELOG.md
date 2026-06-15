# @croco/metering-core

## 0.0.4

### Patch Changes

- 76bc0df: Bound the Redis usage storage local idempotency cache and prune expired entries during later writes so long-running processes do not retain stale record keys indefinitely.
- 997d84d: `RedisUsageStorage.resetBillingCycle(tenantId)` now deletes tenant-wide billing cycle usage with bounded Redis `SCAN` batches instead of blocking `KEYS`.
- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.
- 4f24761: Restore Redis usage record timestamps from sorted set scores when records are fetched.
- Updated dependencies [2ceb6c4]
- Updated dependencies [38727f9]
- Updated dependencies [a61dcd4]
- Updated dependencies [d707a0c]
- Updated dependencies [41ee87a]
- Updated dependencies [d1552a5]
  - @croco/events-core@0.0.4
  - @croco/framework-context@0.0.4
  - @croco/framework-logger@0.0.4
  - @croco/problems-core@0.0.4

## 0.0.3

### Patch Changes

- 99f2a6b: fix: align CommonJS package export maps with emitted dist files
- Updated dependencies [99f2a6b]
- Updated dependencies [99f2a6b]
- Updated dependencies [99f2a6b]
  - @croco/events-core@0.0.3
  - @croco/framework-context@0.0.3
  - @croco/framework-logger@0.0.3
  - @croco/problems-core@0.0.3
