# @croco/protocols-rest

## 0.0.4

### Patch Changes

- a77425f: - Expand strict contract typecheck coverage to REST, OpenAPI, RPC codegen, and HTTP transport package configs.
- f3951f3: REST route contracts can now drive controller decorators directly through contract-aware HTTP method, parameter, body, and response helpers. Contract graphs preserve route contract identity/source locations and report drift when controller bindings or response metadata diverge from the contract. The SPA split starter template now uses contract-first REST routes for its generated OpenAPI/RPC contract path.
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
- 955b02e: HttpExceptionFilter now accepts only Croco Problem instances or validated Problem Details when emitting RFC 7807 responses.
- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.
- d117fca: LoggingInterceptor can be loaded by local quick-start example smoke runs without requiring parameter decorator transforms in downstream source loaders.
- 1489bfa: Generated RPC clients now expose declared REST header parameters as typed inputs and send them as request headers.
- d215344: Route schemas can now be declared once with `defineRouteSchema`, infer controller DTO types from that schema, and feed the same request and response schema references into validation metadata, contract graphs, OpenAPI emission, and generated RPC client types.
- bb59160: - Generated REST contract gates can now run strict schema diagnostics that fail before RPC/OpenAPI
  generation when routes omit response, body, path, query, or header schemas.
- d314bd4: - fix: validate route Problem response contracts through typed declarations
- 83ac49f: REST routes now expose typed route contracts that connect path params, query, body, response, and Problem unions to existing controller decorators without changing runtime decorator behavior.
- Updated dependencies [d281518]
- Updated dependencies [ea14bd4]
- Updated dependencies [73e430a]
- Updated dependencies [2631037]
- Updated dependencies [529c7fd]
- Updated dependencies [f3951f3]
- Updated dependencies [6148ed3]
- Updated dependencies [779fa6f]
- Updated dependencies [988f072]
- Updated dependencies [ee924c0]
- Updated dependencies [5403360]
- Updated dependencies [e12e825]
- Updated dependencies [6831875]
- Updated dependencies [9c1bc2e]
- Updated dependencies [a61dcd4]
- Updated dependencies [4c7fcd9]
- Updated dependencies [1dc1607]
- Updated dependencies [8c5b00c]
- Updated dependencies [48ce207]
- Updated dependencies [6c26eb4]
- Updated dependencies [f8842d3]
- Updated dependencies [9a2040b]
- Updated dependencies [d707a0c]
- Updated dependencies [9c2ac20]
- Updated dependencies [1489bfa]
- Updated dependencies [de7610e]
- Updated dependencies [14bd9f8]
- Updated dependencies [0618b12]
- Updated dependencies [41ee87a]
- Updated dependencies [c54e7b5]
- Updated dependencies [d215344]
- Updated dependencies [a3458cc]
- Updated dependencies [d1552a5]
- Updated dependencies [f8e4056]
- Updated dependencies [bb59160]
- Updated dependencies [d314bd4]
  - @croco/protocols-core@0.1.0
  - @croco/framework-context@0.0.4
  - @croco/problems-core@0.0.4

## 0.0.3

### Patch Changes

- 99f2a6b: fix: align CommonJS package export maps with emitted dist files
- Updated dependencies [99f2a6b]
- Updated dependencies [99f2a6b]
- Updated dependencies [99f2a6b]
  - @croco/framework-context@0.0.3
  - @croco/problems-core@0.0.3
