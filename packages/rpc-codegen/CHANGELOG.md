# @croco/rpc-codegen

## 0.1.0

### Minor Changes

- 9d6ef7c: Generated frontend RPC clients can propagate browser correlation headers and emit provider-neutral request, Problem, external failure, cancel, retry, and mutation lifecycle telemetry events through a browser-safe telemetry bridge.
- 2e65be0: Provide a shared browser-safe Problem client runtime and let generated clients import it explicitly.
- 53d4169: - Generate framework-neutral form models, submit payload builders, and typed validation/global Problem mapping from supported route body schemas.
- 30e4f4a: Generated React Query clients now include stable query and mutation option factories plus Result-aware hooks that preserve declared Problem unions at the hook boundary.

### Patch Changes

- d281518: - fix: close package docs coverage gaps
- a77425f: - Expand strict contract typecheck coverage to REST, OpenAPI, RPC codegen, and HTTP transport package configs.
- 8b28607: OpenAPI and RPC generators now reject runtime-only `@All` routes with explicit diagnostics instead of producing invalid public contracts.
- 2a9d5b0: Make codegen CLI help exit successfully and invalid argument usage fail before loading generation modules.
- 2631037: OpenAPI and RPC codegen now discover exported REST controllers by metadata and ignore co-located helper classes.
- 529c7fd: Contract graph snapshots now include consumer coverage reports, OpenAPI/RPC generation verifies every graph route, generated RPC clients expose route metadata, and generated app CI contract scripts write `contract-graph.coverage.json`.
- 6148ed3: Expose a canonical REST contract graph with route diagnostics and add a contract check path before OpenAPI and RPC client generation.
- 988f072: Add deterministic contract graph snapshots and drift gates for contract-first release checks.
- 0b43229: Controller contract loaders now fail before emitted module import when matched controller sources contain TypeScript errors.
- dc6723d: Expose a shared frontend action manifest so generated RPC clients and meta-vite server actions publish inspectable action contracts with drift checks.
- 0b49816: Generated REST SPA templates now expose OpenAPI spec export and typed RPC client generation commands backed by declared package dependencies and smoke-test coverage, and contract loaders resolve controller imports from the generated project.
- 6c26eb4: REST contracts can now declare route-specific Problem responses, carry them through contract snapshots and OpenAPI output, and generate RPC clients with typed success/problem/external result branches for exhaustive Problem handling.
- 9a2040b: Generated contract workflows now emit a schema-versioned `.croco/manifest` bundle, validate it through the Project Map drift gate and `croco doctor`, and reference it from generated OpenAPI and RPC outputs.
- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.
- dc5e4e9: Runtime boundary failures now expose stable Problem or diagnostic-coded errors instead of raw built-in Error throws.
- b5c525f: Make the published `croco-rpc-codegen` binary executable and verify its packaged startup path.
- d2b6dc3: Generated RPC clients now expose stable query key factories and same-domain mutation invalidation manifests for React Query cache reuse.
- af8093b: Generated clients now handle no-output RPC responses without parsing empty bodies as JSON.
- 1489bfa: Generated RPC clients now expose declared REST header parameters as typed inputs and send them as request headers.
- 27946c5: Encode generated RPC client path parameters before interpolation so reserved characters stay within one path segment.
- a41d123: Generated RPC clients now reject non-2xx HTTP responses before parsing successful output data and preserve RFC 7807 Problem Details in typed client errors.
- 0647644: Generated clients now serialize non-string query parameters while preserving typecheck compatibility.
- a3458cc: ContractGraph snapshots, OpenAPI generation, and RPC codegen now share a JSON-safe Zod schema descriptor and fail unsupported contract schemas with the same diagnostic code.
- bb59160: - Generated REST contract gates can now run strict schema diagnostics that fail before RPC/OpenAPI
  generation when routes omit response, body, path, query, or header schemas.
- 9ad65a3: Generated RPC clients now expose a package barrel, preserve JSON-safe literal/enum/union/record schema types, and fail generation for unsupported Zod schemas instead of widening contracts through implicit fallback types.
- d314bd4: - fix: validate route Problem response contracts through typed declarations
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
- Updated dependencies [dc6723d]
- Updated dependencies [fe0a955]
- Updated dependencies [cb11e66]
- Updated dependencies [0ab39c6]
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
  - @croco/presentation-preset@0.0.4
  - @croco/problems-core@0.0.4

## 0.0.3

### Patch Changes

- Updated dependencies [99f2a6b]
  - @croco/protocols-core@0.0.3
