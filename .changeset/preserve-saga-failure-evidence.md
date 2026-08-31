---
"@croco/workflow-core": patch
---

Preserve the original saga failure when compensation bookkeeping or final failure-state recording also fails, and expose the secondary error as diagnostic evidence.
