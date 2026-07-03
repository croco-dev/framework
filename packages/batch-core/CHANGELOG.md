# @croco/batch-core

## 0.0.4

### Patch Changes

- aee8d39: Keep batch retry progress cumulative after checkpoint restore and surface classifier failures with a stable failure-classification code.
- c3cb144: Allow batch steps to mark thrown chunk failures as non-retryable while preserving retryable defaults.
- af9f355: - Expose Jobs v1 operations for listing, inspecting, logging, cancelling, and replaying executions.
  - Add `croco jobs` commands for Jobs v1 operator inspection and recovery flows.
  - Support QStash schedule sync dry-runs before applying schedule changes.
  - Make batch chunk execution completion explicit for multi-step checkpoint flows.
  - Include a smoke-tested billing sync background job in the SaaS app preset.
- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.
- Updated dependencies [3f6dca0]
- Updated dependencies [595c786]
- Updated dependencies [3c29e42]
- Updated dependencies [af9f355]
- Updated dependencies [d707a0c]
- Updated dependencies [9187e8c]
  - @croco/execution-core@0.0.4

## 0.0.3

### Patch Changes

- 99f2a6b: fix: align CommonJS package export maps with emitted dist files
- Updated dependencies [99f2a6b]
  - @croco/execution-core@0.0.3
