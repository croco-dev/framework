---
"@croco/impersonation-core": minor
"@croco/problems-core": patch
---

Require the authenticated, globally authorized session impersonator to end an impersonation session without mutating denied sessions.

This changes `ImpersonationService.end(sessionId)` to `end(context, sessionId)` so termination can resolve and authorize the caller.

Custom `ImpersonationStore` implementations must replace `revoke(sessionId): Promise<void>` with an atomic
`revoke(sessionId, impersonatorId)` operation that returns `revoked` with the removed session, `not-found`, or
`actor-mismatch`.
