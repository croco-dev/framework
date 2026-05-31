---
"@croco/telemetry-sdk-node": patch
---

fix(telemetry-sdk-node): fix Problem constructor args and forceFlush/reset bugs

- Fix Problem constructor arg order in SamplerProblem, OtlpEndpointRequiredProblem, TelemetryRuntimeProblem to properly set detail field
- Change forceFlush flushedSpans from 0 to -1 to indicate unknown count (BatchSpanProcessor API limitation)
- Fix reset() type safety by using null instead of undefined as unknown as TelemetryRuntime
