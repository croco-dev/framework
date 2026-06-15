# @croco/openapi-spec

## 0.0.4

### Patch Changes

- 8b28607: OpenAPI and RPC generators now reject runtime-only `@All` routes with explicit diagnostics instead of producing invalid public contracts.
- 2a9d5b0: Make codegen CLI help exit successfully and invalid argument usage fail before loading generation modules.
- 2631037: OpenAPI and RPC codegen now discover exported REST controllers by metadata and ignore co-located helper classes.
- 0b49816: Generated REST SPA templates now expose OpenAPI spec export and typed RPC client generation commands backed by declared package dependencies and smoke-test coverage, and contract loaders resolve controller imports from the generated project.
- 2977874: OpenAPI generation now accepts document metadata options and emits shared Problem Details responses for generated operations.
- 9ae8ab8: OpenAPI documents now include JSON success response schemas declared through `@ResponseSchema`.
- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.
- Updated dependencies [2631037]
- Updated dependencies [d707a0c]
- Updated dependencies [1489bfa]
  - @croco/protocols-core@0.0.4

## 0.0.3

### Patch Changes

- 99f2a6b: fix: align CommonJS package export maps with emitted dist files
- Updated dependencies [99f2a6b]
  - @croco/protocols-core@0.0.3
