# @croco/cli

## 0.0.4

### Patch Changes

- a88bbef: Generate controllers with the public CrocoHttpContext transport type instead of a nonexistent RouteContext import.
- 511a850: CLI generators now validate generated imports against target app manifests before writing files, and API-server scaffolds declare the common generator dependencies.
- ae98a01: Default page generation now emits the current meta-vite `defineRoute` route shape while keeping SPA route config generation explicit to `--mode spa`.
- e7c759b: `croco migrate status` now delegates to `@croco/migration-runner`, forwards migration flags through the wrapper, and status reads real Drizzle node-postgres row results.
- dce724a: Generated console web pages now avoid imports that are missing from the matching create-croco-app web scaffolds.
- 9f14ead: Generated repository and entity templates now align with the public `@croco/repository-core` interface contract.
- 52f8015: The Croco CLI now forwards `croco codegen rpc` to the RPC codegen binary instead of the package root export.
- a61dcd4: Public package manifests now expose normalized publish-time entrypoints for dist-based runtime and type resolution.
- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.
- Updated dependencies [e7c759b]
- Updated dependencies [7db1d3f]
- Updated dependencies [8b28607]
- Updated dependencies [2a9d5b0]
- Updated dependencies [2631037]
- Updated dependencies [0b49816]
- Updated dependencies [0c20d29]
- Updated dependencies [6d61236]
- Updated dependencies [2977874]
- Updated dependencies [9ae8ab8]
- Updated dependencies [40b024d]
- Updated dependencies [d707a0c]
- Updated dependencies [b5c525f]
- Updated dependencies [af8093b]
- Updated dependencies [1489bfa]
- Updated dependencies [27946c5]
- Updated dependencies [a41d123]
- Updated dependencies [0647644]
  - @croco/migration-runner@0.0.4
  - @croco/openapi-spec@0.0.4
  - @croco/rpc-codegen@0.0.4

## 0.0.3

### Patch Changes

- Updated dependencies [99f2a6b]
  - @croco/migration-runner@0.0.3
  - @croco/openapi-spec@0.0.3
  - @croco/rpc-codegen@0.0.3
