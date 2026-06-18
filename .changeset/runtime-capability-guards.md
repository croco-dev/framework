---
"@croco/framework-context": patch
"@croco/transports-http": patch
---

Runtime context capability support is now exposed as a shared type-level matrix, and unsupported runtime/capability combinations fail typecheck or runtime context creation instead of degrading silently.
