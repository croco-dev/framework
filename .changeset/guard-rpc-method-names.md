---
"@croco/rpc-codegen": patch
"@croco/problems-core": patch
---

RPC generation reports `rpc-codegen/invalid-contract` with the route and method name when that name cannot be used safely in the generated client. Existing output stays intact so the method can be renamed and generation rerun.

Problem registry source references point to the current RPC generator declarations.
