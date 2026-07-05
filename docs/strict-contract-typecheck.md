# Strict Contract Typecheck

`pnpm strict-contract-typecheck` is the staged rollout gate for stricter TypeScript options on the
Croco 1.0 spine. The command derives the spine from `docs/package-catalog.json`
`spine.packages`, resolves each slug through `packages/<slug>/package.json`, and fails when the
baseline does not account for every spine package.

The current enrolled package set is the full 1.0 spine:

- `@croco/framework-context`
- `@croco/problems-core`
- `@croco/protocols-core`
- `@croco/protocols-rest`
- `@croco/openapi-spec`
- `@croco/rpc-codegen`
- `@croco/transports-http`
- `@croco/telemetry-api`
- `@croco/telemetry-sdk-node`
- `@croco/tx-core`
- `@croco/tx-drizzle`
- `@croco/events-core`
- `@croco/events-tx`
- `@croco/retry-core`
- `@croco/idempotency-core`
- `@croco/testing`
- `create-croco-app`
- `@croco/cli`

Each package runs with:

- `exactOptionalPropertyTypes`
- `noUncheckedIndexedAccess`
- `noPropertyAccessFromIndexSignature`

Each enrolled package has a package-specific `tsconfig.contract-strict.json`. The gate validates
that every listed config exists and keeps all required strict options enabled before it invokes
TypeScript.

The checked baseline is `tsconfig/contract-strict.baseline.json`. It records the current strict
diagnostics for newly enrolled packages, so any added or removed diagnostic fails CI until the
baseline is intentionally updated.

The baseline is also the machine-readable release debt manifest:

- `packages` is the enrolled strict-contract package list.
- `exemptions` is the explicitly excluded spine package list. Exemptions require `packageName`,
  `owner`, `reason`, and either `expiresOn` or `targetMilestone`.
- `packages` and `exemptions` must be disjoint and together must equal the 1.0 spine package names
  resolved from the catalog.
- `deferrals` records package-level diagnostic debt. Each deferral requires `packageName`, `owner`,
  `reason`, `debt`, and either `expiresOn` or `targetMilestone`.

`debt: "staged-rollout"` means the diagnostic is accepted only for the normal staged rollout gate.
It keeps trunk protected from drift while the package is being hardened. `debt:
"accepted-release-debt"` means the diagnostic has been explicitly accepted for the 1.0 release
candidate gate.

Run RC mode with either:

```bash
pnpm strict-contract-typecheck --rc
CROCO_STRICT_CONTRACT_RC=1 pnpm strict-contract-typecheck
```

RC mode still rejects added or removed diagnostics. It also rejects unchanged baseline diagnostics
unless their deferral is marked `accepted-release-debt`. In other words, RC mode allows only zero
strict diagnostics or explicitly accepted 1.0 release debt.

The script filters diagnostics to the enrolled package path. Transitive dependency diagnostics do not
block this package stage, but each newly enrolled package must either be strict-clean or carry an
explicit baseline diagnostic entry plus matching `deferrals` metadata that reviewers can burn down
later.

The release-facing summary reports:

- staged versus RC mode,
- full spine, enrolled, and exempted package counts,
- added, removed, and unchanged baseline diagnostics,
- staged rollout deferrals,
- accepted release debt deferrals,
- and any explicit exemptions.
