# @croco/diagnostics-core

## 0.0.4

### Patch Changes

- 2f0dae2: Reject duplicate diagnostics provider names instead of silently overwriting an existing provider.
- ddfc6d1: Keep diagnostics reports bounded by timing out hanging providers and marking timed-out components as degraded.
- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.
- Updated dependencies [d707a0c]
  - @croco/problems-core@0.0.4

## 0.0.3

### Patch Changes

- 99f2a6b: add self-diagnosing subsystem (@croco/diagnostics-core)
- 99f2a6b: fix: align CommonJS package export maps with emitted dist files
