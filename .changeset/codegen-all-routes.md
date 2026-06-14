---
"@croco/openapi-spec": patch
"@croco/rpc-codegen": patch
---

OpenAPI and RPC generators now reject runtime-only `@All` routes with explicit diagnostics instead of producing invalid public contracts.
