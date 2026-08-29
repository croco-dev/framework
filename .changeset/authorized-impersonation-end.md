---
"@croco/impersonation-core": minor
"@croco/problems-core": patch
---

Require callers to hold the exact global `impersonation:manage` permission and match the session's original impersonator before ending an impersonation session. Denied termination attempts leave the session unchanged.

This changes `ImpersonationService.end(sessionId)` to `end(context, sessionId)` so termination can resolve and authorize the caller.

Custom `ImpersonationStore` implementations must use the atomic `commitEnd(intent, impersonatorId)` operation.
It returns `committed`, `committed-start-pending`, `session-not-found`, or `actor-mismatch`, and an actor mismatch
must preserve both the session and its pending lifecycle event intent.
