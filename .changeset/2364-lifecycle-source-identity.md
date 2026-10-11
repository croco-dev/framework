---
"@croco/lifecycle-core": patch
"@croco/problems-core": patch
---

Lifecycle default dedupe now preserves the redeliverable source event identity instead of estimating it from timestamps or payloads. Missing source identity fails with `lifecycle-core/source-identity-missing`, same-identity redelivery returns the same logical run, conflicting payloads fail with `lifecycle-core/source-payload-conflict`, and legacy default receipts keep deduping during migration.
