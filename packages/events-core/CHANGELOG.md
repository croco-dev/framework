# @croco/events-core

## 0.0.4

### Patch Changes

- 2ceb6c4: - Stabilize parallel EventPublisher validation under CI timer variance.
- 38727f9: Reset active event bus subscriptions on bus replacement so restart resolves handlers against the current lifecycle.
- b524ca3: Deserialized events now preserve the serialized event id and occurrence timestamp across event-field and fromPayload reconstruction paths.
- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.
- ac9118b: Add a first-class Croco application testing harness with HTTP, event dispatch, request context, transaction, and telemetry helpers, and generate an API sample test that uses it.
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
- Updated dependencies [3ca4a69]
  - @croco/diagnostics-core@0.0.4
  - @croco/framework-context@0.0.4
  - @croco/problems-core@0.0.4

## 0.0.3

### Patch Changes

- 99f2a6b: add self-diagnosing subsystem (@croco/diagnostics-core)
- 99f2a6b: fix: align CommonJS package export maps with emitted dist files
- Updated dependencies [99f2a6b]
- Updated dependencies [99f2a6b]
- Updated dependencies [99f2a6b]
  - @croco/diagnostics-core@0.0.3
  - @croco/framework-context@0.0.3
  - @croco/problems-core@0.0.3
