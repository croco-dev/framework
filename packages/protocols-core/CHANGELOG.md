# @croco/protocols-core

## 0.1.0

### Minor Changes

- 779fa6f: Expose a documented ContractGraph v1 JSON snapshot schema and make the OpenAPI CLI validate the canonical contract graph before emitting specs.

### Patch Changes

- d281518: - fix: close package docs coverage gaps
- ea14bd4: - Align route contract Problem response coverage with generated recovery cookbook links.
- 73e430a: Contract Graph routes can now generate deterministic admin resource configs with typed client bindings, preserved declared Problem metadata, and explicit diagnostics for ambiguous route shapes.
- 2631037: OpenAPI and RPC codegen now discover exported REST controllers by metadata and ignore co-located helper classes.
- 529c7fd: Contract graph snapshots now include consumer coverage reports, OpenAPI/RPC generation verifies every graph route, generated RPC clients expose route metadata, and generated app CI contract scripts write `contract-graph.coverage.json`.
- f3951f3: REST route contracts can now drive controller decorators directly through contract-aware HTTP method, parameter, body, and response helpers. Contract graphs preserve route contract identity/source locations and report drift when controller bindings or response metadata diverge from the contract. The SPA split starter template now uses contract-first REST routes for its generated OpenAPI/RPC contract path.
- 6148ed3: Expose a canonical REST contract graph with route diagnostics and add a contract check path before OpenAPI and RPC client generation.
- 988f072: Add deterministic contract graph snapshots and drift gates for contract-first release checks.
- 9c1bc2e: Entitlement guard requirements are now emitted as route contract metadata and OpenAPI extensions, with explicit guard status and evidence.
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

- 48ce207: ProblemRegistry manifests can declare package-owned Problem contracts, and ContractGraph can reference those declarations.
- 6c26eb4: REST contracts can now declare route-specific Problem responses, carry them through contract snapshots and OpenAPI output, and generate RPC clients with typed success/problem/external result branches for exhaustive Problem handling.
- 9a2040b: Generated contract workflows now emit a schema-versioned `.croco/manifest` bundle, validate it through the Project Map drift gate and `croco doctor`, and reference it from generated OpenAPI and RPC outputs.
- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.
- 1489bfa: Generated RPC clients now expose declared REST header parameters as typed inputs and send them as request headers.
- d215344: Route schemas can now be declared once with `defineRouteSchema`, infer controller DTO types from that schema, and feed the same request and response schema references into validation metadata, contract graphs, OpenAPI emission, and generated RPC client types.
- a3458cc: ContractGraph snapshots, OpenAPI generation, and RPC codegen now share a JSON-safe Zod schema descriptor and fail unsupported contract schemas with the same diagnostic code.
- f8e4056: Generated app REST routes now declare schema-backed contract decorators, and protocols-core is included in the staged strict contract typecheck gate.
- bb59160: - Generated REST contract gates can now run strict schema diagnostics that fail before RPC/OpenAPI
  generation when routes omit response, body, path, query, or header schemas.
- d314bd4: - fix: validate route Problem response contracts through typed declarations
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
