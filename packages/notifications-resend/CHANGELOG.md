# @croco/notifications-resend

## 0.0.4

### Patch Changes

- 106cae1: `@croco/notifications-core` now exposes deterministic preference evaluation, schema-validated template rendering with preview fixtures, required service-level preference/idempotency contracts, explicit dispatch/outbox metadata, and telemetry-backed delivery failure Problems.

  `@croco/notifications-resend` now declares its rendered-email dispatch capabilities.

  `@croco/invitation-core` now sends invitation notifications with explicit preference context and idempotency keys.

- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.
- ef36d33: Bound Resend batch sends so large batches preserve result ordering without dispatching every outbound request at once.
- 2ed6970: Resend provider now exposes safe readiness diagnostics, explicit failure taxonomy, redacted telemetry evidence, and an env-gated live smoke path for email send readiness.
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
- Updated dependencies [86298de]
- Updated dependencies [a61dcd4]
- Updated dependencies [9d6ef7c]
- Updated dependencies [106cae1]
- Updated dependencies [4c7fcd9]
- Updated dependencies [1dc1607]
- Updated dependencies [8c5b00c]
- Updated dependencies [48ce207]
- Updated dependencies [6c26eb4]
- Updated dependencies [f8842d3]
- Updated dependencies [d707a0c]
- Updated dependencies [aacdad6]
- Updated dependencies [9c2ac20]
- Updated dependencies [c1890a0]
- Updated dependencies [de7610e]
- Updated dependencies [14bd9f8]
- Updated dependencies [0618b12]
- Updated dependencies [41ee87a]
- Updated dependencies [c54e7b5]
- Updated dependencies [d1552a5]
- Updated dependencies [3ca4a69]
  - @croco/diagnostics-core@0.0.4
  - @croco/notifications-core@0.1.0
  - @croco/framework-context@0.0.4
  - @croco/retry-core@0.0.4
  - @croco/telemetry-api@0.1.0
  - @croco/problems-core@0.0.4

## 0.0.3

### Patch Changes

- 99f2a6b: fix: align CommonJS package export maps with emitted dist files
- Updated dependencies [99f2a6b]
- Updated dependencies [99f2a6b]
- Updated dependencies [99f2a6b]
  - @croco/framework-context@0.0.3
  - @croco/notifications-core@0.0.3
  - @croco/problems-core@0.0.3
  - @croco/retry-core@0.0.3
