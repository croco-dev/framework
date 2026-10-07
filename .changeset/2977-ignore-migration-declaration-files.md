---
"@croco/migration-runner": patch
---

MigrationScanner now ignores TypeScript declaration files (`.d.ts`, `.d.mts`, `.d.cts`) so compiled output directories containing declarations next to `.js` migrations no longer fail with duplicate-id history drift.
