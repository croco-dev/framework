# @croco/metering-drizzle

## 0.0.4

### Patch Changes

- 6e165ab: Expose a shared Drizzle provider conformance suite and record initial metering and execution provider evidence for schema, transaction, tenant, and deterministic error gates.
- 513188f: Drizzle-backed SaaS adapters now publish shared conformance evidence and redacted readiness diagnostics before beta maturity.
- 40b024d: Keep published package entrypoints importable by generating advertised declaration files, declaring public runtime and type dependencies on the install surface, deferring Clerk webhook peer loading until webhook handling is used, preserving concrete customer health injection tokens in built output, no longer advertising CommonJS entrypoints that cannot load ESM-only peers, and keeping the migration CLI parser behind binary execution.
- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.
- Updated dependencies [ee924c0]
- Updated dependencies [5403360]
- Updated dependencies [e12e825]
- Updated dependencies [6831875]
- Updated dependencies [a61dcd4]
- Updated dependencies [76bc0df]
- Updated dependencies [997d84d]
- Updated dependencies [4c7fcd9]
- Updated dependencies [1dc1607]
- Updated dependencies [8c5b00c]
- Updated dependencies [48ce207]
- Updated dependencies [6c26eb4]
- Updated dependencies [f8842d3]
- Updated dependencies [d707a0c]
- Updated dependencies [dc5e4e9]
- Updated dependencies [4f24761]
- Updated dependencies [9c2ac20]
- Updated dependencies [de7610e]
- Updated dependencies [14bd9f8]
- Updated dependencies [0618b12]
- Updated dependencies [41ee87a]
- Updated dependencies [c54e7b5]
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
