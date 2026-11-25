---
"@croco/access-core": patch
"@croco/auth-core": patch
"@croco/problems-core": patch
---

`@RequirePermission` checks all permissions declared on the same method. A second `@Access` declaration on a method fails during class definition with the non-retryable `access-core/duplicate-access-declaration` Problem.
