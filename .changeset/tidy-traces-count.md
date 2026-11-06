---
"@croco/testing": patch
---

Evidence bundles check attachments from every attempt alongside record attachments, so a summary report cannot hide a missing trace. Imported v1 records use the same aggregation and duplicate artifact paths produce one missing-artifact entry per record. Imported records are probed using their original artifact paths while returned evidence remains redacted.
