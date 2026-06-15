# @croco/search-meilisearch

## 0.0.4

### Patch Changes

- a61dcd4: Public package manifests now expose normalized publish-time entrypoints for dist-based runtime and type resolution.
- 40b024d: Keep published package entrypoints importable by generating advertised declaration files, declaring public runtime and type dependencies on the install surface, deferring Clerk webhook peer loading until webhook handling is used, preserving concrete customer health injection tokens in built output, no longer advertising CommonJS entrypoints that cannot load ESM-only peers, and keeping the migration CLI parser behind binary execution.
- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.
- Updated dependencies [a61dcd4]
- Updated dependencies [a61dcd4]
- Updated dependencies [d707a0c]
- Updated dependencies [41ee87a]
- Updated dependencies [3e976a2]
- Updated dependencies [d1552a5]
  - @croco/framework-context@0.0.4
  - @croco/search-core@0.0.4
  - @croco/problems-core@0.0.4

## 0.0.3

### Patch Changes

- Updated dependencies [99f2a6b]
- Updated dependencies [99f2a6b]
- Updated dependencies [99f2a6b]
  - @croco/framework-context@0.0.3
  - @croco/problems-core@0.0.3
  - @croco/search-core@0.0.3
