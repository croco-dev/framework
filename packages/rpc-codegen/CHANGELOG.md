# @croco/rpc-codegen

## 0.0.4

### Patch Changes

- 8b28607: OpenAPI and RPC generators now reject runtime-only `@All` routes with explicit diagnostics instead of producing invalid public contracts.
- 2a9d5b0: Make codegen CLI help exit successfully and invalid argument usage fail before loading generation modules.
- 2631037: OpenAPI and RPC codegen now discover exported REST controllers by metadata and ignore co-located helper classes.
- 0b49816: Generated REST SPA templates now expose OpenAPI spec export and typed RPC client generation commands backed by declared package dependencies and smoke-test coverage, and contract loaders resolve controller imports from the generated project.
- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.
- b5c525f: Make the published `croco-rpc-codegen` binary executable and verify its packaged startup path.
- af8093b: Generated clients now handle no-output RPC responses without parsing empty bodies as JSON.
- 1489bfa: Generated RPC clients now expose declared REST header parameters as typed inputs and send them as request headers.
- 27946c5: Encode generated RPC client path parameters before interpolation so reserved characters stay within one path segment.
- a41d123: Generated RPC clients now reject non-2xx HTTP responses before parsing successful output data and preserve RFC 7807 Problem Details in typed client errors.
- 0647644: Generated clients now serialize non-string query parameters while preserving typecheck compatibility.
- Updated dependencies [2631037]
- Updated dependencies [d707a0c]
- Updated dependencies [1489bfa]
  - @croco/protocols-core@0.0.4

## 0.0.3

### Patch Changes

- Updated dependencies [99f2a6b]
  - @croco/protocols-core@0.0.3
