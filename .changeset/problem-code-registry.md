---
"@croco/access-core": patch
"@croco/framework-context": patch
"@croco/llm-core": patch
"@croco/problems-core": patch
"@croco/protocols-graphql": patch
"@croco/protocols-core": patch
"@croco/protocols-rest": patch
"@croco/openapi-spec": patch
"@croco/storage-cloudflare": patch
"@croco/storage-cloudinary": patch
"@croco/triggers-core": patch
---

Expose deterministic Problem code registry metadata, enforce globally unique public Problem codes, and link declared API failure surfaces to the generated recovery cookbook.

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
