# Beta Spine Promotion Gate

- Generated at: 2026-10-17T21:11:13.208Z
- Root: `/home/runner/work/framework/framework`
- Beta spine packages: 2
- Blocking failures: 0

## Catalog errors
- none

## Catalog warnings
- none

## Beta spine promotion accountability
| Package | Group | Directory | Owner | Target evidence | Recovery action | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `@croco/cli` | Tooling | `packages/cli` | operator-tooling | behavior: croco doctor behavior (test, src/tests/doctor.spec.ts)<br>compatibility: CLI contract compatibility (test, src/tests/contractsCheck.spec.ts)<br>failure-recovery: stable diagnostic recovery codes (test, src/tests/diagnosticCodes.spec.ts) | Complete CLI spine-readiness diagnostics and smoke evidence, then move cli from maturity.beta.packages to maturity.production.packages when production-ready:check passes. | promotion-ready |
| `@croco/testing` | Tooling | `packages/testing` | release-tooling | behavior: test harness behavior (test, src/tests/testing.spec.ts)<br>compatibility: conformance utility contract (test, src/tests/ConformanceContract.spec.ts)<br>failure-recovery: operational failure drills (test, src/tests/OperationalFailureDrill.spec.ts) | Complete test harness docs and conformance evidence, then move testing from maturity.beta.packages to maturity.production.packages when production-ready:check passes. | promotion-ready |

## Non-spine non-production scope
- Non-spine beta, alpha, or deprecated packages ignored by this blocking gate: 108
- Non-spine non-production packages stay outside this gate unless another release path explicitly pulls them into scope.

## Recovery
1. Add or fix `docs/package-catalog.json` `spine.promotion.packages.<name>` with non-empty `owner`, `targetEvidence`, and `recoveryAction`.
2. Rerun `pnpm spine-promotion:check -- --context <current-run-context.json>` and review this report.
3. When the target evidence is complete, move the package from `maturity.beta.packages` to `maturity.production.packages` and rerun `pnpm production-ready:check`.
