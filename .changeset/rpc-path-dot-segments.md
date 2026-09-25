---
"@croco/rpc-codegen": patch
"@croco/problems-core": patch
---

Generated clients reject path parameters that serialize to `""`, `"."`, or `".."` before calling `fetch`, so URL normalization can no longer send the request to a different route. Throwing methods reject with `RpcPathParamInputError`, and `*Result` methods return it as an external failure. The Problem registry and `CrocoProblemCode` now include `rpc-codegen/path-param-input-unsupported`.
