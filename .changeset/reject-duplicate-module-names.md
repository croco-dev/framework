---
"@croco/framework-module": patch
"@croco/problems-core": patch
---

Reject distinct module definitions that share a name before lifecycle execution while preserving identity-based deduplication for repeated references to the same definition.
