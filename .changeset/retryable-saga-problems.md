---
"@croco/workflow-core": patch
---

Retry saga steps when Croco Problems declare transient failure through `extensions.retryable`, preserve that classification in exhausted failure evidence, and keep top-level overrides and non-retryable Problem behavior.
