# @croco/execution-drizzle

## 0.0.4

### Patch Changes

- 6e165ab: Expose a shared Drizzle provider conformance suite and record initial metering and execution provider evidence for schema, transaction, tenant, and deterministic error gates.
- 513188f: Drizzle-backed SaaS adapters now publish shared conformance evidence and redacted readiness diagnostics before beta maturity.
- 3f6dca0: Clear stale completion timestamps and previous-attempt errors when retried executions become active again.
- 595c786: Expose execution inspection logs and explicit failed-execution replay records, with Drizzle persistence for replay links and log history.
- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.
- 9187e8c: Keep retried workflow child executions consistent with completed parent workflows.
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
