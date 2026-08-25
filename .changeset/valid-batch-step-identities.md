---
"@croco/batch-core": patch
"@croco/batch-qstash": patch
"@croco/problems-core": patch
---

- reject blank and duplicate batch step names before checkpoint execution with stable typed diagnostics
- validate structurally supplied QStash steps against the shared batch step identity contract before claiming execution state
