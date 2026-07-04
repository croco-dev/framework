# @croco/openapi-spec

## 0.1.0

### Minor Changes

- 779fa6f: Expose a documented ContractGraph v1 JSON snapshot schema and make the OpenAPI CLI validate the canonical contract graph before emitting specs.

### Patch Changes

- d281518: - fix: close package docs coverage gaps
- a77425f: - Expand strict contract typecheck coverage to REST, OpenAPI, RPC codegen, and HTTP transport package configs.
- 8b28607: OpenAPI and RPC generators now reject runtime-only `@All` routes with explicit diagnostics instead of producing invalid public contracts.
- 2a9d5b0: Make codegen CLI help exit successfully and invalid argument usage fail before loading generation modules.
- 2631037: OpenAPI and RPC codegen now discover exported REST controllers by metadata and ignore co-located helper classes.
- 529c7fd: Contract graph snapshots now include consumer coverage reports, OpenAPI/RPC generation verifies every graph route, generated RPC clients expose route metadata, and generated app CI contract scripts write `contract-graph.coverage.json`.
- 6148ed3: Expose a canonical REST contract graph with route diagnostics and add a contract check path before OpenAPI and RPC client generation.
- 0b43229: Controller contract loaders now fail before emitted module import when matched controller sources contain TypeScript errors.
- 9c1bc2e: Entitlement guard requirements are now emitted as route contract metadata and OpenAPI extensions, with explicit guard status and evidence.
- 0b49816: Generated REST SPA templates now expose OpenAPI spec export and typed RPC client generation commands backed by declared package dependencies and smoke-test coverage, and contract loaders resolve controller imports from the generated project.
- 2977874: OpenAPI generation now accepts document metadata options and emits shared Problem Details responses for generated operations.
- 9ae8ab8: OpenAPI documents now include JSON success response schemas declared through `@ResponseSchema`.
- 1dc1607: Expose deterministic Problem code registry metadata, enforce globally unique public Problem codes, and link declared API failure surfaces to the generated recovery cookbook.

  Problem codes that previously collided now use package-scoped identifiers so every public code can be looked up deterministically:
  - `FORBIDDEN` -> `access-core/forbidden`
  - `MIDDLEWARE_EXECUTION_ERROR` -> `framework-context/context-middleware-execution-error`
  - `RATE_LIMIT_EXCEEDED` -> `llm-core/rate-limit-exceeded`
  - `cloudflare/images-null-result` for upload-intent null results -> `cloudflare/images-upload-intent-null-result`
  - `AUTH_*` REST guard codes -> `protocols-rest/auth-*`
  - `AUTH_*` GraphQL guard codes -> `protocols-graphql/auth-*`
  - `storage/invalid-upload-intent-ttl` in Cloudinary -> `storage-cloudinary/invalid-upload-intent-ttl`
  - `triggers-core/duplicate-trigger-metadata` for target-level duplicate method entries -> `triggers-core/duplicate-trigger-metadata-entry`

  Consumers that branch on exact Problem code strings should update those handlers to the package-scoped codes.

- 6c26eb4: REST contracts can now declare route-specific Problem responses, carry them through contract snapshots and OpenAPI output, and generate RPC clients with typed success/problem/external result branches for exhaustive Problem handling.
- 9a2040b: Generated contract workflows now emit a schema-versioned `.croco/manifest` bundle, validate it through the Project Map drift gate and `croco doctor`, and reference it from generated OpenAPI and RPC outputs.
- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.
- a3458cc: ContractGraph snapshots, OpenAPI generation, and RPC codegen now share a JSON-safe Zod schema descriptor and fail unsupported contract schemas with the same diagnostic code.
- bb59160: - Generated REST contract gates can now run strict schema diagnostics that fail before RPC/OpenAPI
  generation when routes omit response, body, path, query, or header schemas.
- Updated dependencies [d281518]
- Updated dependencies [ea14bd4]
- Updated dependencies [73e430a]
- Updated dependencies [2631037]
- Updated dependencies [529c7fd]
- Updated dependencies [f3951f3]
- Updated dependencies [6148ed3]
- Updated dependencies [779fa6f]
- Updated dependencies [988f072]
- Updated dependencies [9c1bc2e]
- Updated dependencies [1dc1607]
- Updated dependencies [8c5b00c]
- Updated dependencies [48ce207]
- Updated dependencies [6c26eb4]
- Updated dependencies [f8842d3]
- Updated dependencies [9a2040b]
- Updated dependencies [d707a0c]
- Updated dependencies [1489bfa]
- Updated dependencies [d215344]
- Updated dependencies [a3458cc]
- Updated dependencies [f8e4056]
- Updated dependencies [bb59160]
- Updated dependencies [d314bd4]
  - @croco/protocols-core@0.1.0
  - @croco/problems-core@0.0.4

## 0.0.3

### Patch Changes

- 99f2a6b: fix: align CommonJS package export maps with emitted dist files
- Updated dependencies [99f2a6b]
  - @croco/protocols-core@0.0.3
