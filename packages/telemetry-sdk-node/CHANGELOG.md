# @croco/telemetry-sdk-node

## 0.0.4

### Patch Changes

- 51b0f14: - fix: make benchmark gate evidence enforce-ready
- 9b96933: - fix: preserve telemetry instrumentation type dependency
- 40b024d: Keep published package entrypoints importable by generating advertised declaration files, declaring public runtime and type dependencies on the install surface, deferring Clerk webhook peer loading until webhook handling is used, preserving concrete customer health injection tokens in built output, no longer advertising CommonJS entrypoints that cannot load ESM-only peers, and keeping the migration CLI parser behind binary execution.
- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.
- ad2e4f3: Allow telemetry runtime initialization after an earlier disabled init stores config without starting the SDK.
- Updated dependencies [4d8f094]
- Updated dependencies [6769a7f]
- Updated dependencies [d281518]
- Updated dependencies [0b43229]
- Updated dependencies [9cd8667]
- Updated dependencies [2f0dae2]
- Updated dependencies [ddfc6d1]
- Updated dependencies [1dc1607]
- Updated dependencies [8c5b00c]
- Updated dependencies [48ce207]
- Updated dependencies [6c26eb4]
- Updated dependencies [f8842d3]
- Updated dependencies [d707a0c]
- Updated dependencies [14bd9f8]
- Updated dependencies [3ca4a69]
  - @croco/diagnostics-core@0.0.4
  - @croco/problems-core@0.0.4

## 0.0.3

### Patch Changes

- 99f2a6b: add self-diagnosing subsystem (@croco/diagnostics-core)
- 99f2a6b: fix: align CommonJS package export maps with emitted dist files
- 99f2a6b: fix(telemetry-sdk-node): fix Problem constructor args and forceFlush/reset bugs
  - Fix Problem constructor arg order in SamplerProblem, OtlpEndpointRequiredProblem, TelemetryRuntimeProblem to properly set detail field
  - Change forceFlush flushedSpans from 0 to -1 to indicate unknown count (BatchSpanProcessor API limitation)
  - Fix reset() type safety by using null instead of undefined as unknown as TelemetryRuntime

- 99f2a6b: raise runtime dependency floors to patched security releases
- Updated dependencies [99f2a6b]
- Updated dependencies [99f2a6b]
  - @croco/diagnostics-core@0.0.3
  - @croco/problems-core@0.0.3
