---
"@croco/cli": patch
"@croco/protocols-core": patch
"create-croco-app": patch
"@croco/openapi-spec": patch
"@croco/rpc-codegen": patch
---

Generated contract workflows now emit a schema-versioned `.croco/manifest` bundle, validate it through the Project Map drift gate and `croco doctor`, and reference it from generated OpenAPI and RPC outputs.
