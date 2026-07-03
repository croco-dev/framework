# @croco/meta-vite

## 0.0.4

### Patch Changes

- dc6723d: Expose a shared frontend action manifest so generated RPC clients and meta-vite server actions publish inspectable action contracts with drift checks.
- 1cd17aa: Server actions can now use scoped registries with reset and unregister cleanup paths for tests, HMR, and multi-app runtimes while preserving the global registry API.
- 1e60ada: Meta fetch handlers now return 405 Method Not Allowed with an Allow header when API route paths exist but do not support the request method.
- ac40099: Expose ISR runtime support diagnostics and cover durable Node/Lambda ISR plus Workers durable cache boundaries in package smoke tests.
- b257dc8: Meta fetch handlers now return fresh 404 Response instances for API and page misses so repeated body reads do not fail after an earlier miss.
- 9f0f082: RouteRegistry now rejects duplicate page paths at registration time instead of letting ambiguous page routes accumulate.
- 81eb35b: Expose the Redis ISR adapter through the published `@croco/meta-vite/isr/adapters` entrypoint and declare its optional `ioredis` peer contract while keeping root server-action types usable without Redis.
- 0fdb088: Meta Vite apps can now emit deterministic route manifests for page routes, API routes, server actions, component references, revalidation, and runtime capability requirements.
- 72eed06: Pass RuntimeContext through API route dispatch so server action HTTP handlers can observe provider context.
- 7bf4452: Server action failures now return a Problem-backed action result contract with stable kinds for missing actions, invalid paths, validation errors, and domain Problems.
- 40b024d: Keep published package entrypoints importable by generating advertised declaration files, declaring public runtime and type dependencies on the install surface, deferring Clerk webhook peer loading until webhook handling is used, preserving concrete customer health injection tokens in built output, no longer advertising CommonJS entrypoints that cannot load ESM-only peers, and keeping the migration CLI parser behind binary execution.
- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.
- Updated dependencies [3f59af3]
- Updated dependencies [305eed7]
- Updated dependencies [444a829]
- Updated dependencies [dc6723d]
- Updated dependencies [fe0a955]
- Updated dependencies [cb11e66]
- Updated dependencies [0ab39c6]
- Updated dependencies [1dc1607]
- Updated dependencies [8c5b00c]
- Updated dependencies [48ce207]
- Updated dependencies [6c26eb4]
- Updated dependencies [f8842d3]
- Updated dependencies [d707a0c]
  - @croco/cache-core@0.0.4
  - @croco/presentation-preset@0.0.4
  - @croco/problems-core@0.0.4

## 0.0.3

### Patch Changes

- 99f2a6b: fix: align CommonJS package export maps with emitted dist files
- Updated dependencies [99f2a6b]
  - @croco/cache-core@0.0.3
  - @croco/presentation-preset@0.0.3
