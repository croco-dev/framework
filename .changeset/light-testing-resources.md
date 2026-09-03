---
"@croco/testing-resources": patch
"@croco/problems-core": patch
---

Keep PostgreSQL, Redis, and container drivers out of the default runtime and TypeScript install paths while live
resources report the exact opt-in dependency command when a required driver is missing.
