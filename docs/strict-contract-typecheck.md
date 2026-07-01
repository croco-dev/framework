# Strict Contract Typecheck

`pnpm strict-contract-typecheck` is the staged rollout gate for stricter TypeScript options on
contract/core packages. It currently runs these contract-spine packages:

- `@croco/protocols-core`
- `@croco/protocols-rest`
- `@croco/openapi-spec`
- `@croco/rpc-codegen`
- `@croco/transports-http`

Each package runs with:

- `exactOptionalPropertyTypes`
- `noUncheckedIndexedAccess`
- `noPropertyAccessFromIndexSignature`

Each package has a package-specific `tsconfig.contract-strict.json`. The gate validates that every
listed config exists and keeps all required strict options enabled before it invokes TypeScript.

The checked baseline is `tsconfig/contract-strict.baseline.json`. It records the current strict
diagnostics for newly enrolled packages, so any added or removed diagnostic fails CI until the
baseline is intentionally updated.

The script filters diagnostics to the rollout package path. Transitive dependency diagnostics do not
block this package stage, but each newly added rollout package must either be strict-clean or carry an
explicit baseline diagnostic entry plus a matching `deferrals` entry with a package name, reason, and
owner that reviewers can burn down later.
