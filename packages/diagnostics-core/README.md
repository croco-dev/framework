# @croco/diagnostics-core

Stable diagnostic collection and message formatting for Croco packages.

`@croco/diagnostics-core` centralizes diagnostic codes, source locations, provider
reports, and short error-history capture so package readiness and runtime health can be
reported without ad hoc strings.

## Public API

- `DiagnosticsCollector` - registers providers and collects readiness reports.
- `DiagnosticsHealthIndicator` - exposes one diagnostics provider through health readiness checks
  with an explicit degraded-status policy.
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

Install `@croco/health-core` when registering `DiagnosticsHealthIndicator` with `HealthCheckService`.
It is an optional peer dependency, so diagnostics-only consumers do not need to install the health package.

```typescript
import { HealthCheckService } from "@croco/health-core";
import { DiagnosticsCollector, DiagnosticsHealthIndicator } from "@croco/diagnostics-core";

const collector = new DiagnosticsCollector();
const health = new HealthCheckService();
const provider = {
  name: "cache",
  getHealth: async (signal?: AbortSignal) => ({
    status: "healthy" as const,
    component: "cache",
    details: { connected: true },
    lastChecked: new Date().toISOString(),
  }),
};

collector.registerProvider(provider);
health.registerReadiness(new DiagnosticsHealthIndicator(provider, { degradedStatus: "down" }));

const diagnosticsReport = await collector.getReport();
const readinessReport = await health.checkReadiness();
```

`degradedStatus` is required because diagnostics has a three-state vocabulary while health has
only `up` and `down`. The adapter forwards the caller's `AbortSignal` and preserves the provider's
component name, message, details, and `lastChecked` timestamp.

## Verification

```bash
pnpm --filter @croco/diagnostics-core test
pnpm --filter @croco/diagnostics-core typecheck
```
