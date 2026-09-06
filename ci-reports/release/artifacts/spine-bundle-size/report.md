# Package Quality Dashboard

- Generated at: 2026-09-06T19:38:52.207Z
- Turbo summary directory: `.turbo/runs`
- Source: Turbo run summaries plus repository dependency boundary, public API surface, compatibility train, and bundle-size scans.

## Gate summary
| Gate | Scope | CI mode | Current outcome | Evidence |
| --- | --- | --- | --- | --- |
| `changeset-required:check` | publishable package behavior changes | blocking on PR | success | links public package changes to a required non-README changeset |
| `pnpm check` | repository policy, lint, format, architecture policy, dependency boundaries, strict contract checks, static misuse checks, public API drift | blocking on PR/trunk | success | includes `architecture-policy:check`, `dependency-boundaries:check`, `strict-contract-typecheck`, `static-misuse:check`, and `public-api:check` |
| `package-manifests:check` | package manifests and Croco compatibility train | blocking through `pnpm check` | pass | 18 spine package(s); 149 generated app dependency row(s); 0 generated app range drift(s); 0 peer exception(s); run `pnpm package-manifests:check && pnpm package-quality:report` |
| `public-api:check` | package public export surface drift | blocking through `pnpm check` | pass | snapshot `public-api-surface.snapshot.json`; report `ci-reports/package-quality/public-api-diff.md` |
| `build` | package build tasks | blocking on PR/trunk | success | Turbo `build` summary below |
| `typecheck` | package TypeScript tasks | blocking on PR/trunk | success | Turbo `typecheck` summary below |
| `test` | package test tasks | blocking on PR/trunk | success | Turbo `test` summary below |
| `provider-certification:check` | provider, integration, transport, and presentation certification evidence | blocking on PR/trunk | success | validates catalog certification records and writes `ci-reports/package-quality/provider-certification.md` plus JSON |
| `production-ready:check` | production-ready package maturity evidence | blocking on PR/trunk | success | validates `maturity.production.packages` evidence and writes `ci-reports/package-quality/production-ready.md` |
| `spine-promotion:check` | beta Croco 1.0 spine executable promotion evidence | blocking on PR/trunk | success | resolves structured catalog references against blocking current-run command, package-test, and artifact results and writes `ci-reports/package-quality/spine-promotion.md` |
| `bundle-size:warning` | publishable package generated artifact growth | warning-only until baselines stabilize | warning-only; 364 artifact(s) over baseline, 72 missing bundle-size baseline(s), 3 unmatched bundle-size baseline(s) | report `ci-reports/package-quality/bundle-size.md`; baseline `ci-reports/bundle-size/baseline.json`; run `pnpm build && pnpm package-quality:report` |
| `benchmark` | performance drift | blocking in dedicated benchmark workflow | n/a (separate workflow) | latest-five-green evidence and benchmark baselines are committed |

## Package task totals
| Task | Pass | Fail | Not collected | Not configured | Not run |
| --- | ---: | ---: | ---: | ---: | ---: |
| build | 6 | 0 | 0 | 1 | 117 |
| typecheck | 121 | 0 | 0 | 3 | 0 |
| test | 1 | 0 | 0 | 3 | 120 |

## Failure summary
- none

## Dependency boundary results
| Rule | Package | Status | Evidence |
| --- | --- | --- | --- |
| `repository-core-drizzle-free` | `@croco/repository-core` | pass | Scanned `packages/repository-core/src` |
| `protocols-desktop-runtime-free` | `@croco/protocols-desktop` | pass | Scanned `packages/protocols-desktop/src` |

## Public API surface guard
- Status: pass
- Packages scanned: 120
- Packages with API drift: 0
- Entrypoints with API drift: 0
- Entrypoints added/removed: 0 / 0
- Entrypoint target changes: 0
- Runtime exports added/removed: 0 / 0
- Type exports added/removed: 0 / 0
- Snapshot: `public-api-surface.snapshot.json`
- Diff report: `ci-reports/package-quality/public-api-diff.md`
- Intentional update procedure: run `pnpm public-api:write`, review the runtime/type diff, and include a changeset when a publishable package's import surface, types, or behavior changes.

## Compatibility train policy
- Status: pass
- Policy: Internal @croco/* workspace dependencies use workspace:* except checked peer-only semver exceptions; generated app workspace ranges resolve through the exported tested spine dependency set.
- Internal workspace range: `workspace:*`
- Peer exception metadata: `scripts/internal-peer-dependency-range-exceptions.json`
- Spine packages: `@croco/cli`, `@croco/events-core`, `@croco/events-tx`, `@croco/framework-context`, `@croco/idempotency-core`, `@croco/openapi-spec`, `@croco/problems-core`, `@croco/protocols-core`, `@croco/protocols-rest`, `@croco/retry-core`, `@croco/rpc-codegen`, `@croco/telemetry-api`, `@croco/telemetry-sdk-node`, `@croco/testing`, `@croco/transports-http`, `@croco/tx-core`, `@croco/tx-drizzle`, `create-croco-app`
- Fixed/linked decision: Compatibility-train validation is sufficient for the current 1.0 spine; fixed/linked groups remain intentionally empty.
- Local recovery command: `pnpm package-manifests:check && pnpm package-quality:report`

### Internal range drift
| Package | Dependency | Range | Recovery |
| --- | --- | --- | --- |
| _none_ | _none_ | _none_ | _none_ |

### Checked peer semver exceptions
| Package | Dependency | Range | Owner | Reason | Compatibility rationale |
| --- | --- | --- | --- | --- | --- |
| _none_ | _none_ | _none_ | _none_ | _none_ | _none_ |

### Generated app dependency set
| Package | Scope | Template range | Actual generated range | Expected published range | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| `@croco/access-core` | non-spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/ai-saas/apps/api-server/package.json.hbs` |
| `@croco/access-core` | non-spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/saas/apps/api-server/package.json.hbs` |
| `@croco/admin-core` | non-spine | `workspace:*` | `^0.0.1` | `^0.0.1` | pass | `packages/create-croco-app/templates/admin-console/apps/api-server/package.json.hbs` |
| `@croco/admin-core` | non-spine | `workspace:*` | `^0.0.1` | `^0.0.1` | pass | `packages/create-croco-app/templates/admin-console/apps/console-web/package.json.hbs` |
| `@croco/admin-ops` | non-spine | `workspace:*` | `^0.1.0` | `^0.1.0` | pass | `packages/create-croco-app/templates/admin-console/apps/console-web/package.json.hbs` |
| `@croco/admin-react` | non-spine | `workspace:*` | `^0.1.0` | `^0.1.0` | pass | `packages/create-croco-app/templates/admin-console/apps/console-web/package.json.hbs` |
| `@croco/auth-better-auth` | non-spine | `version-set` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/src/helpers/croco-ranges.ts` |
| `@croco/auth-clerk` | non-spine | `version-set` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/src/helpers/croco-ranges.ts` |
| `@croco/auth-core` | non-spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/ai-saas/apps/api-server/package.json.hbs` |
| `@croco/auth-core` | non-spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/saas/apps/api-server/package.json.hbs` |
| `@croco/auth-drizzle` | non-spine | `version-set` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/src/helpers/croco-ranges.ts` |
| `@croco/billing-core` | non-spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/admin-console/apps/console-web/package.json.hbs` |
| `@croco/billing-core` | non-spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/ai-saas/apps/api-server/package.json.hbs` |
| `@croco/billing-core` | non-spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/saas/apps/api-server/package.json.hbs` |
| `@croco/billing-polar` | non-spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/ai-saas/apps/api-server/package.json.hbs` |
| `@croco/billing-polar` | non-spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/saas/apps/api-server/package.json.hbs` |
| `@croco/cli` | spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/admin-console/package.json.hbs` |
| `@croco/cli` | spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/ai-saas/apps/api-server/package.json.hbs` |
| `@croco/cli` | spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/ai-saas/package.json.hbs` |
| `@croco/cli` | spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/saas/apps/api-server/package.json.hbs` |
| `@croco/cli` | spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/saas/package.json.hbs` |
| `@croco/cli` | spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/spa-be-split/package.json.hbs` |
| `@croco/credits-core` | non-spine | `workspace:*` | `^0.0.1` | `^0.0.1` | pass | `packages/create-croco-app/templates/admin-console/apps/api-server/package.json.hbs` |
| `@croco/diagnostics-core` | non-spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/ai-saas/apps/api-server/package.json.hbs` |
| `@croco/diagnostics-core` | non-spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/saas/apps/api-server/package.json.hbs` |
| `@croco/engagement-core` | non-spine | `workspace:*` | `^0.1.0` | `^0.1.0` | pass | `packages/create-croco-app/templates/ai-saas/apps/api-server/package.json.hbs` |
| `@croco/engagement-core` | non-spine | `workspace:*` | `^0.1.0` | `^0.1.0` | pass | `packages/create-croco-app/templates/saas/apps/api-server/package.json.hbs` |
| `@croco/entitlements-core` | non-spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/ai-saas/apps/api-server/package.json.hbs` |
| `@croco/entitlements-core` | non-spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/saas/apps/api-server/package.json.hbs` |
| `@croco/events-core` | spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/admin-console/apps/api-server/package.json.hbs` |
| `@croco/events-core` | spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/admin-console/apps/console-web/package.json.hbs` |
| `@croco/events-core` | spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/ai-saas/apps/api-server/package.json.hbs` |
| `@croco/events-core` | spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/saas/apps/api-server/package.json.hbs` |
| `@croco/events-core` | spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/spa-be-split/apps/api-server/package.json.hbs` |
| `@croco/events-inmemory` | non-spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/admin-console/apps/api-server/package.json.hbs` |
| `@croco/events-inmemory` | non-spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/spa-be-split/apps/api-server/package.json.hbs` |
| `@croco/execution-core` | non-spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/ai-saas/apps/api-server/package.json.hbs` |
| `@croco/execution-core` | non-spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/saas/apps/api-server/package.json.hbs` |
| `@croco/framework-context` | spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/admin-console/apps/api-server/package.json.hbs` |
| `@croco/framework-context` | spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/ai-saas/apps/api-server/package.json.hbs` |
| `@croco/framework-context` | spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/saas/apps/api-server/package.json.hbs` |
| `@croco/framework-context` | spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/spa-be-split/apps/api-server/package.json.hbs` |
| `@croco/framework-logger` | non-spine | `version-set` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/src/helpers/croco-ranges.ts` |
| `@croco/framework-module` | non-spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/ai-saas/apps/api-server/package.json.hbs` |
| `@croco/framework-module` | non-spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/saas/apps/api-server/package.json.hbs` |
| `@croco/frontend-cloudflare` | non-spine | `workspace:*` | `^0.1.0` | `^0.1.0` | pass | `packages/create-croco-app/templates/addons/web-meta-vite-fullstack/ssr-worker/package.json.hbs` |
| `@croco/frontend-problems` | non-spine | `workspace:*` | `^0.1.0` | `^0.1.0` | pass | `packages/create-croco-app/templates/admin-console/apps/console-web/package.json.hbs` |
| `@croco/frontend-problems` | non-spine | `workspace:*` | `^0.1.0` | `^0.1.0` | pass | `packages/create-croco-app/templates/spa-be-split/apps/console-web/package.json.hbs` |
| `@croco/frontend-problems` | non-spine | `workspace:*` | `^0.1.0` | `^0.1.0` | pass | `packages/create-croco-app/templates/spa-be-split/libs/shared/provider-rpc/package.json.hbs` |
| `@croco/frontend-react` | non-spine | `workspace:*` | `^0.1.0` | `^0.1.0` | pass | `packages/create-croco-app/templates/addons/web-meta-vite-fullstack/ssr-worker/package.json.hbs` |
| `@croco/frontend-react` | non-spine | `workspace:*` | `^0.1.0` | `^0.1.0` | pass | `packages/create-croco-app/templates/addons/web-meta-vite/package.json.hbs` |
| `@croco/frontend-vite` | non-spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/addons/frontend-vite-spa/package.json.hbs` |
| `@croco/frontend-vite` | non-spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/admin-console/apps/console-web/package.json.hbs` |
| `@croco/frontend-vite` | non-spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/spa-be-split/apps/console-web/package.json.hbs` |
| `@croco/health-core` | non-spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/ai-saas/apps/api-server/package.json.hbs` |
| `@croco/health-core` | non-spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/saas/apps/api-server/package.json.hbs` |
| `@croco/idempotency-core` | spine | `workspace:*` | `^0.1.0` | `^0.1.0` | pass | `packages/create-croco-app/templates/ai-saas/apps/api-server/package.json.hbs` |
| `@croco/idempotency-core` | spine | `workspace:*` | `^0.1.0` | `^0.1.0` | pass | `packages/create-croco-app/templates/saas/apps/api-server/package.json.hbs` |
| `@croco/invitation-core` | non-spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/ai-saas/apps/api-server/package.json.hbs` |
| `@croco/invitation-core` | non-spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/saas/apps/api-server/package.json.hbs` |
| `@croco/lifecycle-core` | non-spine | `workspace:*` | `^0.0.1` | `^0.0.1` | pass | `packages/create-croco-app/templates/ai-saas/apps/api-server/package.json.hbs` |
| `@croco/lifecycle-core` | non-spine | `workspace:*` | `^0.0.1` | `^0.0.1` | pass | `packages/create-croco-app/templates/saas/apps/api-server/package.json.hbs` |
| `@croco/llm-core` | non-spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/ai-saas/apps/api-server/package.json.hbs` |
| `@croco/llm-core` | non-spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/saas/apps/api-server/package.json.hbs` |
| `@croco/llm-metering` | non-spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/ai-saas/apps/api-server/package.json.hbs` |
| `@croco/llm-metering` | non-spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/saas/apps/api-server/package.json.hbs` |
| `@croco/membership-core` | non-spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/ai-saas/apps/api-server/package.json.hbs` |
| `@croco/membership-core` | non-spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/saas/apps/api-server/package.json.hbs` |
| `@croco/meta-vite` | non-spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/addons/web-meta-vite-fullstack/ssr-worker/package.json.hbs` |
| `@croco/meta-vite` | non-spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/addons/web-meta-vite/package.json.hbs` |
| `@croco/metering-core` | non-spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/ai-saas/apps/api-server/package.json.hbs` |
| `@croco/metering-core` | non-spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/saas/apps/api-server/package.json.hbs` |
| `@croco/metering-drizzle` | non-spine | `version-set` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/src/helpers/croco-ranges.ts` |
| `@croco/metering-upstash` | non-spine | `version-set` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/src/helpers/croco-ranges.ts` |
| `@croco/notifications-core` | non-spine | `workspace:*` | `^0.1.0` | `^0.1.0` | pass | `packages/create-croco-app/templates/ai-saas/apps/api-server/package.json.hbs` |
| `@croco/notifications-core` | non-spine | `workspace:*` | `^0.1.0` | `^0.1.0` | pass | `packages/create-croco-app/templates/saas/apps/api-server/package.json.hbs` |
| `@croco/openapi-spec` | spine | `workspace:*` | `^0.1.0` | `^0.1.0` | pass | `packages/create-croco-app/templates/admin-console/package.json.hbs` |
| `@croco/openapi-spec` | spine | `workspace:*` | `^0.1.0` | `^0.1.0` | pass | `packages/create-croco-app/templates/ai-saas/package.json.hbs` |
| `@croco/openapi-spec` | spine | `workspace:*` | `^0.1.0` | `^0.1.0` | pass | `packages/create-croco-app/templates/saas/package.json.hbs` |
| `@croco/openapi-spec` | spine | `workspace:*` | `^0.1.0` | `^0.1.0` | pass | `packages/create-croco-app/templates/spa-be-split/package.json.hbs` |
| `@croco/preset-cloudflare` | non-spine | `version-set` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/src/helpers/croco-ranges.ts` |
| `@croco/preset-lambda` | non-spine | `version-set` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/src/helpers/croco-ranges.ts` |
| `@croco/problems-core` | spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/addons/web-meta-vite-fullstack/ssr-worker/package.json.hbs` |
| `@croco/problems-core` | spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/addons/web-meta-vite/package.json.hbs` |
| `@croco/problems-core` | spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/admin-console/apps/api-server/package.json.hbs` |
| `@croco/problems-core` | spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/admin-console/apps/console-web/package.json.hbs` |
| `@croco/problems-core` | spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/ai-saas/apps/api-server/package.json.hbs` |
| `@croco/problems-core` | spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/saas/apps/api-server/package.json.hbs` |
| `@croco/problems-core` | spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/saas/libs/shared/provider-rpc/package.json.hbs` |
| `@croco/problems-core` | spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/spa-be-split/apps/api-server/package.json.hbs` |
| `@croco/problems-core` | spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/spa-be-split/apps/console-web/package.json.hbs` |
| `@croco/problems-core` | spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/spa-be-split/libs/shared/provider-rpc/package.json.hbs` |
| `@croco/protocols-core` | spine | `workspace:*` | `^0.1.0` | `^0.1.0` | pass | `packages/create-croco-app/templates/admin-console/apps/api-server/package.json.hbs` |
| `@croco/protocols-core` | spine | `workspace:*` | `^0.1.0` | `^0.1.0` | pass | `packages/create-croco-app/templates/ai-saas/apps/api-server/package.json.hbs` |
| `@croco/protocols-core` | spine | `workspace:*` | `^0.1.0` | `^0.1.0` | pass | `packages/create-croco-app/templates/saas/apps/api-server/package.json.hbs` |
| `@croco/protocols-core` | spine | `workspace:*` | `^0.1.0` | `^0.1.0` | pass | `packages/create-croco-app/templates/spa-be-split/apps/api-server/package.json.hbs` |
| `@croco/protocols-graphql` | non-spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/addons/graphql-nextjs/apps/web/package.json.hbs` |
| `@croco/protocols-graphql` | non-spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/addons/graphql-standalone/apps/graphql-api/package.json.hbs` |
| `@croco/protocols-rest` | spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/admin-console/apps/api-server/package.json.hbs` |
| `@croco/protocols-rest` | spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/ai-saas/apps/api-server/package.json.hbs` |
| `@croco/protocols-rest` | spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/ai-saas/package.json.hbs` |
| `@croco/protocols-rest` | spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/saas/apps/api-server/package.json.hbs` |
| `@croco/protocols-rest` | spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/saas/package.json.hbs` |
| `@croco/protocols-rest` | spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/spa-be-split/apps/api-server/package.json.hbs` |
| `@croco/ratelimit-core` | non-spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/addons/web-meta-vite-fullstack/api-worker/package.json.hbs` |
| `@croco/ratelimit-core` | non-spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/admin-console/apps/api-server/package.json.hbs` |
| `@croco/ratelimit-core` | non-spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/ai-saas/apps/api-server/package.json.hbs` |
| `@croco/ratelimit-core` | non-spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/saas/apps/api-server/package.json.hbs` |
| `@croco/ratelimit-core` | non-spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/spa-be-split/apps/api-server/package.json.hbs` |
| `@croco/repository-core` | non-spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/admin-console/apps/api-server/package.json.hbs` |
| `@croco/repository-core` | non-spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/spa-be-split/apps/api-server/package.json.hbs` |
| `@croco/retry-core` | spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/admin-console/apps/api-server/package.json.hbs` |
| `@croco/retry-core` | spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/spa-be-split/apps/api-server/package.json.hbs` |
| `@croco/rpc-codegen` | spine | `workspace:*` | `^0.1.0` | `^0.1.0` | pass | `packages/create-croco-app/templates/admin-console/package.json.hbs` |
| `@croco/rpc-codegen` | spine | `workspace:*` | `^0.1.0` | `^0.1.0` | pass | `packages/create-croco-app/templates/ai-saas/package.json.hbs` |
| `@croco/rpc-codegen` | spine | `workspace:*` | `^0.1.0` | `^0.1.0` | pass | `packages/create-croco-app/templates/saas/package.json.hbs` |
| `@croco/rpc-codegen` | spine | `workspace:*` | `^0.1.0` | `^0.1.0` | pass | `packages/create-croco-app/templates/spa-be-split/package.json.hbs` |
| `@croco/storage-cloudinary` | non-spine | `version-set` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/src/helpers/croco-ranges.ts` |
| `@croco/storage-core` | non-spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/saas/apps/api-server/package.json.hbs` |
| `@croco/storage-r2` | non-spine | `version-set` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/src/helpers/croco-ranges.ts` |
| `@croco/tasks-core` | non-spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/saas/apps/api-server/package.json.hbs` |
| `@croco/tasks-qstash` | non-spine | `version-set` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/src/helpers/croco-ranges.ts` |
| `@croco/telemetry-api` | spine | `workspace:*` | `^0.1.0` | `^0.1.0` | pass | `packages/create-croco-app/templates/admin-console/apps/api-server/package.json.hbs` |
| `@croco/telemetry-api` | spine | `workspace:*` | `^0.1.0` | `^0.1.0` | pass | `packages/create-croco-app/templates/ai-saas/apps/api-server/package.json.hbs` |
| `@croco/telemetry-api` | spine | `workspace:*` | `^0.1.0` | `^0.1.0` | pass | `packages/create-croco-app/templates/saas/apps/api-server/package.json.hbs` |
| `@croco/telemetry-api` | spine | `workspace:*` | `^0.1.0` | `^0.1.0` | pass | `packages/create-croco-app/templates/spa-be-split/apps/api-server/package.json.hbs` |
| `@croco/telemetry-sdk-node` | spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/addons/graphql-standalone/apps/graphql-api/package.json.hbs` |
| `@croco/telemetry-sdk-node` | spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/admin-console/apps/api-server/package.json.hbs` |
| `@croco/telemetry-sdk-node` | spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/ai-saas/apps/api-server/package.json.hbs` |
| `@croco/telemetry-sdk-node` | spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/saas/apps/api-server/package.json.hbs` |
| `@croco/telemetry-sdk-node` | spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/spa-be-split/apps/api-server/package.json.hbs` |
| `@croco/tenant-core` | non-spine | `workspace:*` | `^0.1.0` | `^0.1.0` | pass | `packages/create-croco-app/templates/ai-saas/apps/api-server/package.json.hbs` |
| `@croco/tenant-core` | non-spine | `workspace:*` | `^0.1.0` | `^0.1.0` | pass | `packages/create-croco-app/templates/saas/apps/api-server/package.json.hbs` |
| `@croco/testing` | spine | `workspace:*` | `^0.0.1` | `^0.0.1` | pass | `packages/create-croco-app/templates/ai-saas/apps/api-server/package.json.hbs` |
| `@croco/testing` | spine | `workspace:*` | `^0.0.1` | `^0.0.1` | pass | `packages/create-croco-app/templates/saas/apps/api-server/package.json.hbs` |
| `@croco/transports-cloudflare-workers` | non-spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/addons/web-meta-vite-fullstack/api-worker/package.json.hbs` |
| `@croco/transports-http` | spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/addons/web-meta-vite-fullstack/api-worker/package.json.hbs` |
| `@croco/transports-http` | spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/admin-console/apps/api-server/package.json.hbs` |
| `@croco/transports-http` | spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/ai-saas/apps/api-server/package.json.hbs` |
| `@croco/transports-http` | spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/saas/apps/api-server/package.json.hbs` |
| `@croco/transports-http` | spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/spa-be-split/apps/api-server/package.json.hbs` |
| `@croco/triggers-qstash` | non-spine | `version-set` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/src/helpers/croco-ranges.ts` |
| `@croco/tx-core` | spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/ai-saas/apps/api-server/package.json.hbs` |
| `@croco/tx-core` | spine | `workspace:*` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/templates/saas/apps/api-server/package.json.hbs` |
| `@croco/tx-drizzle` | spine | `version-set` | `^0.0.4` | `^0.0.4` | pass | `packages/create-croco-app/src/helpers/croco-ranges.ts` |
| `@croco/ui-astryx` | non-spine | `version-set` | `^0.1.0` | `^0.1.0` | pass | `packages/create-croco-app/src/helpers/croco-ranges.ts` |
| `@croco/webhooks-core` | non-spine | `workspace:*` | `^0.1.0` | `^0.1.0` | pass | `packages/create-croco-app/templates/admin-console/apps/api-server/package.json.hbs` |
| `@croco/webhooks-core` | non-spine | `workspace:*` | `^0.1.0` | `^0.1.0` | pass | `packages/create-croco-app/templates/ai-saas/apps/api-server/package.json.hbs` |
| `@croco/webhooks-core` | non-spine | `workspace:*` | `^0.1.0` | `^0.1.0` | pass | `packages/create-croco-app/templates/saas/apps/api-server/package.json.hbs` |

## Bundle size warning
- Status: warning-only; 364 artifact(s) over baseline, 72 missing bundle-size baseline(s), 3 unmatched bundle-size baseline(s)
- Report: `ci-reports/package-quality/bundle-size.md`
- Baseline input: `ci-reports/bundle-size/baseline.json`
- Local recovery command: `pnpm build && pnpm package-quality:report`

## Package matrix
| Package | Build | Typecheck | Test | Notes |
| --- | --- | --- | --- | --- |
| `@croco-example/quick-start-lambda` | not-run | not-configured | not-configured | private package |
| `@croco-example/saas-billing-golden-path` | not-run | pass | not-run | private package |
| `@croco/access-core` | not-run | pass | not-run |  |
| `@croco/access-drizzle` | not-run | pass | not-run |  |
| `@croco/admin-core` | not-run | pass | not-run |  |
| `@croco/admin-generated` | not-run | pass | not-run |  |
| `@croco/admin-ops` | not-run | pass | not-run |  |
| `@croco/admin-react` | not-run | pass | not-run |  |
| `@croco/analytics-core` | not-run | pass | not-run |  |
| `@croco/analytics-posthog` | not-run | pass | not-configured |  |
| `@croco/architecture-policy` | not-run | pass | not-run |  |
| `@croco/audit-core` | not-run | pass | not-run |  |
| `@croco/audit-drizzle` | not-run | pass | not-run |  |
| `@croco/auth-better-auth` | not-run | pass | not-run |  |
| `@croco/auth-clerk` | not-run | pass | not-run |  |
| `@croco/auth-core` | not-run | pass | not-run |  |
| `@croco/auth-drizzle` | not-run | pass | not-run |  |
| `@croco/batch-core` | not-run | pass | not-run |  |
| `@croco/batch-qstash` | not-run | pass | not-run |  |
| `@croco/billing-core` | not-run | pass | not-run |  |
| `@croco/billing-polar` | not-run | pass | not-run |  |
| `@croco/cache-core` | not-run | pass | not-run |  |
| `@croco/cli` | not-run | pass | not-run |  |
| `@croco/credits-core` | not-run | pass | not-run |  |
| `@croco/credits-drizzle` | not-run | pass | not-run |  |
| `@croco/customer-health-core` | not-run | pass | not-run |  |
| `@croco/customer-health-drizzle` | not-run | pass | not-run |  |
| `@croco/dataloader-core` | not-run | pass | not-run |  |
| `@croco/desktop-codegen` | not-run | pass | not-run |  |
| `@croco/diagnostics-core` | pass | pass | not-run |  |
| `@croco/docs` | not-run | not-configured | not-configured | private package |
| `@croco/engagement-core` | not-run | pass | not-run |  |
| `@croco/engagement-drizzle` | not-run | pass | not-run |  |
| `@croco/entitlements-core` | not-run | pass | not-run |  |
| `@croco/entitlements-drizzle` | not-run | pass | not-run |  |
| `@croco/esbuild-plugin` | not-run | pass (cached) | not-run |  |
| `@croco/events-core` | not-run | pass | pass (cached) |  |
| `@croco/events-inmemory` | not-run | pass | not-run |  |
| `@croco/events-tx` | not-run | pass | not-run |  |
| `@croco/execution-core` | not-run | pass | not-run |  |
| `@croco/execution-drizzle` | not-run | pass | not-run |  |
| `@croco/features-core` | not-run | pass | not-run |  |
| `@croco/features-posthog` | not-run | pass | not-run |  |
| `@croco/framework-config` | not-run | pass | not-run |  |
| `@croco/framework-context` | pass | pass | not-run |  |
| `@croco/framework-logger` | not-run | pass | not-run |  |
| `@croco/framework-module` | not-run | pass | not-run |  |
| `@croco/framework-preset` | not-run | pass (cached) | not-run |  |
| `@croco/framework-routes` | not-run | pass | not-run |  |
| `@croco/frontend-cloudflare` | not-run | pass | not-run |  |
| `@croco/frontend-problems` | not-run | pass | not-run |  |
| `@croco/frontend-react` | not-run | pass | not-run |  |
| `@croco/frontend-vite` | not-run | pass | not-run |  |
| `@croco/gid-core` | not-run | pass | not-run |  |
| `@croco/governance-core` | not-run | pass | not-run |  |
| `@croco/health-core` | pass | pass | not-run |  |
| `@croco/idempotency-core` | not-run | pass | not-run |  |
| `@croco/impersonation-core` | not-run | pass | not-run |  |
| `@croco/integrations-posthog` | not-run | pass | not-run |  |
| `@croco/invitation-core` | not-run | pass | not-run |  |
| `@croco/invitation-drizzle` | not-run | pass | not-run |  |
| `@croco/lifecycle-core` | not-run | pass | not-run |  |
| `@croco/llm-core` | not-run | pass | not-run |  |
| `@croco/llm-metering` | not-run | pass | not-run |  |
| `@croco/llm-openai` | not-run | pass | not-run |  |
| `@croco/membership-core` | not-run | pass | not-run |  |
| `@croco/membership-drizzle` | not-run | pass | not-run |  |
| `@croco/meta-vite` | not-run | pass | not-run |  |
| `@croco/metering-core` | not-run | pass | not-run |  |
| `@croco/metering-drizzle` | not-run | pass | not-run |  |
| `@croco/metering-upstash` | not-run | pass | not-run |  |
| `@croco/metrics-billing` | not-run | pass | not-run |  |
| `@croco/metrics-core` | not-run | pass | not-run |  |
| `@croco/migration-runner` | not-run | pass | not-run |  |
| `@croco/notifications-core` | not-run | pass | not-run |  |
| `@croco/notifications-react-email` | not-run | pass | not-run |  |
| `@croco/notifications-resend` | not-run | pass | not-run |  |
| `@croco/onboarding-core` | not-run | pass | not-run |  |
| `@croco/onboarding-drizzle` | not-run | pass | not-run |  |
| `@croco/openapi-spec` | not-run | pass | not-run |  |
| `@croco/outbox-core` | not-run | pass | not-run |  |
| `@croco/oxlint-rules` | not-configured | not-configured | not-run | private package |
| `@croco/pagination-core` | not-run | pass | not-run |  |
| `@croco/presentation-preset` | not-run | pass | not-run |  |
| `@croco/preset-cloudflare` | not-run | pass (cached) | not-run |  |
| `@croco/preset-lambda` | not-run | pass | not-run |  |
| `@croco/preset-node` | not-run | pass | not-run |  |
| `@croco/problems-core` | pass | pass | not-run |  |
| `@croco/protocol-codegen` | not-run | pass | not-run |  |
| `@croco/protocols-core` | pass | pass | not-run |  |
| `@croco/protocols-desktop` | not-run | pass | not-run |  |
| `@croco/protocols-graphql` | not-run | pass | not-run |  |
| `@croco/protocols-rest` | pass | pass | not-run |  |
| `@croco/protocols-trpc` | not-run | pass | not-run |  |
| `@croco/ratelimit-core` | not-run | pass | not-run |  |
| `@croco/ratelimit-upstash` | not-run | pass | not-run |  |
| `@croco/repository-core` | not-run | pass | not-run |  |
| `@croco/retry-core` | not-run | pass | not-run |  |
| `@croco/rpc-codegen` | not-run | pass | not-run |  |
| `@croco/search-core` | not-run | pass | not-run |  |
| `@croco/search-drizzle` | not-run | pass | not-run |  |
| `@croco/search-meilisearch` | not-run | pass | not-run |  |
| `@croco/storage-cloudflare` | not-run | pass | not-run |  |
| `@croco/storage-cloudinary` | not-run | pass | not-run |  |
| `@croco/storage-core` | not-run | pass | not-run |  |
| `@croco/storage-r2` | not-run | pass | not-run |  |
| `@croco/tasks-core` | not-run | pass | not-run |  |
| `@croco/tasks-qstash` | not-run | pass | not-run |  |
| `@croco/telemetry-api` | not-run | pass (cached) | not-run |  |
| `@croco/telemetry-sdk-node` | not-run | pass | not-run |  |
| `@croco/tenant-core` | not-run | pass | not-run |  |
| `@croco/testing` | not-run | pass | not-run |  |
| `@croco/testing-resources` | not-run | pass | not-run |  |
| `@croco/transports-cloudflare-workers` | not-run | pass | not-run |  |
| `@croco/transports-graphql` | not-run | pass | not-run |  |
| `@croco/transports-http` | not-run | pass | not-run |  |
| `@croco/triggers-core` | not-run | pass | not-run |  |
| `@croco/triggers-qstash` | not-run | pass | not-run |  |
| `@croco/tx-core` | not-run | pass | not-run |  |
| `@croco/tx-drizzle` | not-run | pass | not-run |  |
| `@croco/ui-astryx` | not-run | pass | not-run |  |
| `@croco/webhooks-core` | not-run | pass | not-run |  |
| `@croco/workflow-core` | not-run | pass | not-run |  |
| `create-croco-app` | not-run | pass | not-run |  |

## Trunk gate rollout
- Current blocking gates: changeset-required, package manifest compatibility train, architecture-policy, dependency-boundaries, static-misuse, lint/format/policy checks, build, typecheck, test, provider-certification, production-ready, spine-promotion, and the dedicated benchmark workflow.
- Current advisory gates: production audit in CI, core coverage baseline warnings, and bundle-size warnings. Release publish gates still run `pnpm audit:prod` as blocking.
- Promote warning-only gates only after the dashboard shows stable package-level ownership, no unknown package rows, and documented baselines.
- New packages should appear in this dashboard with explicit build/typecheck/test support or an intentional not-configured state.
