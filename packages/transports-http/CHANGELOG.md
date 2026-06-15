# @croco/transports-http

## 1.0.0

### Major Changes

- c0c7215: Return the canonical `@croco/health-core` readiness contract from HTTP health endpoints.

  `/ready` and `/health/ready` now return `{ status: "up" | "down", results: [...] }` instead of the previous transport-local `{ status: "ok" | "error", checks: ... }` body shape.

### Patch Changes

- 51b0f14: - fix: make benchmark gate evidence enforce-ready
- da861c8: Expose instance-bound graceful shutdown controllers so multiple HTTP apps in one process can shut down independently without sharing request rejection state.
- 42bc50e: HTTP telemetry middleware now records and logs degraded setup failures while preserving fallback request handling.
- 8a85c6a: Formalize HTTP operational endpoint contracts and diagnostics exposure policy while routing HTTP readiness execution through `@croco/health-core`.
- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.
- 41ee87a: Expose a request-scoped `RuntimeContext` contract for Node, AWS Lambda, and Cloudflare Workers runtime metadata.
- 7442f1c: `CrocoApp.listen()` now installs its Node server adapter dependency in production installs.
- bc5594d: Declare zod as a runtime dependency so exported ParamResolver declarations resolve in clean installs.
- Updated dependencies [2ceb6c4]
- Updated dependencies [2631037]
- Updated dependencies [2f0dae2]
- Updated dependencies [ddfc6d1]
- Updated dependencies [38727f9]
- Updated dependencies [a61dcd4]
- Updated dependencies [8a85c6a]
- Updated dependencies [d707a0c]
- Updated dependencies [d117fca]
- Updated dependencies [cac7e99]
- Updated dependencies [aacdad6]
- Updated dependencies [1489bfa]
- Updated dependencies [41ee87a]
- Updated dependencies [d1552a5]
  - @croco/events-core@0.0.4
  - @croco/protocols-core@0.0.4
  - @croco/diagnostics-core@0.0.4
  - @croco/framework-context@0.0.4
  - @croco/health-core@0.0.4
  - @croco/framework-logger@0.0.4
  - @croco/problems-core@0.0.4
  - @croco/protocols-rest@0.0.4
  - @croco/ratelimit-core@0.0.4

## 0.0.3

### Patch Changes

- 99f2a6b: add self-diagnosing subsystem (@croco/diagnostics-core)
- 99f2a6b: fix: align CommonJS package export maps with emitted dist files
- 99f2a6b: fix: resolve component singleton DI and HTTP telemetry status mapping bugs
- 99f2a6b: raise runtime dependency floors to patched security releases
- Updated dependencies [99f2a6b]
- Updated dependencies [99f2a6b]
- Updated dependencies [99f2a6b]
  - @croco/diagnostics-core@0.0.3
  - @croco/events-core@0.0.3
  - @croco/framework-context@0.0.3
  - @croco/framework-logger@0.0.3
  - @croco/problems-core@0.0.3
  - @croco/protocols-core@0.0.3
  - @croco/protocols-rest@0.0.3
  - @croco/ratelimit-core@0.0.3
