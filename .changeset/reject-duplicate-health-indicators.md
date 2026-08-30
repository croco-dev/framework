---
"@croco/health-core": patch
"@croco/problems-core": patch
"@croco/transports-http": patch
---

Reject repeated health and readiness indicator identities across explicit and legacy registration paths before checks run.

Registration Problems now report only source-safe identity kinds instead of reflecting caller-supplied indicator IDs or names.
HTTP health registrations validate before mutating adapter state, and duplicate diagnostics no longer reflect registration names.
