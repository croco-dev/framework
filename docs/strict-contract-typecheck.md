# Strict Contract Typecheck

`pnpm strict-contract-typecheck` is the staged rollout gate for stricter TypeScript options on
contract/core packages. It currently runs `@croco/protocols-core` with:

- `exactOptionalPropertyTypes`
- `noUncheckedIndexedAccess`
- `noPropertyAccessFromIndexSignature`

The package-specific config is `packages/protocols-core/tsconfig.contract-strict.json`. The checked
baseline is `tsconfig/contract-strict.baseline.json`; it is empty for the first rollout package, so
new strict diagnostics fail CI immediately.

The script filters diagnostics to the rollout package path. Transitive dependency diagnostics do not
block this package stage, but each newly added rollout package must either be strict-clean or carry an
explicit baseline entry that reviewers can burn down later.
