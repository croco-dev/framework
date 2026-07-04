# @croco/metering-core

## 0.0.4

### Patch Changes

- 76bc0df: Bound the Redis usage storage local idempotency cache and prune expired entries during later writes so long-running processes do not retain stale record keys indefinitely.
- 997d84d: `RedisUsageStorage.resetBillingCycle(tenantId)` now deletes tenant-wide billing cycle usage with bounded Redis `SCAN` batches instead of blocking `KEYS`.
- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.
- dc5e4e9: Runtime boundary failures now expose stable Problem or diagnostic-coded errors instead of raw built-in Error throws.
- 4f24761: Restore Redis usage record timestamps from sorted set scores when records are fetched.
- Updated dependencies [2ceb6c4]
- Updated dependencies [ee924c0]
- Updated dependencies [5403360]
- Updated dependencies [e12e825]
- Updated dependencies [6831875]
- Updated dependencies [38727f9]
- Updated dependencies [b524ca3]
- Updated dependencies [a61dcd4]
- Updated dependencies [4c7fcd9]
- Updated dependencies [1dc1607]
- Updated dependencies [8c5b00c]
- Updated dependencies [48ce207]
- Updated dependencies [6c26eb4]
- Updated dependencies [f8842d3]
- Updated dependencies [d707a0c]
- Updated dependencies [9c2ac20]
- Updated dependencies [de7610e]
- Updated dependencies [14bd9f8]
- Updated dependencies [0618b12]
- Updated dependencies [41ee87a]
- Updated dependencies [c54e7b5]
- Updated dependencies [d1552a5]
- Updated dependencies [ac9118b]
  - @croco/events-core@0.0.4
  - @croco/framework-context@0.0.4
  - @croco/problems-core@0.0.4
  - @croco/framework-logger@0.0.4

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
