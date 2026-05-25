---
"@croco/auth-better-auth": patch
---

fix(auth-better-auth): surface session lookup service failures

`BetterAuthSessionManager.getSession()` now keeps returning `null` for invalid or expired sessions while throwing `BetterAuthSessionLookupProblem` for unexpected lookup failures such as network errors, 5xx responses, or SDK failures.
