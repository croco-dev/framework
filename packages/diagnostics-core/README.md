# @croco/diagnostics-core

Stable diagnostic collection and message formatting for Croco packages.

`@croco/diagnostics-core` centralizes diagnostic codes, source locations, provider
reports, and short error-history capture so package readiness and runtime health can be
reported without ad hoc strings.

## Public API

- `DiagnosticsCollector` - registers providers and collects readiness reports.
- `ErrorHistoryRingBuffer` - bounded error history for diagnostics output.
- Diagnostic code helpers - validate, format, and describe stable Croco diagnostic
  codes.
- `DuplicateDiagnosticsProviderProblem` - Problem emitted for duplicate provider
  registration.
- `InvalidDiagnosticsTimeoutProblem` - Problem emitted when a default or per-provider
  timeout is outside the safe Node.js timer range.

Default and per-provider timeouts must be integer milliseconds between `1` and
`2_147_483_647`. Invalid values fail during setup before a provider check runs.

## Usage

```typescript
import { DiagnosticsCollector } from "@croco/diagnostics-core";

const collector = new DiagnosticsCollector();
collector.registerProvider({
  name: "cache",
  collect: async () => ({ status: "ready", details: {} }),
});

const report = await collector.collect();
```

## Verification

```bash
pnpm --filter @croco/diagnostics-core test
pnpm --filter @croco/diagnostics-core typecheck
```
