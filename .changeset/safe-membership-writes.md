---
"@croco/membership-core": major
"@croco/membership-drizzle": major
---

Require membership changes to use the idempotent command path so owner removal and demotion always preserve the final owner and commit recoverable event intents. Low-level store mutation primitives are now protected adapter hooks rather than application APIs.
