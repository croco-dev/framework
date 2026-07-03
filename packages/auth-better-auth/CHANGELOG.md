# @croco/auth-better-auth

## 0.0.4

### Patch Changes

- ca4c15a: - Expose shared auth provider conformance coverage with readiness diagnostics for Better Auth and Clerk adapters.
- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.
- Updated dependencies [4d8f094]
- Updated dependencies [6769a7f]
- Updated dependencies [d281518]
- Updated dependencies [0b43229]
- Updated dependencies [ee924c0]
- Updated dependencies [5403360]
- Updated dependencies [e12e825]
- Updated dependencies [6831875]
- Updated dependencies [9cd8667]
- Updated dependencies [2f0dae2]
- Updated dependencies [ddfc6d1]
- Updated dependencies [513188f]
- Updated dependencies [a61dcd4]
- Updated dependencies [4c7fcd9]
- Updated dependencies [1dc1607]
- Updated dependencies [8c5b00c]
- Updated dependencies [48ce207]
- Updated dependencies [6c26eb4]
- Updated dependencies [f8842d3]
- Updated dependencies [d707a0c]
- Updated dependencies [aacdad6]
- Updated dependencies [9c2ac20]
- Updated dependencies [de7610e]
- Updated dependencies [14bd9f8]
- Updated dependencies [0618b12]
- Updated dependencies [41ee87a]
- Updated dependencies [c54e7b5]
- Updated dependencies [d1552a5]
- Updated dependencies [3ca4a69]
- Updated dependencies [844234f]
  - @croco/diagnostics-core@0.0.4
  - @croco/framework-context@0.0.4
  - @croco/tx-drizzle@0.0.4
  - @croco/problems-core@0.0.4
  - @croco/auth-core@0.0.4

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
