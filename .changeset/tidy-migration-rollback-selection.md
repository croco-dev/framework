---
"@croco/migration-runner": patch
"@croco/problems-core": patch
---

Reject simultaneous target and count arguments in down and previewDown before migration scanning or database access. Choose either a target rollback or a bounded count rollback.
