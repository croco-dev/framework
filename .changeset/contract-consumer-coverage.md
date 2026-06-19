---
"@croco/protocols-core": patch
"@croco/cli": patch
"@croco/openapi-spec": patch
"@croco/rpc-codegen": patch
"create-croco-app": patch
---

Contract graph snapshots now include consumer coverage reports, OpenAPI/RPC generation verifies every graph route, generated RPC clients expose route metadata, and generated app CI contract scripts write `contract-graph.coverage.json`.
