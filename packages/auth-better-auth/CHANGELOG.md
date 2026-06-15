# @croco/auth-better-auth

## 0.0.4

### Patch Changes

- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.
- Updated dependencies [a61dcd4]
- Updated dependencies [d707a0c]
- Updated dependencies [aacdad6]
- Updated dependencies [41ee87a]
- Updated dependencies [d1552a5]
- Updated dependencies [844234f]
  - @croco/framework-context@0.0.4
  - @croco/auth-core@0.0.4
  - @croco/problems-core@0.0.4
  - @croco/tx-drizzle@0.0.4

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
