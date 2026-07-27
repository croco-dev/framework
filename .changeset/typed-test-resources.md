---
"@croco/testing": minor
"@croco/testing-resources": minor
"@croco/problems-core": patch
---

Run optional digest-pinned PostgreSQL and Redis resources before production application bootstrap, inject typed connections into kernel-scoped Croco providers, and retain structured lifecycle, migration, isolation, and cleanup evidence.

Test kernels now reject rollback-mode evidence for commit-semantic obligations such as after-commit hooks and transactional outbox behavior.

The generated Problem registry now includes the typed test-resource lifecycle and fidelity diagnostics.
