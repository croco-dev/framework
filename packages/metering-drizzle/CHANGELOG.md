# @croco/metering-drizzle

## 0.0.4

### Patch Changes

- 40b024d: Keep published package entrypoints importable by generating advertised declaration files, declaring public runtime and type dependencies on the install surface, deferring Clerk webhook peer loading until webhook handling is used, preserving concrete customer health injection tokens in built output, no longer advertising CommonJS entrypoints that cannot load ESM-only peers, and keeping the migration CLI parser behind binary execution.
- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.
- Updated dependencies [a61dcd4]
- Updated dependencies [76bc0df]
- Updated dependencies [997d84d]
- Updated dependencies [d707a0c]
- Updated dependencies [4f24761]
- Updated dependencies [41ee87a]
- Updated dependencies [d1552a5]
- Updated dependencies [844234f]
  - @croco/framework-context@0.0.4
  - @croco/metering-core@0.0.4
  - @croco/problems-core@0.0.4
  - @croco/tx-core@0.0.4

## 0.0.3

### Patch Changes

- 99f2a6b: fix: align CommonJS package export maps with emitted dist files
- Updated dependencies [99f2a6b]
  - @croco/metering-core@0.0.3
  - @croco/problems-core@0.0.3
  - @croco/tx-core@0.0.3
