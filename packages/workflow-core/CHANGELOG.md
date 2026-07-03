# @croco/workflow-core

## 0.0.1

### Patch Changes

- 96a8bb4: Introduce a workflow-core package that binds trigger metadata to task workflows, records parent workflow executions with child task execution metadata, resumes retrying idempotent workflow executions, emits workflow telemetry spans/events, and exposes workflow execution status through diagnostics.
- 9187e8c: Keep retried workflow child executions consistent with completed parent workflows.
- d167641: Expose saga workflows with typed step state, retry/idempotency metadata, compensation tracking, in-memory execution state, replay, outbox hooks, and step-level telemetry.
- Updated dependencies [4d8f094]
- Updated dependencies [6769a7f]
- Updated dependencies [d281518]
- Updated dependencies [0b43229]
- Updated dependencies [ee924c0]
- Updated dependencies [5403360]
- Updated dependencies [e12e825]
- Updated dependencies [6831875]
- Updated dependencies [9cd8667]
- Updated dependencies [2f0dae2]
- Updated dependencies [ddfc6d1]
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
- Updated dependencies [3ca4a69]
- Updated dependencies [b203ff8]
- Updated dependencies [96a8bb4]
- Updated dependencies [9187e8c]
  - @croco/diagnostics-core@0.0.4
  - @croco/framework-context@0.0.4
  - @croco/execution-core@0.0.4
  - @croco/telemetry-api@0.1.0
  - @croco/problems-core@0.0.4
  - @croco/triggers-core@0.0.4
  - @croco/tasks-core@0.0.4
