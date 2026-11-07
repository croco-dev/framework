---
"@croco/events-core": patch
"@croco/events-inmemory": patch
"@croco/problems-core": patch
---

Wait for admitted dead-letter replay storage operations before reporting a drained event bus. Preserve unfinished replay snapshots in timeout/cancellation results and shutdown Problems without consuming handler capacity.
