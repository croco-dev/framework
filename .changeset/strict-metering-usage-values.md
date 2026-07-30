---
"@croco/metering-core": minor
"@croco/llm-metering": minor
"@croco/metering-drizzle": minor
"@croco/problems-core": patch
---

Reject usage values outside the positive safe-integer range before idempotency or storage, fail closed when Redis contains an invalid or unsafe accumulated value, encode LLM USD cost meters as integer nanodollars, and widen PostgreSQL metering integers to BIGINT so every adapter preserves the same contract.
