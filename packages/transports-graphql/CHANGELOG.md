# @croco/transports-graphql

## 0.0.4

### Patch Changes

- b98b41a: - fix: guard GraphQL transport dependency contract
- 40b024d: Keep published package entrypoints importable by generating advertised declaration files, declaring public runtime and type dependencies on the install surface, deferring Clerk webhook peer loading until webhook handling is used, preserving concrete customer health injection tokens in built output, no longer advertising CommonJS entrypoints that cannot load ESM-only peers, and keeping the migration CLI parser behind binary execution.
- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.
- aacdad6: Decorator packages now declare `reflect-metadata` as a runtime dependency whenever their published source imports it, so strict consumers can import those decorators without relying on undeclared transitive installs.
- Updated dependencies [a61dcd4]
- Updated dependencies [d707a0c]
- Updated dependencies [41ee87a]
- Updated dependencies [d1552a5]
  - @croco/framework-context@0.0.4
  - @croco/framework-logger@0.0.4
  - @croco/problems-core@0.0.4
  - @croco/protocols-graphql@0.0.4

## 0.0.3

### Patch Changes

- Updated dependencies [99f2a6b]
- Updated dependencies [99f2a6b]
- Updated dependencies [99f2a6b]
  - @croco/framework-context@0.0.3
  - @croco/framework-logger@0.0.3
  - @croco/problems-core@0.0.3
  - @croco/protocols-graphql@0.0.3
