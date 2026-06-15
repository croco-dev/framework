# @croco/auth-clerk

## 0.0.4

### Patch Changes

- 5cb2226: Missing Clerk organization membership public user data now surfaces as a structured Croco Problem instead of a plain Error.
- f98d9dc: Surface Clerk organization lookup failures and invalid membership payloads as typed Problems while preserving null for known not-found lookups.
- 40b024d: Keep published package entrypoints importable by generating advertised declaration files, declaring public runtime and type dependencies on the install surface, deferring Clerk webhook peer loading until webhook handling is used, preserving concrete customer health injection tokens in built output, no longer advertising CommonJS entrypoints that cannot load ESM-only peers, and keeping the migration CLI parser behind binary execution.
- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.
- Updated dependencies [a61dcd4]
- Updated dependencies [d707a0c]
- Updated dependencies [aacdad6]
- Updated dependencies [41ee87a]
- Updated dependencies [d1552a5]
  - @croco/framework-context@0.0.4
  - @croco/auth-core@0.0.4
  - @croco/problems-core@0.0.4
  - @croco/tenant-core@0.0.4

## 0.0.3

### Patch Changes

- 99f2a6b: fix: align CommonJS package export maps with emitted dist files
- Updated dependencies [99f2a6b]
- Updated dependencies [99f2a6b]
- Updated dependencies [99f2a6b]
  - @croco/framework-context@0.0.3
  - @croco/auth-core@0.0.3
  - @croco/problems-core@0.0.3
  - @croco/tenant-core@0.0.3
