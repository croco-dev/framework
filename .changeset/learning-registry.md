---
"@croco/admin-core": minor
"@croco/admin-postgres": minor
"@croco/admin-react": minor
"@croco/problems-core": patch
---

Preserve scoped learning records with separate facts, hypotheses, evidence, decisions and next actions. Learning mutations, revision history, audit and retry receipts commit atomically in PostgreSQL. The learning workspace uses the same authorized APIs and retains local drafts on revision conflicts.

The learning-registry/input and learning-registry/transition Problems use validation status 422; learning-registry/denied uses 403; learning-registry/not-found uses 404; learning-registry/revision-conflict and learning-registry/idempotency-conflict use 409; learning-registry/storage-failed uses 500. Their generated registry categories and recovery metadata match the runtime contracts.
