---
"@croco/rpc-codegen": patch
---

Reject catchall and passthrough output objects with a route and schema diagnostic before writing client files, rather than silently losing their dynamic field types. Use records for supported dynamic output contracts.
