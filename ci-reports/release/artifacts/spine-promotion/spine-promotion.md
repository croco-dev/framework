# Beta Spine Promotion Gate

- Generated at: 2026-09-15T15:50:23.149Z
- Root: `/home/runner/work/framework/framework`
- Beta spine packages: 0
- Blocking failures: 0

## Catalog errors
- none

## Catalog warnings
- none

## Beta spine promotion accountability
| Package | Group | Directory | Owner | Target evidence | Recovery action | Status |
| --- | --- | --- | --- | --- | --- | --- |
| _none_ | _none_ | _none_ | _none_ | _none_ | _none_ | _none_ |

## Non-spine non-production scope
- Non-spine beta, alpha, or deprecated packages ignored by this blocking gate: 88
- Non-spine non-production packages stay outside this gate unless another release path explicitly pulls them into scope.

## Recovery
1. Add or fix `docs/package-catalog.json` `spine.promotion.packages.<name>` with non-empty `owner`, `targetEvidence`, and `recoveryAction`.
2. Rerun `pnpm spine-promotion:check -- --context <current-run-context.json>` and review this report.
3. When the target evidence is complete, move the package from `maturity.beta.packages` to `maturity.production.packages` and rerun `pnpm production-ready:check`.
