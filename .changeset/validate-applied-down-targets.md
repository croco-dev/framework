---
"@croco/migration-runner": patch
"@croco/problems-core": patch
---

Reject malformed or unapplied `down` targets before any rollback body runs, including dry-run previews, while preserving rollback through the applied target.
