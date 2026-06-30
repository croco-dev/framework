---
"@croco/protocols-core": patch
"@croco/protocols-rest": patch
"@croco/rpc-codegen": patch
"@croco/openapi-spec": patch
"@croco/cli": patch
"create-croco-app": patch
---

- Generated REST contract gates can now run strict schema diagnostics that fail before RPC/OpenAPI
  generation when routes omit response, body, path, query, or header schemas.
