---
"@croco/workflow-core": minor
---

Add optional clock callbacks to SagaRunner, WorkflowRunner, and InMemorySagaStore for deterministic timestamps without global time mocks. The default saga store shares its runner's clock; invocation IDs retain random suffixes.
