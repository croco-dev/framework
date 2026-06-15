---
"@croco/cli": patch
"@croco/migration-runner": patch
---

`croco migrate status` now delegates to `@croco/migration-runner`, forwards migration flags through the wrapper, and status reads real Drizzle node-postgres row results.
