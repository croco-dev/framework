---
"@croco/gid-core": patch
"@croco/problems-core": patch
---

- Reject dynamically constructed ID registries when multiple keys use the same serialized prefix, with the
  duplicate-prefix Problem included in the public registry.
