---
"@croco/tasks-core": minor
"@croco/problems-core": patch
---

Derive typed task references from decorator metadata so `TaskRunner.execute` rejects incompatible payloads at compile
time, infers awaited handler results, and fails explicitly when reference and registry identities drift.
