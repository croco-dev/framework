---
"@croco/batch-core": patch
---

Stop new chunk work when the original execution attempt is no longer running, preserving terminal errors and successful in-flight write evidence from that same attempt. Writes that finish after an observed replacement attempt starts do not update checkpoints or progress.
