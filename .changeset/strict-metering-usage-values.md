---
"@croco/metering-core": minor
"@croco/problems-core": patch
---

Reject usage values outside the positive 32-bit integer range before idempotency or storage, and fail closed when Redis contains an invalid or unsafe accumulated value.
