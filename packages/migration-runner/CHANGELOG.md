# @croco/migration-runner

## 0.0.4

### Patch Changes

- d281518: - fix: close package docs coverage gaps
- e7c759b: `croco migrate status` now delegates to `@croco/migration-runner`, forwards migration flags through the wrapper, and status reads real Drizzle node-postgres row results.
- 7db1d3f: Derive CLI version banners from each package manifest instead of hard-coded source strings.
- 0c20d29: Migration execution now requires transaction-capable clients for `up` and `down`, and claims checkpoints inside the same transaction as migration side effects so concurrent runners skip already-claimed work instead of applying the same migration body twice.
- e27c8e2: Reject invalid migration rollback counts before a destructive down migration can run.
- 6d61236: The published migrate binary now installs its Postgres driver runtime dependency.
- 9075ab8: Expose migration runner failure Problems and stabilize CLI diagnostics for production-ready migration operations.
- 40b024d: Keep published package entrypoints importable by generating advertised declaration files, declaring public runtime and type dependencies on the install surface, deferring Clerk webhook peer loading until webhook handling is used, preserving concrete customer health injection tokens in built output, no longer advertising CommonJS entrypoints that cannot load ESM-only peers, and keeping the migration CLI parser behind binary execution.
- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.
- Updated dependencies [1dc1607]
- Updated dependencies [8c5b00c]
- Updated dependencies [48ce207]
- Updated dependencies [6c26eb4]
- Updated dependencies [f8842d3]
- Updated dependencies [d707a0c]
  - @croco/problems-core@0.0.4

## 0.0.3

### Patch Changes

- 99f2a6b: fix: align CommonJS package export maps with emitted dist files
- Updated dependencies [99f2a6b]
  - @croco/problems-core@0.0.3
