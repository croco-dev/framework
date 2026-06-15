# @croco/tx-core

## 0.0.4

### Patch Changes

- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.
- 844234f: Transaction timeout aborts now carry the reported timeout Problem through the abort signal, and Drizzle transactions/savepoints roll back promptly while blocking later transaction-client calls after timeout.
- Updated dependencies [a61dcd4]
- Updated dependencies [d707a0c]
- Updated dependencies [41ee87a]
- Updated dependencies [d1552a5]
  - @croco/framework-context@0.0.4
  - @croco/framework-logger@0.0.4
  - @croco/problems-core@0.0.4
  - @croco/telemetry-api@0.0.4

## 0.0.3

### Patch Changes

- 99f2a6b: fix: align CommonJS package export maps with emitted dist files
- Updated dependencies [99f2a6b]
- Updated dependencies [99f2a6b]
- Updated dependencies [99f2a6b]
  - @croco/framework-context@0.0.3
  - @croco/framework-logger@0.0.3
  - @croco/problems-core@0.0.3
  - @croco/telemetry-api@0.0.3
