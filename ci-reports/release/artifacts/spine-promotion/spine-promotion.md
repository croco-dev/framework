# Beta Spine Promotion Gate

- Generated at: 2026-09-06T19:38:50.333Z
- Root: `/home/runner/work/framework/framework`
- Beta spine packages: 1
- Blocking failures: 0

## Catalog errors
- none

## Catalog warnings
- none

## Beta spine promotion accountability
| Package | Group | Directory | Owner | Target evidence | Recovery action | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `@croco/idempotency-core` | Core | `packages/idempotency-core` | reliability-core | behavior: idempotency coordinator behavior (test, src/tests/IdempotencyCoordinator.spec.ts)<br>compatibility: idempotency conformance contract (test, src/tests/IdempotencyConformance.spec.ts)<br>failure-recovery: idempotency key failure boundaries (test, src/tests/KeyDerivation.spec.ts) | Complete idempotency contract and diagnostics evidence, then move idempotency-core from maturity.beta.packages to maturity.production.packages when production-ready:check passes. | promotion-ready |

## Non-spine non-production scope
- Non-spine beta, alpha, or deprecated packages ignored by this blocking gate: 88
- Non-spine non-production packages stay outside this gate unless another release path explicitly pulls them into scope.

## Recovery
1. Add or fix `docs/package-catalog.json` `spine.promotion.packages.<name>` with non-empty `owner`, `targetEvidence`, and `recoveryAction`.
2. Rerun `pnpm spine-promotion:check -- --context <current-run-context.json>` and review this report.
3. When the target evidence is complete, move the package from `maturity.beta.packages` to `maturity.production.packages` and rerun `pnpm production-ready:check`.
