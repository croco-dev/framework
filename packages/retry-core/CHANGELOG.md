# @croco/retry-core

## 0.0.4

### Patch Changes

- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.
- aacdad6: Decorator packages now declare `reflect-metadata` as a runtime dependency whenever their published source imports it, so strict consumers can import those decorators without relying on undeclared transitive installs.
- c1890a0: Export the documented Redis circuit breaker store contract from the package root.
- Updated dependencies [d707a0c]
  - @croco/problems-core@0.0.4
  - @croco/telemetry-api@0.0.4

## 0.0.3

### Patch Changes

- 99f2a6b: fix: align CommonJS package export maps with emitted dist files
- Updated dependencies [99f2a6b]
  - @croco/problems-core@0.0.3
  - @croco/telemetry-api@0.0.3
