# @croco/auth-better-auth

## 0.0.3

### Patch Changes

- 99f2a6b: fix(auth-better-auth): surface session lookup service failures

  `BetterAuthSessionManager.getSession()` now keeps returning `null` for invalid or expired sessions while throwing `BetterAuthSessionLookupProblem` for unexpected lookup failures such as network errors, 5xx responses, or SDK failures.

- 99f2a6b: fix: align CommonJS package export maps with emitted dist files
- Updated dependencies [99f2a6b]
- Updated dependencies [99f2a6b]
- Updated dependencies [99f2a6b]
  - @croco/framework-context@0.0.3
  - @croco/auth-core@0.0.3
  - @croco/problems-core@0.0.3
  - @croco/tx-drizzle@0.0.3
