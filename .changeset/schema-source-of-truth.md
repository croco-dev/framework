---
"@croco/protocols-core": patch
"@croco/protocols-rest": patch
---

Route schemas can now be declared once with `defineRouteSchema`, infer controller DTO types from that schema, and feed the same request and response schema references into validation metadata, contract graphs, OpenAPI emission, and generated RPC client types.
