# @croco/telemetry-sdk-node

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
