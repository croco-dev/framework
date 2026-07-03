# @croco/tasks-core

## 0.0.4

### Patch Changes

- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.
- b203ff8: TaskRegistry constructor input now rejects conflicting duplicate task names with the same policy as manual and metadata registration.
- 96a8bb4: Introduce a workflow-core package that binds trigger metadata to task workflows, records parent workflow executions with child task execution metadata, resumes retrying idempotent workflow executions, emits workflow telemetry spans/events, and exposes workflow execution status through diagnostics.
- 9187e8c: Keep retried workflow child executions consistent with completed parent workflows.
- Updated dependencies [ee924c0]
- Updated dependencies [5403360]
- Updated dependencies [e12e825]
- Updated dependencies [6831875]
- Updated dependencies [3f6dca0]
- Updated dependencies [595c786]
- Updated dependencies [3c29e42]
- Updated dependencies [a61dcd4]
- Updated dependencies [9d6ef7c]
- Updated dependencies [af9f355]
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
- Updated dependencies [9187e8c]
  - @croco/framework-context@0.0.4
  - @croco/execution-core@0.0.4
  - @croco/telemetry-api@0.1.0
  - @croco/problems-core@0.0.4

## 0.0.3

### Patch Changes

- 99f2a6b: fix: align CommonJS package export maps with emitted dist files
- Updated dependencies [99f2a6b]
- Updated dependencies [99f2a6b]
- Updated dependencies [99f2a6b]
  - @croco/framework-context@0.0.3
  - @croco/execution-core@0.0.3
  - @croco/problems-core@0.0.3
  - @croco/telemetry-api@0.0.3
