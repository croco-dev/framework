---
"@croco/batch-core": patch
---

Stop new chunk work when the original execution attempt is no longer running, preserving terminal errors and successful in-flight write evidence.
