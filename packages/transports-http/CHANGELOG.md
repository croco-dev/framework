# @croco/transports-http

## 0.0.4

### Patch Changes

- 4d8f094: - Generated REST/Lambda and Cloudflare worker apps now bootstrap with the required HTTP security middleware instead of disabling security validation.
  - Missing required HTTP security middleware now fails with `CROCO_HTTP_SECURITY_001` while preserving the previous slash-form code as `legacyCode`.
- 6769a7f: - fix: enforce core coverage spine baseline
- 51b0f14: - fix: make benchmark gate evidence enforce-ready
- a77425f: - Expand strict contract typecheck coverage to REST, OpenAPI, RPC codegen, and HTTP transport package configs.
- 6148ed3: Expose a canonical REST contract graph with route diagnostics and add a contract check path before OpenAPI and RPC client generation.
- ee924c0: Expose an opt-in local Dev Inspector that shows redacted request runtime timelines, DI snapshots, event handling, retry attempts, and Problem outcomes.
- 5403360: HTTP apps now expose a DI bootstrap validation policy that fails fast by default, with explicit warn/off migration modes for legacy unregistered providers.
- da861c8: Expose instance-bound graceful shutdown controllers so multiple HTTP apps in one process can shut down independently without sharing request rejection state.
- e108899: HTTP compression middleware now returns encoded response bytes whenever it advertises `Content-Encoding`, while preserving threshold, content type, and error-response skip behavior.
- c0c7215: Return the canonical `@croco/health-core` readiness contract from HTTP health endpoints.

  `/ready` and `/health/ready` now return `{ status: "up" | "down", results: [...] }` instead of the previous transport-local `{ status: "ok" | "error", checks: ... }` body shape.

- 42bc50e: HTTP telemetry middleware now records and logs degraded setup failures while preserving fallback request handling.
- 9f7e769: Fix Lambda event/context helpers to read the Lambda execution env from the Hono context passed through Croco raw route parameters.
- 000e999: HTTP request telemetry now wraps controller execution, Problem responses include trace/request metadata, middleware short-circuit responses keep their intended status, and Lambda handlers can run an explicit flush callback before returning.
- 8a85c6a: Formalize HTTP operational endpoint contracts and diagnostics exposure policy while routing HTTP readiness execution through `@croco/health-core`.
- 9556d22: Add CI-oriented operational checks with token-guarded diagnostics smoke coverage and app-provided diagnostics provider registration.
- f40eb63: Expose canonical operations endpoints and add `croco ops status` for machine-readable and human-readable runtime status checks.
- b6449cc: HTTP runtime packages now require a patched Hono range so production dependency audits do not include known high-severity Hono advisories.
- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.
- 58b689a: HTTP rate-limit outcome skip flags now refund successful limiter checks so skipped success or failure responses do not consume quota, with core and Upstash stores exposing the matching refund contract.
- eeebc70: Rate-limit 429 Problem responses now include retry and quota headers when headers are enabled.
- 9c2ac20: Expose deterministic request pipeline execution graphs with middleware, guard, policy, interceptor, handler, and filter phases.
- de7610e: Runtime context capability support is now exposed as a shared type-level matrix, and unsupported runtime/capability combinations fail typecheck or runtime context creation instead of degrading silently.
- 14bd9f8: - Runtime capability manifests can now be emitted and compared for Node, Lambda, and Cloudflare Workers with deterministic `RuntimeCapabilityManifest v1` output.
  - Unsupported runtime capability use now carries the stable `CROCO_RUNTIME_CAPABILITY_001` diagnostic context.
  - Generated apps now write `croco-runtime-capability.manifest.json`, and doctor/smoke checks validate the manifest for supported runtime targets.
- 0618b12: Runtime capability support now includes explicit filesystem, Node API, and request lifecycle flags for Node, Lambda, and Cloudflare Workers request contexts.
- 41ee87a: Expose a request-scoped `RuntimeContext` contract for Node, AWS Lambda, and Cloudflare Workers runtime metadata.
- 7442f1c: `CrocoApp.listen()` now installs its Node server adapter dependency in production installs.
- bc5594d: Declare zod as a runtime dependency so exported ParamResolver declarations resolve in clean installs.
- Updated dependencies [4d8f094]
- Updated dependencies [6769a7f]
- Updated dependencies [d281518]
- Updated dependencies [ea14bd4]
- Updated dependencies [2ceb6c4]
- Updated dependencies [73e430a]
- Updated dependencies [a77425f]
- Updated dependencies [2631037]
- Updated dependencies [529c7fd]
- Updated dependencies [f3951f3]
- Updated dependencies [6148ed3]
- Updated dependencies [779fa6f]
- Updated dependencies [988f072]
- Updated dependencies [0b43229]
- Updated dependencies [ee924c0]
- Updated dependencies [5403360]
- Updated dependencies [e12e825]
- Updated dependencies [6831875]
- Updated dependencies [9cd8667]
- Updated dependencies [2f0dae2]
- Updated dependencies [ddfc6d1]
- Updated dependencies [9c1bc2e]
- Updated dependencies [38727f9]
- Updated dependencies [b524ca3]
- Updated dependencies [a61dcd4]
- Updated dependencies [8a85c6a]
- Updated dependencies [4c7fcd9]
- Updated dependencies [1dc1607]
- Updated dependencies [8c5b00c]
- Updated dependencies [48ce207]
- Updated dependencies [6c26eb4]
- Updated dependencies [f8842d3]
- Updated dependencies [9a2040b]
- Updated dependencies [955b02e]
- Updated dependencies [d707a0c]
- Updated dependencies [d117fca]
- Updated dependencies [58b689a]
- Updated dependencies [cac7e99]
- Updated dependencies [aacdad6]
- Updated dependencies [9c2ac20]
- Updated dependencies [1489bfa]
- Updated dependencies [de7610e]
- Updated dependencies [14bd9f8]
- Updated dependencies [0618b12]
- Updated dependencies [41ee87a]
- Updated dependencies [c54e7b5]
- Updated dependencies [d215344]
- Updated dependencies [a3458cc]
- Updated dependencies [d1552a5]
- Updated dependencies [3ca4a69]
- Updated dependencies [f8e4056]
- Updated dependencies [bb59160]
- Updated dependencies [ac9118b]
- Updated dependencies [d314bd4]
- Updated dependencies [83ac49f]
  - @croco/diagnostics-core@0.0.4
  - @croco/protocols-core@0.1.0
  - @croco/events-core@0.0.4
  - @croco/protocols-rest@0.0.4
  - @croco/framework-context@0.0.4
  - @croco/health-core@0.0.4
  - @croco/problems-core@0.0.4
  - @croco/framework-logger@0.0.4
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
