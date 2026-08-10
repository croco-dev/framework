---
"@croco/protocols-rest": minor
"@croco/problems-core": patch
"@croco/transports-http": patch
"@croco/rpc-codegen": patch
---

Separate route contract client inputs, parsed handler inputs, handler return values, and wire response outputs while preserving existing helper aliases. HTTP routes now parse handler returns through their response schema before serialization, and generated RPC clients project request and response schemas according to their lifecycle direction.
