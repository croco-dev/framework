---
"@croco/protocols-rest": patch
"@croco/protocols-core": patch
"create-croco-app": patch
---

REST route contracts can now drive controller decorators directly through contract-aware HTTP method, parameter, body, and response helpers. Contract graphs preserve route contract identity/source locations and report drift when controller bindings or response metadata diverge from the contract. The SPA split starter template now uses contract-first REST routes for its generated OpenAPI/RPC contract path.
