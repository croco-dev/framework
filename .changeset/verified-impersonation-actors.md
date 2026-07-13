---
"@croco/impersonation-core": minor
---

Bind impersonation sessions to verified authorized actors and keep the recorded actor immutable for the session lifetime.

This changes `ImpersonationService.start(impersonatorId, targetUserId, reason?)` to
`start(context, targetUserId, reason?)`. Custom `AuthProvider` implementations must replace
`getCurrentUserId(context)` with async `resolvePrincipal(context)` and `targetExists(context, targetUserId)` methods.
