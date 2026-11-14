---
"@croco/protocol-codegen": patch
---

Generate RPC clients and OpenAPI specs when the controller glob matches both a controller and its re-exports. Each controller reaches the contract graph once, and distinct controllers with conflicting names or paths still produce diagnostics.
