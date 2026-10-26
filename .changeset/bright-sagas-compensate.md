---
"@croco/workflow-core": patch
---

Compensate successful Saga steps even when both their completion and fallback failure records cannot be saved, preserving the original failure and secondary recording evidence.
