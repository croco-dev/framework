---
"@croco/workflow-core": patch
"@croco/problems-core": patch
---

Reject same-key saga requests with `SagaExecutionInFlightProblem` (HTTP 409) while the existing execution is pending or running, including step compensation. Completed results remain reusable, and failed or compensated executions retain their stored failure response.
