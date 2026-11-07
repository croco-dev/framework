---
"@croco/retry-core": patch
---

Circuit state resets preserve active and queued in-memory locks, keeping operations on the same circuit serialized until each owner finishes.
