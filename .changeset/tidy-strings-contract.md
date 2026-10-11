---
"@croco/protocols-core": patch
"create-croco-app": patch
---

Preserve string length bounds in contract snapshots and detect incompatible input and output length changes. Report unsupported contracts when length bounds are combined with string transformations.

Generated application contract baselines preserve their existing minimum string lengths.
