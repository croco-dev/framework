# @croco/problems-core

## 0.0.4

### Patch Changes

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

- 8c5b00c: Expose the generated Problem registry and typed Croco Problem unions with lifecycle metadata for active and deprecated public Problem codes.
- 48ce207: ProblemRegistry manifests can declare package-owned Problem contracts, and ContractGraph can reference those declarations.
- 6c26eb4: REST contracts can now declare route-specific Problem responses, carry them through contract snapshots and OpenAPI output, and generate RPC clients with typed success/problem/external result branches for exhaustive Problem handling.
- f8842d3: - Local workspace test resolution now uses a development export condition that avoids dist-clean races while keeping published imports dist-backed.
- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.

## 0.0.3

### Patch Changes

- 99f2a6b: fix: align CommonJS package export maps with emitted dist files
