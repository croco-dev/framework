---
"@croco/rpc-codegen": patch
"create-croco-app": patch
---

Preserve own `__proto__`, `constructor` and `prototype` properties in generated query key inputs, including nested objects, without changing their prototypes. Generated clients and scaffold RPC support retain deterministic ordering and existing undefined handling.
