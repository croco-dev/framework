---
"@croco/cli": patch
"@croco/openapi-spec": patch
"@croco/problems-core": patch
"@croco/protocols-core": patch
"@croco/rpc-codegen": patch
"create-croco-app": patch
---

Generated OpenAPI and RPC contract paths now run strict ContractGraph schema checks by default, fail generated app scripts on strict ContractGraph diagnostics, and keep legacy compatibility behavior behind explicit opt-out flags.
