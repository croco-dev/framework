---
"@croco/execution-core": minor
"@croco/execution-drizzle": patch
"create-croco-app": patch
---

Execution stores now merge individual checkpoint keys atomically as part of their required contract. Concurrent writes to different keys are preserved. Same-key writes are serialized by the store with the last applied mutation winning, without an invocation-order guarantee.
