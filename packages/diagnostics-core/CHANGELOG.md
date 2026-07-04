# @croco/diagnostics-core

## 0.0.4

### Patch Changes

- 4d8f094: - Generated REST/Lambda and Cloudflare worker apps now bootstrap with the required HTTP security middleware instead of disabling security validation.
  - Missing required HTTP security middleware now fails with `CROCO_HTTP_SECURITY_001` while preserving the previous slash-form code as `legacyCode`.
- 6769a7f: - fix: enforce core coverage spine baseline
- d281518: - fix: close package docs coverage gaps
- 0b43229: Controller contract loaders now fail before emitted module import when matched controller sources contain TypeScript errors.
- 9cd8667: Expose the stable CROCO diagnostic code contract with typed code definitions, source locations, fix examples, message formatting, and append-only change policy.
- 2f0dae2: Reject duplicate diagnostics provider names instead of silently overwriting an existing provider.
- ddfc6d1: Keep diagnostics reports bounded by timing out hanging providers and marking timed-out components as degraded.
- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.
- 14bd9f8: - Runtime capability manifests can now be emitted and compared for Node, Lambda, and Cloudflare Workers with deterministic `RuntimeCapabilityManifest v1` output.
  - Unsupported runtime capability use now carries the stable `CROCO_RUNTIME_CAPABILITY_001` diagnostic context.
  - Generated apps now write `croco-runtime-capability.manifest.json`, and doctor/smoke checks validate the manifest for supported runtime targets.
- 3ca4a69: CLI diagnostics now emit registered `CROCO_*` codes while preserving previous slash-form identifiers as explicit legacy alias metadata.
- Updated dependencies [1dc1607]
- Updated dependencies [8c5b00c]
- Updated dependencies [48ce207]
- Updated dependencies [6c26eb4]
- Updated dependencies [f8842d3]
- Updated dependencies [d707a0c]
  - @croco/problems-core@0.0.4

## 0.0.3

### Patch Changes

- 99f2a6b: add self-diagnosing subsystem (@croco/diagnostics-core)
- 99f2a6b: fix: align CommonJS package export maps with emitted dist files
