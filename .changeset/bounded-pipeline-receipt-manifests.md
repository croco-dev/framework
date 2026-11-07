---
"@croco/etl-core": patch
"@croco/warehouse-core": minor
"@croco/warehouse-postgres": patch
---

Keep file-pipeline checkpoints bounded with versioned receipt manifests. Durable input-range evidence
and quarantine diagnostics stay in warehouse receipts and can be read in bounded pages. Manifest
sealing validates every receipt without retaining the full batch history. Existing list-based warehouse
callers remain supported; custom catalog implementations must provide `readReceipts`. Legacy pipeline
bindings and checkpoints require inspection and a new run instead of resuming with version-3 semantics.
