# @croco/execution-core

## 0.0.4

### Patch Changes

- 3f6dca0: Clear stale completion timestamps and previous-attempt errors when retried executions become active again.
- 595c786: Expose execution inspection logs and explicit failed-execution replay records, with Drizzle persistence for replay links and log history.
- 3c29e42: Retryable execution failures now honor the lifecycle transition contract before entering `retrying`.
- af9f355: - Expose Jobs v1 operations for listing, inspecting, logging, cancelling, and replaying executions.
  - Add `croco jobs` commands for Jobs v1 operator inspection and recovery flows.
  - Support QStash schedule sync dry-runs before applying schedule changes.
  - Make batch chunk execution completion explicit for multi-step checkpoint flows.
  - Include a smoke-tested billing sync background job in the SaaS app preset.
- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.
- 9187e8c: Keep retried workflow child executions consistent with completed parent workflows.
- Updated dependencies [1dc1607]
- Updated dependencies [8c5b00c]
- Updated dependencies [48ce207]
- Updated dependencies [6c26eb4]
- Updated dependencies [f8842d3]
- Updated dependencies [d707a0c]
  - @croco/problems-core@0.0.4

## 0.0.3

### Patch Changes

- 99f2a6b: fix: align CommonJS package export maps with emitted dist files
- Updated dependencies [99f2a6b]
  - @croco/problems-core@0.0.3
