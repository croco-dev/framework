---
"@croco/protocols-core": patch
---

Contract generation rejects object, record and nested array query values, including wrapped and union branches, with a source-located query wire diagnostic before RPC or OpenAPI artifacts are emitted. Scalar and repeated scalar query values retain existing validation and coercion.
