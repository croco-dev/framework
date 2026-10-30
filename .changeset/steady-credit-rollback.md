---
"@croco/credits-core": patch
---

Retain immutable ledger records in internal rollback snapshots to avoid repeatedly deep-copying large credit histories while preserving atomic failure recovery and defensive public reads.
