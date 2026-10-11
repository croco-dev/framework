---
"@croco/promotions-core": minor
"@croco/promotions-drizzle": minor
"@croco/admin-core": minor
"@croco/admin-react": minor
"@croco/frontend-react": minor
"@croco/problems-core": patch
"create-croco-app": patch
---

Add code-registered promotion offers with controlled eligibility, stacking, and budget. Policies pin benefit snapshots into quotes and claims so later revisions never rewrite confirmed terms. Trial credits fulfill through the existing credit ledger adapter (server-only `@croco/promotions-core/credit-grant` subpath); discount quotes stay pure minor-unit math and never claim an unimplemented provider feature. The browser-safe root barrel depends only on problems-core so generated console-web Vite builds no longer pull node-only modules.
