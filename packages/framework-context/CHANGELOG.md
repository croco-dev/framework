# @croco/framework-context

## 0.0.4

### Patch Changes

- a61dcd4: Container removal now unregisters constructor component metadata so validation and later resolution honor removed components.
- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.
- 41ee87a: Expose a request-scoped `RuntimeContext` contract for Node, AWS Lambda, and Cloudflare Workers runtime metadata.
- d1552a5: Reject conflicting explicit ShutdownManager timeout configuration with a typed Problem while preserving reset-based listener isolation.
- Updated dependencies [2f0dae2]
- Updated dependencies [ddfc6d1]
- Updated dependencies [d707a0c]
  - @croco/diagnostics-core@0.0.4
  - @croco/problems-core@0.0.4

## 0.0.3

### Patch Changes

- 99f2a6b: add self-diagnosing subsystem (@croco/diagnostics-core)
- 99f2a6b: fix: align CommonJS package export maps with emitted dist files
- 99f2a6b: fix: resolve component singleton DI and HTTP telemetry status mapping bugs
- Updated dependencies [99f2a6b]
- Updated dependencies [99f2a6b]
  - @croco/diagnostics-core@0.0.3
  - @croco/problems-core@0.0.3
