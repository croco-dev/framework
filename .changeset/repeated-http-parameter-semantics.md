---
"@croco/cli": patch
"@croco/openapi-spec": patch
"@croco/protocols-core": patch
"@croco/protocols-rest": minor
"@croco/rpc-codegen": patch
"@croco/transports-http": minor
---

Preserve repeated query values for HTTP parameter binding, validate list-valued query and headers consistently, and align generated OpenAPI, RPC client serialization, and CLI templates. Direct query accessors now expose repeated keys as `string[]`, so consumers that require one scalar value must narrow the result.

Schema-less named `@Query()` parameters retain their generated optional-scalar contract and reject repeated values. Declare an array schema when a controller parameter accepts repeated keys.
