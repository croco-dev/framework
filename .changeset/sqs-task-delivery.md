---
"@croco/tasks-sqs": minor
"@croco/testing": minor
"create-croco-app": patch
"@croco/problems-core": patch
---

Publish tenant-bound tasks through AWS SQS and consume Lambda batches through the existing task execution ledger, with partial failures, FIFO ordering and shared dispatcher conformance.

The generated recovery policies for `tasks-sqs/invalid-configuration` and `tasks-sqs/publish-failed` are explicitly non-retryable, matching their runtime diagnostics. Correct publisher or consumer configuration before reconstructing the dispatcher or Lambda handler; reconcile unknown publication and durable execution outcomes before considering a manual retry.
