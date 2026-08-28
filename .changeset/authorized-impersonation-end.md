---
"@croco/impersonation-core": minor
"@croco/problems-core": patch
---

Require callers to hold the exact global `impersonation:manage` permission and match the session's original impersonator before ending an impersonation session. Denied termination attempts leave the session unchanged.

This changes `ImpersonationService.end(sessionId)` to `end(context, sessionId)` so termination can resolve and authorize the caller.

Custom `ImpersonationStore` implementations must replace `revoke(sessionId): Promise<void>` with an atomic
`revoke(sessionId, impersonatorId)` operation that returns `revoked` with the removed session, `not-found`, or
`actor-mismatch`.
