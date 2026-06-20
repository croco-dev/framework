---
"@croco/protocols-core": patch
"@croco/rpc-codegen": patch
"@croco/openapi-spec": patch
---

ContractGraph snapshots, OpenAPI generation, and RPC codegen now share a JSON-safe Zod schema descriptor and fail unsupported contract schemas with the same diagnostic code.
