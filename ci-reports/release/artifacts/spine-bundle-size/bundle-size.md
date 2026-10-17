# Bundle Size Warning Report

- CI mode: warning-only
- Scope: publishable workspace packages with a `build` script and generated `dist` artifacts (`.js`, `.mjs`, `.cjs`, `.css`, `.wasm`, `.map`, `.json`, `.d.ts`).
- Baseline input: `ci-reports/bundle-size/baseline.json`
- Local recovery command: `pnpm build && pnpm package-quality:report`
- Allowed spine positive delta: 0 B

## Warning summary
- Measured packages: 139
- Measured artifacts: 641
- Missing baselines: 249
- Over-baseline artifacts: 364
- Unmatched baselines: 4
- Packages without measured dist artifacts: 0
- Spine blocking regressions: 0
- Spine blocking setup issues: 0
- Spine blocking unmatched baselines: 0
- Advisory warnings: 617

## Spine blocking enforcement
- Mode: warning-only
- Policy: Spine package artifacts may not grow by any positive byte delta over the committed baseline.
- Spine packages: _none_

| Package | Artifact | Size | Baseline | Delta | Status | Reason |
| --- | --- | ---: | ---: | ---: | --- | --- |
| _none_ | _none_ | - | - | - | - | - |

### Blocking unmatched baselines
| Baseline key | Reason |
| --- | --- |
| _none_ | - |

## Non-spine advisory warnings
Non-spine packages stay advisory in spine enforcement mode.

| Package | Artifact | Size | Baseline | Delta | Status | Reason |
| --- | --- | ---: | ---: | ---: | --- | --- |
| `@croco/access-core` | `packages/access-core/dist/index.d.ts` | 7.3 KiB | 6.8 KiB | +439 B (+6.3%) | over-baseline | non-spine package remains advisory |
| `@croco/access-core` | `packages/access-core/dist/index.js` | 12.2 KiB | 9.3 KiB | +2.9 KiB (+31.5%) | over-baseline | non-spine package remains advisory |
| `@croco/access-core` | `packages/access-core/dist/index.mjs` | 11.3 KiB | 8.5 KiB | +2.8 KiB (+33.6%) | over-baseline | non-spine package remains advisory |
| `@croco/access-drizzle` | `packages/access-drizzle/dist/index.d.ts` | 4.9 KiB | 4.8 KiB | +70 B (+1.4%) | over-baseline | non-spine package remains advisory |
| `@croco/access-drizzle` | `packages/access-drizzle/dist/index.js` | 4.2 KiB | 3.4 KiB | +765 B (+21.7%) | over-baseline | non-spine package remains advisory |
| `@croco/access-drizzle` | `packages/access-drizzle/dist/index.mjs` | 3.6 KiB | 2.9 KiB | +793 B (+27.0%) | over-baseline | non-spine package remains advisory |
| `@croco/admin-core` | `packages/admin-core/dist/chunk-*.mjs` | 1.4 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/admin-core` | `packages/admin-core/dist/fact-history-operations.d.ts` | 330 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/admin-core` | `packages/admin-core/dist/fact-history-operations.js` | 3.3 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/admin-core` | `packages/admin-core/dist/fact-history-operations.mjs` | 2.4 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/admin-core` | `packages/admin-core/dist/fact-history-validation-DJCEn0uT.d.ts` | 3.3 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/admin-core` | `packages/admin-core/dist/fact-history-validation.d.ts` | 221 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/admin-core` | `packages/admin-core/dist/fact-history-validation.js` | 1.6 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/admin-core` | `packages/admin-core/dist/fact-history-validation.mjs` | 1.0 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/admin-core` | `packages/admin-core/dist/index.d.ts` | 147.1 KiB | 8.0 KiB | +139.1 KiB (+1734.1%) | over-baseline | non-spine package remains advisory |
| `@croco/admin-core` | `packages/admin-core/dist/index.js` | 160.9 KiB | 8.9 KiB | +152.0 KiB (+1698.8%) | over-baseline | non-spine package remains advisory |
| `@croco/admin-core` | `packages/admin-core/dist/index.mjs` | 154.2 KiB | 8.4 KiB | +145.8 KiB (+1727.1%) | over-baseline | non-spine package remains advisory |
| `@croco/admin-core` | `packages/admin-core/dist/survey-operations.d.ts` | 743 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/admin-core` | `packages/admin-core/dist/survey-operations.js` | 1.3 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/admin-core` | `packages/admin-core/dist/survey-operations.mjs` | 151 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/admin-core` | `packages/admin-core/dist/targeting-impact-operations.d.ts` | 3.0 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/admin-core` | `packages/admin-core/dist/targeting-impact-operations.js` | 7.1 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/admin-core` | `packages/admin-core/dist/targeting-impact-operations.mjs` | 5.8 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/admin-generated` | `packages/admin-generated/dist/index.d.ts` | 5.4 KiB | 4.7 KiB | +647 B (+13.4%) | over-baseline | non-spine package remains advisory |
| `@croco/admin-generated` | `packages/admin-generated/dist/index.js` | 19.7 KiB | 15.4 KiB | +4.3 KiB (+28.3%) | over-baseline | non-spine package remains advisory |
| `@croco/admin-generated` | `packages/admin-generated/dist/index.mjs` | 18.9 KiB | 14.6 KiB | +4.3 KiB (+29.7%) | over-baseline | non-spine package remains advisory |
| `@croco/admin-ops` | `packages/admin-ops/dist/index.d.ts` | 23.5 KiB | 18.4 KiB | +5.1 KiB (+27.6%) | over-baseline | non-spine package remains advisory |
| `@croco/admin-ops` | `packages/admin-ops/dist/index.js` | 37.8 KiB | 21.3 KiB | +16.5 KiB (+77.4%) | over-baseline | non-spine package remains advisory |
| `@croco/admin-ops` | `packages/admin-ops/dist/index.mjs` | 35.6 KiB | 19.8 KiB | +15.8 KiB (+80.0%) | over-baseline | non-spine package remains advisory |
| `@croco/admin-postgres` | `packages/admin-postgres/dist/index.d.ts` | 3.2 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/admin-postgres` | `packages/admin-postgres/dist/index.js` | 12.7 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/admin-postgres` | `packages/admin-postgres/dist/index.mjs` | 11.7 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/admin-react` | `packages/admin-react/dist/chunk-*.mjs` | 21.5 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/admin-react` | `packages/admin-react/dist/experience-console.d.ts` | 943 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/admin-react` | `packages/admin-react/dist/experience-console.js` | 9.1 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/admin-react` | `packages/admin-react/dist/experience-console.mjs` | 102 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/admin-react` | `packages/admin-react/dist/experiment-console.d.ts` | 1.1 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/admin-react` | `packages/admin-react/dist/experiment-console.js` | 9.5 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/admin-react` | `packages/admin-react/dist/experiment-console.mjs` | 102 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/admin-react` | `packages/admin-react/dist/index.d.ts` | 93.1 KiB | 40.2 KiB | +52.9 KiB (+131.6%) | over-baseline | non-spine package remains advisory |
| `@croco/admin-react` | `packages/admin-react/dist/index.js` | 339.0 KiB | 40.1 KiB | +299.0 KiB (+746.2%) | over-baseline | non-spine package remains advisory |
| `@croco/admin-react` | `packages/admin-react/dist/index.mjs` | 283.4 KiB | 35.7 KiB | +247.7 KiB (+693.6%) | over-baseline | non-spine package remains advisory |
| `@croco/admin-react` | `packages/admin-react/dist/surveys.d.ts` | 1.6 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/admin-react` | `packages/admin-react/dist/surveys.js` | 6.5 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/admin-react` | `packages/admin-react/dist/surveys.mjs` | 149 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/ai-usage` | `packages/ai-usage/dist/index.cjs` | 15.2 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/ai-usage` | `packages/ai-usage/dist/index.d.ts` | 12.0 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/ai-usage` | `packages/ai-usage/dist/index.js` | 14.3 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/analytics-core` | `packages/analytics-core/dist/GrowthAnalysis-5KrkVSJo.d.ts` | 3.4 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/analytics-core` | `packages/analytics-core/dist/chunk-*.mjs` | 7.7 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/analytics-core` | `packages/analytics-core/dist/index.d.ts` | 13.7 KiB | 937 B | +12.8 KiB (+1401.2%) | over-baseline | non-spine package remains advisory |
| `@croco/analytics-core` | `packages/analytics-core/dist/index.js` | 19.6 KiB | 649 B | +19.0 KiB (+2990.9%) | over-baseline | non-spine package remains advisory |
| `@croco/analytics-core` | `packages/analytics-core/dist/index.mjs` | 11.2 KiB | 161 B | +11.1 KiB (+7032.3%) | over-baseline | non-spine package remains advisory |
| `@croco/analytics-core` | `packages/analytics-core/dist/runtime.d.ts` | 5.4 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/analytics-core` | `packages/analytics-core/dist/runtime.js` | 11.5 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/analytics-core` | `packages/analytics-core/dist/runtime.mjs` | 9.2 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/analytics-drizzle` | `packages/analytics-drizzle/dist/index.d.ts` | 1.4 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/analytics-drizzle` | `packages/analytics-drizzle/dist/index.js` | 10.5 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/analytics-drizzle` | `packages/analytics-drizzle/dist/index.mjs` | 9.5 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/analytics-posthog` | `packages/analytics-posthog/dist/index.d.ts` | 3.9 KiB | 3.2 KiB | +704 B (+21.7%) | over-baseline | non-spine package remains advisory |
| `@croco/analytics-posthog` | `packages/analytics-posthog/dist/index.js` | 11.2 KiB | 7.8 KiB | +3.4 KiB (+44.4%) | over-baseline | non-spine package remains advisory |
| `@croco/analytics-posthog` | `packages/analytics-posthog/dist/index.mjs` | 10.4 KiB | 7.2 KiB | +3.3 KiB (+45.8%) | over-baseline | non-spine package remains advisory |
| `@croco/architecture-policy` | `packages/architecture-policy/dist/index.js` | 31.1 KiB | 27.0 KiB | +4.1 KiB (+15.3%) | over-baseline | non-spine package remains advisory |
| `@croco/audit-core` | `packages/audit-core/dist/index.d.ts` | 5.4 KiB | 4.2 KiB | +1.3 KiB (+30.5%) | over-baseline | non-spine package remains advisory |
| `@croco/audit-core` | `packages/audit-core/dist/index.js` | 17.4 KiB | 7.1 KiB | +10.3 KiB (+145.6%) | over-baseline | non-spine package remains advisory |
| `@croco/audit-core` | `packages/audit-core/dist/index.mjs` | 16.8 KiB | 6.5 KiB | +10.3 KiB (+157.2%) | over-baseline | non-spine package remains advisory |
| `@croco/audit-drizzle` | `packages/audit-drizzle/dist/index.d.ts` | 16.8 KiB | 16.7 KiB | +53 B (+0.3%) | over-baseline | non-spine package remains advisory |
| `@croco/audit-drizzle` | `packages/audit-drizzle/dist/index.js` | 5.5 KiB | 4.8 KiB | +748 B (+15.3%) | over-baseline | non-spine package remains advisory |
| `@croco/audit-drizzle` | `packages/audit-drizzle/dist/index.mjs` | 4.8 KiB | 4.0 KiB | +790 B (+19.2%) | over-baseline | non-spine package remains advisory |
| `@croco/auth-better-auth` | `packages/auth-better-auth/dist/index.d.ts` | 74.9 KiB | 28.3 KiB | +46.6 KiB (+164.3%) | over-baseline | non-spine package remains advisory |
| `@croco/auth-better-auth` | `packages/auth-better-auth/dist/index.js` | 24.4 KiB | 14.7 KiB | +9.7 KiB (+66.2%) | over-baseline | non-spine package remains advisory |
| `@croco/auth-better-auth` | `packages/auth-better-auth/dist/index.mjs` | 22.9 KiB | 13.4 KiB | +9.5 KiB (+70.8%) | over-baseline | non-spine package remains advisory |
| `@croco/auth-clerk` | `packages/auth-clerk/dist/index.d.ts` | 17.1 KiB | 13.2 KiB | +3.8 KiB (+29.1%) | over-baseline | non-spine package remains advisory |
| `@croco/auth-clerk` | `packages/auth-clerk/dist/index.js` | 29.7 KiB | 19.8 KiB | +10.0 KiB (+50.4%) | over-baseline | non-spine package remains advisory |
| `@croco/auth-clerk` | `packages/auth-clerk/dist/index.mjs` | 28.3 KiB | 18.6 KiB | +9.7 KiB (+52.1%) | over-baseline | non-spine package remains advisory |
| `@croco/auth-core` | `packages/auth-core/dist/index.d.ts` | 14.3 KiB | 10.3 KiB | +4.0 KiB (+38.7%) | over-baseline | non-spine package remains advisory |
| `@croco/auth-core` | `packages/auth-core/dist/index.js` | 22.5 KiB | 13.2 KiB | +9.3 KiB (+70.0%) | over-baseline | non-spine package remains advisory |
| `@croco/auth-core` | `packages/auth-core/dist/index.mjs` | 20.8 KiB | 12.0 KiB | +8.8 KiB (+74.0%) | over-baseline | non-spine package remains advisory |
| `@croco/auth-drizzle` | `packages/auth-drizzle/dist/index.d.ts` | 38.0 KiB | 28.3 KiB | +9.7 KiB (+34.4%) | over-baseline | non-spine package remains advisory |
| `@croco/auth-drizzle` | `packages/auth-drizzle/dist/index.js` | 18.3 KiB | 8.6 KiB | +9.7 KiB (+113.4%) | over-baseline | non-spine package remains advisory |
| `@croco/auth-drizzle` | `packages/auth-drizzle/dist/index.mjs` | 16.4 KiB | 7.4 KiB | +9.0 KiB (+121.9%) | over-baseline | non-spine package remains advisory |
| `@croco/batch-core` | `packages/batch-core/dist/index.d.ts` | 4.8 KiB | 3.3 KiB | +1.5 KiB (+44.7%) | over-baseline | non-spine package remains advisory |
| `@croco/batch-core` | `packages/batch-core/dist/index.js` | 6.9 KiB | 3.9 KiB | +3.0 KiB (+76.6%) | over-baseline | non-spine package remains advisory |
| `@croco/batch-core` | `packages/batch-core/dist/index.mjs` | 6.2 KiB | 3.4 KiB | +2.8 KiB (+82.2%) | over-baseline | non-spine package remains advisory |
| `@croco/batch-qstash` | `packages/batch-qstash/dist/index.d.ts` | 3.0 KiB | 1.7 KiB | +1.3 KiB (+77.0%) | over-baseline | non-spine package remains advisory |
| `@croco/batch-qstash` | `packages/batch-qstash/dist/index.js` | 10.6 KiB | 5.9 KiB | +4.7 KiB (+78.9%) | over-baseline | non-spine package remains advisory |
| `@croco/batch-qstash` | `packages/batch-qstash/dist/index.mjs` | 10.0 KiB | 5.3 KiB | +4.7 KiB (+87.9%) | over-baseline | non-spine package remains advisory |
| `@croco/billing-core` | `packages/billing-core/dist/cancellation.d.ts` | 7.2 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/billing-core` | `packages/billing-core/dist/cancellation.js` | 4.1 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/billing-core` | `packages/billing-core/dist/cancellation.mjs` | 328 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/billing-core` | `packages/billing-core/dist/chunk-*.mjs` | 3.6 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/billing-core` | `packages/billing-core/dist/index.d.ts` | 71.8 KiB | 14.4 KiB | +57.5 KiB (+400.4%) | over-baseline | non-spine package remains advisory |
| `@croco/billing-core` | `packages/billing-core/dist/index.js` | 91.4 KiB | 13.0 KiB | +78.4 KiB (+601.1%) | over-baseline | non-spine package remains advisory |
| `@croco/billing-core` | `packages/billing-core/dist/index.mjs` | 84.1 KiB | 12.1 KiB | +72.0 KiB (+594.7%) | over-baseline | non-spine package remains advisory |
| `@croco/billing-drizzle` | `packages/billing-drizzle/dist/index.d.ts` | 3.9 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/billing-drizzle` | `packages/billing-drizzle/dist/index.js` | 14.6 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/billing-drizzle` | `packages/billing-drizzle/dist/index.mjs` | 13.8 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/billing-polar` | `packages/billing-polar/dist/index.d.ts` | 14.0 KiB | 6.0 KiB | +7.9 KiB (+132.1%) | over-baseline | non-spine package remains advisory |
| `@croco/billing-polar` | `packages/billing-polar/dist/index.js` | 40.1 KiB | 15.9 KiB | +24.2 KiB (+152.1%) | over-baseline | non-spine package remains advisory |
| `@croco/billing-polar` | `packages/billing-polar/dist/index.mjs` | 38.6 KiB | 15.1 KiB | +23.6 KiB (+156.4%) | over-baseline | non-spine package remains advisory |
| `@croco/cache-core` | `packages/cache-core/dist/index.d.ts` | 22.1 KiB | 13.2 KiB | +8.9 KiB (+67.3%) | over-baseline | non-spine package remains advisory |
| `@croco/cache-core` | `packages/cache-core/dist/index.js` | 28.5 KiB | 14.3 KiB | +14.2 KiB (+98.8%) | over-baseline | non-spine package remains advisory |
| `@croco/cache-core` | `packages/cache-core/dist/index.mjs` | 26.7 KiB | 13.0 KiB | +13.8 KiB (+106.1%) | over-baseline | non-spine package remains advisory |
| `@croco/cli` | `packages/cli/dist/agent.d.ts` | 1008 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/cli` | `packages/cli/dist/agent.js` | 243 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/cli` | `packages/cli/dist/architecturePolicy-*.js` | 369 B | 309 B | +60 B (+19.4%) | over-baseline | non-spine package remains advisory |
| `@croco/cli` | `packages/cli/dist/bin/croco-agent.d.ts` | 20 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/cli` | `packages/cli/dist/bin/croco-agent.js` | 2.6 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/cli` | `packages/cli/dist/chunk-*.js` | 1.91 MiB | 334.7 KiB | +1.59 MiB (+485.3%) | over-baseline | non-spine package remains advisory |
| `@croco/cli` | `packages/cli/dist/codegen-*.js` | 191 B | 101 B | +90 B (+89.1%) | over-baseline | non-spine package remains advisory |
| `@croco/cli` | `packages/cli/dist/contracts-*.js` | 255 B | 105 B | +150 B (+142.9%) | over-baseline | non-spine package remains advisory |
| `@croco/cli` | `packages/cli/dist/create-*.js` | 279 B | 189 B | +90 B (+47.6%) | over-baseline | non-spine package remains advisory |
| `@croco/cli` | `packages/cli/dist/data-*.js` | 10.6 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/cli` | `packages/cli/dist/di-*.js` | 181 B | 121 B | +60 B (+49.6%) | over-baseline | non-spine package remains advisory |
| `@croco/cli` | `packages/cli/dist/generate-*.js` | 343 B | 223 B | +120 B (+53.8%) | over-baseline | non-spine package remains advisory |
| `@croco/cli` | `packages/cli/dist/index.d.ts` | 31.7 KiB | 28.1 KiB | +3.6 KiB (+12.8%) | over-baseline | non-spine package remains advisory |
| `@croco/cli` | `packages/cli/dist/index.js` | 4.9 KiB | 4.1 KiB | +877 B (+20.9%) | over-baseline | non-spine package remains advisory |
| `@croco/cli` | `packages/cli/dist/jobs-*.js` | 749 B | 659 B | +90 B (+13.7%) | over-baseline | non-spine package remains advisory |
| `@croco/cli` | `packages/cli/dist/jobs.js` | 561 B | 471 B | +90 B (+19.1%) | over-baseline | non-spine package remains advisory |
| `@croco/cli` | `packages/cli/dist/make-*.js` | 245 B | 155 B | +90 B (+58.1%) | over-baseline | non-spine package remains advisory |
| `@croco/cli` | `packages/cli/dist/ops-*.js` | 461 B | 371 B | +90 B (+24.3%) | over-baseline | non-spine package remains advisory |
| `@croco/cli` | `packages/cli/dist/ops.js` | 299 B | 239 B | +60 B (+25.1%) | over-baseline | non-spine package remains advisory |
| `@croco/cli` | `packages/cli/dist/pipeline-*.js` | 4.8 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/cli` | `packages/cli/dist/project-*.js` | 576 B | 426 B | +150 B (+35.2%) | over-baseline | non-spine package remains advisory |
| `@croco/cli` | `packages/cli/dist/runtimePolicy-*.js` | 359 B | 269 B | +90 B (+33.5%) | over-baseline | non-spine package remains advisory |
| `@croco/cli` | `packages/cli/dist/test-*.js` | 12.8 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/cli` | `packages/cli/dist/upgrade-*.js` | 395 B | 305 B | +90 B (+29.5%) | over-baseline | non-spine package remains advisory |
| `@croco/cohort-core` | `packages/cohort-core/dist/index.d.ts` | 6.2 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/cohort-core` | `packages/cohort-core/dist/index.js` | 9.1 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/cohort-core` | `packages/cohort-core/dist/index.mjs` | 8.4 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/cohort-drizzle` | `packages/cohort-drizzle/dist/index.d.ts` | 3.3 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/cohort-drizzle` | `packages/cohort-drizzle/dist/index.js` | 12.9 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/cohort-drizzle` | `packages/cohort-drizzle/dist/index.mjs` | 12.0 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/credits-core` | `packages/credits-core/dist/index.d.ts` | 21.6 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/credits-core` | `packages/credits-core/dist/index.js` | 51.5 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/credits-core` | `packages/credits-core/dist/index.mjs` | 49.9 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/credits-drizzle` | `packages/credits-drizzle/dist/index.d.ts` | 90.1 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/credits-drizzle` | `packages/credits-drizzle/dist/index.js` | 53.2 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/credits-drizzle` | `packages/credits-drizzle/dist/index.mjs` | 48.2 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/customer-health-core` | `packages/customer-health-core/dist/index.d.ts` | 10.5 KiB | 5.7 KiB | +4.8 KiB (+83.9%) | over-baseline | non-spine package remains advisory |
| `@croco/customer-health-core` | `packages/customer-health-core/dist/index.js` | 15.5 KiB | 4.8 KiB | +10.7 KiB (+225.1%) | over-baseline | non-spine package remains advisory |
| `@croco/customer-health-core` | `packages/customer-health-core/dist/index.mjs` | 14.4 KiB | 4.1 KiB | +10.3 KiB (+249.8%) | over-baseline | non-spine package remains advisory |
| `@croco/customer-health-drizzle` | `packages/customer-health-drizzle/dist/index.d.ts` | 18.6 KiB | 9.6 KiB | +9.0 KiB (+93.7%) | over-baseline | non-spine package remains advisory |
| `@croco/customer-health-drizzle` | `packages/customer-health-drizzle/dist/index.js` | 14.6 KiB | 4.6 KiB | +10.0 KiB (+215.1%) | over-baseline | non-spine package remains advisory |
| `@croco/customer-health-drizzle` | `packages/customer-health-drizzle/dist/index.mjs` | 13.7 KiB | 4.1 KiB | +9.6 KiB (+235.7%) | over-baseline | non-spine package remains advisory |
| `@croco/dataloader-core` | `packages/dataloader-core/dist/index.cjs` | 12.1 KiB | 8.4 KiB | +3.7 KiB (+44.2%) | over-baseline | non-spine package remains advisory |
| `@croco/dataloader-core` | `packages/dataloader-core/dist/index.d.ts` | 3.6 KiB | 2.6 KiB | +1.1 KiB (+41.3%) | over-baseline | non-spine package remains advisory |
| `@croco/dataloader-core` | `packages/dataloader-core/dist/index.js` | 10.7 KiB | 7.1 KiB | +3.6 KiB (+50.6%) | over-baseline | non-spine package remains advisory |
| `@croco/diagnostics-core` | `packages/diagnostics-core/dist/index.d.ts` | 24.3 KiB | 16.3 KiB | +8.0 KiB (+49.2%) | over-baseline | non-spine package remains advisory |
| `@croco/diagnostics-core` | `packages/diagnostics-core/dist/index.js` | 55.0 KiB | 38.2 KiB | +16.8 KiB (+43.9%) | over-baseline | non-spine package remains advisory |
| `@croco/diagnostics-core` | `packages/diagnostics-core/dist/index.mjs` | 54.2 KiB | 37.5 KiB | +16.7 KiB (+44.6%) | over-baseline | non-spine package remains advisory |
| `@croco/engagement-core` | `packages/engagement-core/dist/index.d.ts` | 60.4 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/engagement-core` | `packages/engagement-core/dist/index.js` | 124.8 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/engagement-core` | `packages/engagement-core/dist/index.mjs` | 120.5 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/engagement-drizzle` | `packages/engagement-drizzle/dist/index.d.ts` | 215.0 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/engagement-drizzle` | `packages/engagement-drizzle/dist/index.js` | 67.4 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/engagement-drizzle` | `packages/engagement-drizzle/dist/index.mjs` | 61.8 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/entitlements-core` | `packages/entitlements-core/dist/index.d.ts` | 17.9 KiB | 11.6 KiB | +6.3 KiB (+53.9%) | over-baseline | non-spine package remains advisory |
| `@croco/entitlements-core` | `packages/entitlements-core/dist/index.js` | 30.4 KiB | 15.8 KiB | +14.6 KiB (+92.3%) | over-baseline | non-spine package remains advisory |
| `@croco/entitlements-core` | `packages/entitlements-core/dist/index.mjs` | 28.6 KiB | 14.5 KiB | +14.1 KiB (+97.3%) | over-baseline | non-spine package remains advisory |
| `@croco/entitlements-drizzle` | `packages/entitlements-drizzle/dist/index.d.ts` | 12.8 KiB | 7.4 KiB | +5.4 KiB (+73.8%) | over-baseline | non-spine package remains advisory |
| `@croco/entitlements-drizzle` | `packages/entitlements-drizzle/dist/index.js` | 14.3 KiB | 2.4 KiB | +11.9 KiB (+494.4%) | over-baseline | non-spine package remains advisory |
| `@croco/entitlements-drizzle` | `packages/entitlements-drizzle/dist/index.mjs` | 13.2 KiB | 1.9 KiB | +11.3 KiB (+610.3%) | over-baseline | non-spine package remains advisory |
| `@croco/esbuild-plugin` | `packages/esbuild-plugin/dist/index.d.ts` | 7.8 KiB | 2.4 KiB | +5.4 KiB (+228.4%) | over-baseline | non-spine package remains advisory |
| `@croco/esbuild-plugin` | `packages/esbuild-plugin/dist/index.js` | 42.7 KiB | 8.6 KiB | +34.1 KiB (+396.5%) | over-baseline | non-spine package remains advisory |
| `@croco/esbuild-plugin` | `packages/esbuild-plugin/dist/index.mjs` | 41.8 KiB | 7.8 KiB | +34.0 KiB (+434.1%) | over-baseline | non-spine package remains advisory |
| `@croco/etl-core` | `packages/etl-core/dist/chunk-*.mjs` | 12.8 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/etl-core` | `packages/etl-core/dist/index.d.ts` | 320 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/etl-core` | `packages/etl-core/dist/index.js` | 13.3 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/etl-core` | `packages/etl-core/dist/index.mjs` | 210 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/etl-core` | `packages/etl-core/dist/pipeline.d.ts` | 7.1 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/etl-core` | `packages/etl-core/dist/pipeline.js` | 30.8 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/etl-core` | `packages/etl-core/dist/pipeline.mjs` | 19.1 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/etl-core` | `packages/etl-core/dist/source.d.ts` | 1.6 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/etl-core` | `packages/etl-core/dist/source.js` | 13.3 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/etl-core` | `packages/etl-core/dist/source.mjs` | 210 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/etl-core` | `packages/etl-core/dist/types-zHkwzeIb.d.ts` | 890 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/etl-events-tx` | `packages/etl-events-tx/dist/AnalyticsOutboxConsumer-T_-xjuxg.d.ts` | 2.7 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/etl-events-tx` | `packages/etl-events-tx/dist/chunk-*.mjs` | 323 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/etl-events-tx` | `packages/etl-events-tx/dist/index.d.ts` | 672 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/etl-events-tx` | `packages/etl-events-tx/dist/index.js` | 5.1 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/etl-events-tx` | `packages/etl-events-tx/dist/index.mjs` | 4.4 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/etl-events-tx` | `packages/etl-events-tx/dist/postgres.d.ts` | 1.2 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/etl-events-tx` | `packages/etl-events-tx/dist/postgres.js` | 2.1 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/etl-events-tx` | `packages/etl-events-tx/dist/postgres.mjs` | 1.4 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/events-core` | `packages/events-core/dist/index.js` | 18.9 KiB | 12.8 KiB | +6.1 KiB (+47.4%) | over-baseline | non-spine package remains advisory |
| `@croco/events-core` | `packages/events-core/dist/index.mjs` | 17.3 KiB | 11.7 KiB | +5.6 KiB (+48.4%) | over-baseline | non-spine package remains advisory |
| `@croco/events-inmemory` | `packages/events-inmemory/dist/index.d.ts` | 12.8 KiB | 3.3 KiB | +9.5 KiB (+289.7%) | over-baseline | non-spine package remains advisory |
| `@croco/events-inmemory` | `packages/events-inmemory/dist/index.js` | 25.6 KiB | 8.4 KiB | +17.2 KiB (+206.1%) | over-baseline | non-spine package remains advisory |
| `@croco/events-inmemory` | `packages/events-inmemory/dist/index.mjs` | 24.3 KiB | 7.8 KiB | +16.5 KiB (+211.8%) | over-baseline | non-spine package remains advisory |
| `@croco/events-tx` | `packages/events-tx/dist/index.d.ts` | 46.5 KiB | 40.0 KiB | +6.5 KiB (+16.3%) | over-baseline | non-spine package remains advisory |
| `@croco/events-tx` | `packages/events-tx/dist/index.js` | 52.4 KiB | 30.0 KiB | +22.4 KiB (+74.6%) | over-baseline | non-spine package remains advisory |
| `@croco/events-tx` | `packages/events-tx/dist/index.mjs` | 50.2 KiB | 28.5 KiB | +21.7 KiB (+76.0%) | over-baseline | non-spine package remains advisory |
| `@croco/execution-core` | `packages/execution-core/dist/index.d.ts` | 36.2 KiB | 16.8 KiB | +19.4 KiB (+115.8%) | over-baseline | non-spine package remains advisory |
| `@croco/execution-core` | `packages/execution-core/dist/index.js` | 26.2 KiB | 8.1 KiB | +18.1 KiB (+222.7%) | over-baseline | non-spine package remains advisory |
| `@croco/execution-core` | `packages/execution-core/dist/index.mjs` | 25.2 KiB | 7.5 KiB | +17.7 KiB (+234.6%) | over-baseline | non-spine package remains advisory |
| `@croco/execution-drizzle` | `packages/execution-drizzle/dist/index.d.ts` | 18.2 KiB | 14.6 KiB | +3.6 KiB (+25.1%) | over-baseline | non-spine package remains advisory |
| `@croco/execution-drizzle` | `packages/execution-drizzle/dist/index.js` | 14.4 KiB | 6.4 KiB | +8.1 KiB (+126.4%) | over-baseline | non-spine package remains advisory |
| `@croco/execution-drizzle` | `packages/execution-drizzle/dist/index.mjs` | 13.4 KiB | 5.7 KiB | +7.8 KiB (+136.9%) | over-baseline | non-spine package remains advisory |
| `@croco/experience-core` | `packages/experience-core/dist/index.d.ts` | 13.6 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/experience-core` | `packages/experience-core/dist/index.js` | 20.5 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/experience-core` | `packages/experience-core/dist/index.mjs` | 19.7 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/experience-drizzle` | `packages/experience-drizzle/dist/index.d.ts` | 2.4 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/experience-drizzle` | `packages/experience-drizzle/dist/index.js` | 19.4 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/experience-drizzle` | `packages/experience-drizzle/dist/index.mjs` | 18.5 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/features-core` | `packages/features-core/dist/index.d.ts` | 39.0 KiB | 712 B | +38.3 KiB (+5511.1%) | over-baseline | non-spine package remains advisory |
| `@croco/features-core` | `packages/features-core/dist/index.js` | 51.4 KiB | 610 B | +50.8 KiB (+8528.7%) | over-baseline | non-spine package remains advisory |
| `@croco/features-core` | `packages/features-core/dist/index.mjs` | 49.8 KiB | 124 B | +49.7 KiB (+41028.2%) | over-baseline | non-spine package remains advisory |
| `@croco/features-drizzle` | `packages/features-drizzle/dist/index.d.ts` | 73.7 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/features-drizzle` | `packages/features-drizzle/dist/index.js` | 58.1 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/features-drizzle` | `packages/features-drizzle/dist/index.mjs` | 53.3 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/features-posthog` | `packages/features-posthog/dist/index.d.ts` | 1.4 KiB | 675 B | +769 B (+113.9%) | over-baseline | non-spine package remains advisory |
| `@croco/features-posthog` | `packages/features-posthog/dist/index.js` | 4.3 KiB | 1.9 KiB | +2.4 KiB (+130.7%) | over-baseline | non-spine package remains advisory |
| `@croco/features-posthog` | `packages/features-posthog/dist/index.mjs` | 3.8 KiB | 1.4 KiB | +2.4 KiB (+169.5%) | over-baseline | non-spine package remains advisory |
| `@croco/framework-config` | `packages/framework-config/dist/index.d.ts` | 9.4 KiB | 3.0 KiB | +6.3 KiB (+207.4%) | over-baseline | non-spine package remains advisory |
| `@croco/framework-config` | `packages/framework-config/dist/index.js` | 9.9 KiB | 3.8 KiB | +6.1 KiB (+159.0%) | over-baseline | non-spine package remains advisory |
| `@croco/framework-config` | `packages/framework-config/dist/index.mjs` | 9.1 KiB | 3.2 KiB | +5.9 KiB (+182.4%) | over-baseline | non-spine package remains advisory |
| `@croco/framework-context` | `packages/framework-context/dist/index.d.ts` | 65.3 KiB | 41.6 KiB | +23.7 KiB (+57.0%) | over-baseline | non-spine package remains advisory |
| `@croco/framework-context` | `packages/framework-context/dist/index.js` | 98.2 KiB | 49.2 KiB | +48.9 KiB (+99.4%) | over-baseline | non-spine package remains advisory |
| `@croco/framework-context` | `packages/framework-context/dist/index.mjs` | 94.7 KiB | 46.8 KiB | +48.0 KiB (+102.6%) | over-baseline | non-spine package remains advisory |
| `@croco/framework-logger` | `packages/framework-logger/dist/index.d.ts` | 1.4 KiB | 1.4 KiB | +56 B (+4.0%) | over-baseline | non-spine package remains advisory |
| `@croco/framework-logger` | `packages/framework-logger/dist/index.js` | 7.3 KiB | 2.7 KiB | +4.6 KiB (+173.9%) | over-baseline | non-spine package remains advisory |
| `@croco/framework-logger` | `packages/framework-logger/dist/index.mjs` | 6.7 KiB | 2.1 KiB | +4.6 KiB (+214.3%) | over-baseline | non-spine package remains advisory |
| `@croco/framework-module` | `packages/framework-module/dist/index.d.ts` | 20.9 KiB | 7.0 KiB | +13.9 KiB (+198.3%) | over-baseline | non-spine package remains advisory |
| `@croco/framework-module` | `packages/framework-module/dist/index.js` | 116.5 KiB | 26.9 KiB | +89.6 KiB (+332.9%) | over-baseline | non-spine package remains advisory |
| `@croco/framework-module` | `packages/framework-module/dist/index.mjs` | 112.3 KiB | 25.1 KiB | +87.2 KiB (+348.1%) | over-baseline | non-spine package remains advisory |
| `@croco/framework-preset` | `packages/framework-preset/dist/index.d.ts` | 1.8 KiB | 930 B | +915 B (+98.4%) | over-baseline | non-spine package remains advisory |
| `@croco/framework-preset` | `packages/framework-preset/dist/index.js` | 2.9 KiB | 2.5 KiB | +356 B (+13.8%) | over-baseline | non-spine package remains advisory |
| `@croco/framework-preset` | `packages/framework-preset/dist/index.mjs` | 1.9 KiB | 1.6 KiB | +300 B (+18.2%) | over-baseline | non-spine package remains advisory |
| `@croco/framework-routes` | `packages/framework-routes/dist/compiler.d.ts` | 2.2 KiB | 1.9 KiB | +365 B (+18.8%) | over-baseline | non-spine package remains advisory |
| `@croco/framework-routes` | `packages/framework-routes/dist/compiler.js` | 317.6 KiB | 239.1 KiB | +78.5 KiB (+32.8%) | over-baseline | non-spine package remains advisory |
| `@croco/framework-routes` | `packages/framework-routes/dist/index.d.ts` | 11.7 KiB | 11.7 KiB | +64 B (+0.5%) | over-baseline | non-spine package remains advisory |
| `@croco/framework-routes` | `packages/framework-routes/dist/index.js` | 320.3 KiB | 241.4 KiB | +78.9 KiB (+32.7%) | over-baseline | non-spine package remains advisory |
| `@croco/framework-routes` | `packages/framework-routes/dist/metadata-reader.d.ts` | 1.2 KiB | 955 B | +275 B (+28.8%) | over-baseline | non-spine package remains advisory |
| `@croco/framework-routes` | `packages/framework-routes/dist/metadata-reader.mjs` | 350 B | 302 B | +48 B (+15.9%) | over-baseline | non-spine package remains advisory |
| `@croco/frontend-cloudflare` | `packages/frontend-cloudflare/dist/worker.cjs` | 3.3 KiB | 1.5 KiB | +1.8 KiB (+120.2%) | over-baseline | non-spine package remains advisory |
| `@croco/frontend-cloudflare` | `packages/frontend-cloudflare/dist/worker.d.ts` | 2.7 KiB | 1.3 KiB | +1.4 KiB (+106.6%) | over-baseline | non-spine package remains advisory |
| `@croco/frontend-cloudflare` | `packages/frontend-cloudflare/dist/worker.js` | 2.9 KiB | 1.0 KiB | +1.8 KiB (+173.7%) | over-baseline | non-spine package remains advisory |
| `@croco/frontend-problems` | `packages/frontend-problems/dist/index.d.ts` | 10.1 KiB | 9.4 KiB | +675 B (+7.0%) | over-baseline | non-spine package remains advisory |
| `@croco/frontend-problems` | `packages/frontend-problems/dist/index.js` | 13.1 KiB | 5.5 KiB | +7.6 KiB (+139.8%) | over-baseline | non-spine package remains advisory |
| `@croco/frontend-problems` | `packages/frontend-problems/dist/index.mjs` | 12.2 KiB | 4.6 KiB | +7.6 KiB (+163.8%) | over-baseline | non-spine package remains advisory |
| `@croco/frontend-react` | `packages/frontend-react/dist/chunk-*.mjs` | 7.1 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/frontend-react` | `packages/frontend-react/dist/experience-slot.d.ts` | 816 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/frontend-react` | `packages/frontend-react/dist/experience-slot.js` | 4.1 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/frontend-react` | `packages/frontend-react/dist/experience-slot.mjs` | 99 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/frontend-react` | `packages/frontend-react/dist/index.d.ts` | 33.1 KiB | 18.1 KiB | +14.9 KiB (+82.4%) | over-baseline | non-spine package remains advisory |
| `@croco/frontend-react` | `packages/frontend-react/dist/index.js` | 61.3 KiB | 15.9 KiB | +45.3 KiB (+284.3%) | over-baseline | non-spine package remains advisory |
| `@croco/frontend-react` | `packages/frontend-react/dist/index.mjs` | 48.0 KiB | 14.1 KiB | +33.9 KiB (+239.8%) | over-baseline | non-spine package remains advisory |
| `@croco/frontend-react` | `packages/frontend-react/dist/surveys.d.ts` | 729 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/frontend-react` | `packages/frontend-react/dist/surveys.js` | 4.7 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/frontend-react` | `packages/frontend-react/dist/surveys.mjs` | 119 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/frontend-vite` | `packages/frontend-vite/dist/index.js` | 2.1 KiB | 1.9 KiB | +254 B (+13.2%) | over-baseline | non-spine package remains advisory |
| `@croco/frontend-vite` | `packages/frontend-vite/dist/index.mjs` | 1.5 KiB | 1.2 KiB | +278 B (+22.9%) | over-baseline | non-spine package remains advisory |
| `@croco/gamification-core` | `packages/gamification-core/dist/chunk-*.js` | 5.9 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/gamification-core` | `packages/gamification-core/dist/chunk-*.mjs` | 4.7 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/gamification-core` | `packages/gamification-core/dist/index.d.ts` | 12.2 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/gamification-core` | `packages/gamification-core/dist/index.js` | 31.2 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/gamification-core` | `packages/gamification-core/dist/index.mjs` | 25.9 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/gamification-core` | `packages/gamification-core/dist/mission-validation-BLVRosLO.d.ts` | 1.7 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/gamification-core` | `packages/gamification-core/dist/mission-validation.d.ts` | 204 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/gamification-core` | `packages/gamification-core/dist/mission-validation.js` | 266 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/gamification-core` | `packages/gamification-core/dist/mission-validation.mjs` | 144 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/gamification-core` | `packages/gamification-core/dist/reward-contracts.d.ts` | 1.6 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/gamification-core` | `packages/gamification-core/dist/reward-contracts.js` | 5.4 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/gamification-core` | `packages/gamification-core/dist/reward-contracts.mjs` | 4.3 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/gamification-core` | `packages/gamification-core/dist/types-C_7-jxsq.d.ts` | 7.1 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/gamification-drizzle` | `packages/gamification-drizzle/dist/index.d.ts` | 95.8 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/gamification-drizzle` | `packages/gamification-drizzle/dist/index.js` | 35.7 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/gamification-drizzle` | `packages/gamification-drizzle/dist/index.mjs` | 32.6 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/gid-core` | `packages/gid-core/dist/index.d.ts` | 2.3 KiB | 2.0 KiB | +239 B (+11.5%) | over-baseline | non-spine package remains advisory |
| `@croco/gid-core` | `packages/gid-core/dist/index.js` | 3.0 KiB | 1.9 KiB | +1.1 KiB (+55.5%) | over-baseline | non-spine package remains advisory |
| `@croco/gid-core` | `packages/gid-core/dist/index.mjs` | 2.5 KiB | 1.4 KiB | +1.1 KiB (+78.6%) | over-baseline | non-spine package remains advisory |
| `@croco/governance-core` | `packages/governance-core/dist/index.d.ts` | 14.8 KiB | 14.0 KiB | +785 B (+5.5%) | over-baseline | non-spine package remains advisory |
| `@croco/governance-core` | `packages/governance-core/dist/index.js` | 26.4 KiB | 15.1 KiB | +11.4 KiB (+75.4%) | over-baseline | non-spine package remains advisory |
| `@croco/governance-core` | `packages/governance-core/dist/index.mjs` | 25.6 KiB | 14.2 KiB | +11.4 KiB (+79.8%) | over-baseline | non-spine package remains advisory |
| `@croco/health-core` | `packages/health-core/dist/index.d.ts` | 5.3 KiB | 1.5 KiB | +3.8 KiB (+250.6%) | over-baseline | non-spine package remains advisory |
| `@croco/health-core` | `packages/health-core/dist/index.js` | 5.9 KiB | 1.7 KiB | +4.2 KiB (+248.9%) | over-baseline | non-spine package remains advisory |
| `@croco/health-core` | `packages/health-core/dist/index.mjs` | 5.3 KiB | 1.2 KiB | +4.1 KiB (+341.2%) | over-baseline | non-spine package remains advisory |
| `@croco/idempotency-core` | `packages/idempotency-core/dist/index.d.ts` | 16.2 KiB | 13.1 KiB | +3.1 KiB (+23.3%) | over-baseline | non-spine package remains advisory |
| `@croco/idempotency-core` | `packages/idempotency-core/dist/index.js` | 29.1 KiB | 14.1 KiB | +15.0 KiB (+106.0%) | over-baseline | non-spine package remains advisory |
| `@croco/idempotency-core` | `packages/idempotency-core/dist/index.mjs` | 27.8 KiB | 13.2 KiB | +14.5 KiB (+109.6%) | over-baseline | non-spine package remains advisory |
| `@croco/impersonation-core` | `packages/impersonation-core/dist/index.d.ts` | 12.5 KiB | 4.3 KiB | +8.2 KiB (+192.2%) | over-baseline | non-spine package remains advisory |
| `@croco/impersonation-core` | `packages/impersonation-core/dist/index.js` | 19.5 KiB | 5.1 KiB | +14.3 KiB (+279.4%) | over-baseline | non-spine package remains advisory |
| `@croco/impersonation-core` | `packages/impersonation-core/dist/index.mjs` | 18.0 KiB | 4.3 KiB | +13.7 KiB (+320.6%) | over-baseline | non-spine package remains advisory |
| `@croco/integrations-posthog` | `packages/integrations-posthog/dist/index.d.ts` | 1.6 KiB | 600 B | +1.0 KiB (+177.7%) | over-baseline | non-spine package remains advisory |
| `@croco/integrations-posthog` | `packages/integrations-posthog/dist/index.js` | 3.3 KiB | 1.5 KiB | +1.7 KiB (+113.0%) | over-baseline | non-spine package remains advisory |
| `@croco/integrations-posthog` | `packages/integrations-posthog/dist/index.mjs` | 2.8 KiB | 1.1 KiB | +1.6 KiB (+144.1%) | over-baseline | non-spine package remains advisory |
| `@croco/invitation-core` | `packages/invitation-core/dist/index.d.ts` | 21.2 KiB | 12.5 KiB | +8.7 KiB (+69.2%) | over-baseline | non-spine package remains advisory |
| `@croco/invitation-core` | `packages/invitation-core/dist/index.js` | 34.6 KiB | 14.6 KiB | +20.0 KiB (+136.5%) | over-baseline | non-spine package remains advisory |
| `@croco/invitation-core` | `packages/invitation-core/dist/index.mjs` | 33.0 KiB | 13.5 KiB | +19.5 KiB (+145.1%) | over-baseline | non-spine package remains advisory |
| `@croco/invitation-drizzle` | `packages/invitation-drizzle/dist/index.d.ts` | 38.7 KiB | 14.6 KiB | +24.1 KiB (+165.5%) | over-baseline | non-spine package remains advisory |
| `@croco/invitation-drizzle` | `packages/invitation-drizzle/dist/index.js` | 26.6 KiB | 6.4 KiB | +20.2 KiB (+313.5%) | over-baseline | non-spine package remains advisory |
| `@croco/invitation-drizzle` | `packages/invitation-drizzle/dist/index.mjs` | 24.4 KiB | 5.6 KiB | +18.8 KiB (+338.0%) | over-baseline | non-spine package remains advisory |
| `@croco/lifecycle-core` | `packages/lifecycle-core/dist/index.d.ts` | 65.2 KiB | 11.6 KiB | +53.6 KiB (+461.7%) | over-baseline | non-spine package remains advisory |
| `@croco/lifecycle-core` | `packages/lifecycle-core/dist/index.js` | 94.8 KiB | 11.0 KiB | +83.8 KiB (+760.7%) | over-baseline | non-spine package remains advisory |
| `@croco/lifecycle-core` | `packages/lifecycle-core/dist/index.mjs` | 91.6 KiB | 10.1 KiB | +81.6 KiB (+810.8%) | over-baseline | non-spine package remains advisory |
| `@croco/lifecycle-drizzle` | `packages/lifecycle-drizzle/dist/index.d.ts` | 1018 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/lifecycle-drizzle` | `packages/lifecycle-drizzle/dist/index.js` | 4.1 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/lifecycle-drizzle` | `packages/lifecycle-drizzle/dist/index.mjs` | 3.6 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/membership-core` | `packages/membership-core/dist/index.d.ts` | 15.4 KiB | 8.3 KiB | +7.0 KiB (+84.4%) | over-baseline | non-spine package remains advisory |
| `@croco/membership-core` | `packages/membership-core/dist/index.js` | 20.5 KiB | 10.2 KiB | +10.2 KiB (+99.9%) | over-baseline | non-spine package remains advisory |
| `@croco/membership-core` | `packages/membership-core/dist/index.mjs` | 19.0 KiB | 9.2 KiB | +9.8 KiB (+107.0%) | over-baseline | non-spine package remains advisory |
| `@croco/membership-drizzle` | `packages/membership-drizzle/dist/index.d.ts` | 14.4 KiB | 5.7 KiB | +8.7 KiB (+153.0%) | over-baseline | non-spine package remains advisory |
| `@croco/membership-drizzle` | `packages/membership-drizzle/dist/index.js` | 18.6 KiB | 3.1 KiB | +15.5 KiB (+507.0%) | over-baseline | non-spine package remains advisory |
| `@croco/membership-drizzle` | `packages/membership-drizzle/dist/index.mjs` | 17.2 KiB | 2.5 KiB | +14.7 KiB (+587.1%) | over-baseline | non-spine package remains advisory |
| `@croco/meta-vite` | `packages/meta-vite/dist/chunk-*.mjs` | 6.0 KiB | 452 B | +5.5 KiB (+1253.3%) | over-baseline | non-spine package remains advisory |
| `@croco/meta-vite` | `packages/meta-vite/dist/flightBrowser.entry-BMCPtbk-.d.ts` | 6.1 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/meta-vite` | `packages/meta-vite/dist/index.d.ts` | 36.7 KiB | 24.6 KiB | +12.2 KiB (+49.7%) | over-baseline | non-spine package remains advisory |
| `@croco/meta-vite` | `packages/meta-vite/dist/index.js` | 75.7 KiB | 21.9 KiB | +53.8 KiB (+246.2%) | over-baseline | non-spine package remains advisory |
| `@croco/meta-vite` | `packages/meta-vite/dist/index.mjs` | 65.6 KiB | 19.6 KiB | +46.0 KiB (+234.6%) | over-baseline | non-spine package remains advisory |
| `@croco/meta-vite` | `packages/meta-vite/dist/libs/isr/adapters/index.js` | 2.1 KiB | 1.8 KiB | +308 B (+16.8%) | over-baseline | non-spine package remains advisory |
| `@croco/meta-vite` | `packages/meta-vite/dist/libs/isr/adapters/index.mjs` | 1.4 KiB | 1.3 KiB | +140 B (+10.5%) | over-baseline | non-spine package remains advisory |
| `@croco/meta-vite` | `packages/meta-vite/dist/libs/rsc/flightBrowser.entry.d.ts` | 312 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/meta-vite` | `packages/meta-vite/dist/libs/rsc/flightBrowser.entry.js` | 2.2 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/meta-vite` | `packages/meta-vite/dist/libs/rsc/flightBrowser.entry.mjs` | 275 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/meta-vite` | `packages/meta-vite/dist/libs/rsc/flightEncode.entry.d.ts` | 506 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/meta-vite` | `packages/meta-vite/dist/libs/rsc/flightEncode.entry.js` | 4.0 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/meta-vite` | `packages/meta-vite/dist/libs/rsc/flightEncode.entry.mjs` | 2.9 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/meta-vite` | `packages/meta-vite/dist/ssrCodec-*.mjs` | 589 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/meta-vite` | `packages/meta-vite/dist/types-BYiUO5XA.d.ts` | 916 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/meta-vite` | `packages/meta-vite/dist/types-CXHJ1Fx4.d.ts` | 9.3 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/metering-core` | `packages/metering-core/dist/index.d.ts` | 41.2 KiB | 18.5 KiB | +22.6 KiB (+121.9%) | over-baseline | non-spine package remains advisory |
| `@croco/metering-core` | `packages/metering-core/dist/index.js` | 66.1 KiB | 19.2 KiB | +46.9 KiB (+244.6%) | over-baseline | non-spine package remains advisory |
| `@croco/metering-core` | `packages/metering-core/dist/index.mjs` | 65.0 KiB | 18.4 KiB | +46.6 KiB (+252.8%) | over-baseline | non-spine package remains advisory |
| `@croco/metering-drizzle` | `packages/metering-drizzle/dist/index.d.ts` | 35.1 KiB | 22.4 KiB | +12.7 KiB (+56.7%) | over-baseline | non-spine package remains advisory |
| `@croco/metering-drizzle` | `packages/metering-drizzle/dist/index.js` | 16.7 KiB | 5.6 KiB | +11.1 KiB (+199.6%) | over-baseline | non-spine package remains advisory |
| `@croco/metering-drizzle` | `packages/metering-drizzle/dist/index.mjs` | 15.4 KiB | 4.8 KiB | +10.7 KiB (+224.3%) | over-baseline | non-spine package remains advisory |
| `@croco/metering-upstash` | `packages/metering-upstash/dist/index.d.ts` | 2.6 KiB | 2.1 KiB | +537 B (+25.5%) | over-baseline | non-spine package remains advisory |
| `@croco/metering-upstash` | `packages/metering-upstash/dist/index.js` | 5.2 KiB | 4.0 KiB | +1.3 KiB (+31.9%) | over-baseline | non-spine package remains advisory |
| `@croco/metering-upstash` | `packages/metering-upstash/dist/index.mjs` | 4.6 KiB | 3.4 KiB | +1.2 KiB (+35.7%) | over-baseline | non-spine package remains advisory |
| `@croco/metrics-billing` | `packages/metrics-billing/dist/index.d.ts` | 4.4 KiB | 2.4 KiB | +2.0 KiB (+81.6%) | over-baseline | non-spine package remains advisory |
| `@croco/metrics-billing` | `packages/metrics-billing/dist/index.js` | 10.4 KiB | 5.6 KiB | +4.8 KiB (+86.9%) | over-baseline | non-spine package remains advisory |
| `@croco/metrics-billing` | `packages/metrics-billing/dist/index.mjs` | 9.6 KiB | 5.0 KiB | +4.5 KiB (+90.7%) | over-baseline | non-spine package remains advisory |
| `@croco/metrics-core` | `packages/metrics-core/dist/BehaviorMetrics-CWiF6zJu.d.ts` | 17.7 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/metrics-core` | `packages/metrics-core/dist/chunk-*.mjs` | 37.3 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/metrics-core` | `packages/metrics-core/dist/index.d.ts` | 49.9 KiB | 29.7 KiB | +20.3 KiB (+68.4%) | over-baseline | non-spine package remains advisory |
| `@croco/metrics-core` | `packages/metrics-core/dist/index.js` | 97.4 KiB | 13.6 KiB | +83.8 KiB (+615.0%) | over-baseline | non-spine package remains advisory |
| `@croco/metrics-core` | `packages/metrics-core/dist/index.mjs` | 59.5 KiB | 12.7 KiB | +46.8 KiB (+367.6%) | over-baseline | non-spine package remains advisory |
| `@croco/metrics-core` | `packages/metrics-core/dist/runtime.d.ts` | 16.4 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/metrics-core` | `packages/metrics-core/dist/runtime.js` | 76.3 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/metrics-core` | `packages/metrics-core/dist/runtime.mjs` | 38.1 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/migration-runner` | `packages/migration-runner/dist/chunk-*.mjs` | 14.1 KiB | 6.2 KiB | +7.9 KiB (+126.7%) | over-baseline | non-spine package remains advisory |
| `@croco/migration-runner` | `packages/migration-runner/dist/cli.d.ts` | 1.4 KiB | 681 B | +739 B (+108.5%) | over-baseline | non-spine package remains advisory |
| `@croco/migration-runner` | `packages/migration-runner/dist/cli.js` | 21.3 KiB | 10.8 KiB | +10.5 KiB (+97.1%) | over-baseline | non-spine package remains advisory |
| `@croco/migration-runner` | `packages/migration-runner/dist/cli.mjs` | 7.2 KiB | 4.6 KiB | +2.7 KiB (+59.2%) | over-baseline | non-spine package remains advisory |
| `@croco/migration-runner` | `packages/migration-runner/dist/db-types-CxupYU_m.d.ts` | 193 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/migration-runner` | `packages/migration-runner/dist/index.d.ts` | 5.6 KiB | 3.8 KiB | +1.8 KiB (+47.9%) | over-baseline | non-spine package remains advisory |
| `@croco/migration-runner` | `packages/migration-runner/dist/index.js` | 14.7 KiB | 6.8 KiB | +8.0 KiB (+117.4%) | over-baseline | non-spine package remains advisory |
| `@croco/migration-runner` | `packages/migration-runner/dist/index.mjs` | 535 B | 415 B | +120 B (+28.9%) | over-baseline | non-spine package remains advisory |
| `@croco/notifications-core` | `packages/notifications-core/dist/index.d.ts` | 18.1 KiB | 14.4 KiB | +3.7 KiB (+25.6%) | over-baseline | non-spine package remains advisory |
| `@croco/notifications-core` | `packages/notifications-core/dist/index.js` | 25.7 KiB | 16.4 KiB | +9.3 KiB (+56.5%) | over-baseline | non-spine package remains advisory |
| `@croco/notifications-core` | `packages/notifications-core/dist/index.mjs` | 23.5 KiB | 14.6 KiB | +8.9 KiB (+60.8%) | over-baseline | non-spine package remains advisory |
| `@croco/notifications-fcm` | `packages/notifications-fcm/dist/index.d.ts` | 2.5 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/notifications-fcm` | `packages/notifications-fcm/dist/index.js` | 9.2 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/notifications-fcm` | `packages/notifications-fcm/dist/index.mjs` | 8.6 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/notifications-react-email` | `packages/notifications-react-email/dist/index.d.ts` | 810 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/notifications-react-email` | `packages/notifications-react-email/dist/index.js` | 1.6 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/notifications-react-email` | `packages/notifications-react-email/dist/index.mjs` | 1.1 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/notifications-resend` | `packages/notifications-resend/dist/index.d.ts` | 3.3 KiB | 3.2 KiB | +97 B (+3.0%) | over-baseline | non-spine package remains advisory |
| `@croco/notifications-resend` | `packages/notifications-resend/dist/index.js` | 16.6 KiB | 11.6 KiB | +5.0 KiB (+42.8%) | over-baseline | non-spine package remains advisory |
| `@croco/notifications-resend` | `packages/notifications-resend/dist/index.mjs` | 15.9 KiB | 10.9 KiB | +4.9 KiB (+45.3%) | over-baseline | non-spine package remains advisory |
| `@croco/onboarding-core` | `packages/onboarding-core/dist/chunk-*.mjs` | 4.3 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/onboarding-core` | `packages/onboarding-core/dist/goal-validation-Do-OrHxp.d.ts` | 5.0 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/onboarding-core` | `packages/onboarding-core/dist/goal-validation.d.ts` | 164 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/onboarding-core` | `packages/onboarding-core/dist/goal-validation.js` | 3.1 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/onboarding-core` | `packages/onboarding-core/dist/goal-validation.mjs` | 119 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/onboarding-core` | `packages/onboarding-core/dist/index.d.ts` | 11.0 KiB | 3.7 KiB | +7.2 KiB (+193.4%) | over-baseline | non-spine package remains advisory |
| `@croco/onboarding-core` | `packages/onboarding-core/dist/index.js` | 26.5 KiB | 3.6 KiB | +22.9 KiB (+637.2%) | over-baseline | non-spine package remains advisory |
| `@croco/onboarding-core` | `packages/onboarding-core/dist/index.mjs` | 20.9 KiB | 3.0 KiB | +17.9 KiB (+586.8%) | over-baseline | non-spine package remains advisory |
| `@croco/onboarding-drizzle` | `packages/onboarding-drizzle/dist/index.d.ts` | 44.2 KiB | 6.6 KiB | +37.6 KiB (+570.6%) | over-baseline | non-spine package remains advisory |
| `@croco/onboarding-drizzle` | `packages/onboarding-drizzle/dist/index.js` | 28.3 KiB | 2.3 KiB | +26.0 KiB (+1153.7%) | over-baseline | non-spine package remains advisory |
| `@croco/onboarding-drizzle` | `packages/onboarding-drizzle/dist/index.mjs` | 26.3 KiB | 1.8 KiB | +24.6 KiB (+1395.0%) | over-baseline | non-spine package remains advisory |
| `@croco/openapi-spec` | `packages/openapi-spec/dist/chunk-*.mjs` | 11.6 KiB | 8.4 KiB | +3.2 KiB (+37.8%) | over-baseline | non-spine package remains advisory |
| `@croco/openapi-spec` | `packages/openapi-spec/dist/cli.js` | 19.3 KiB | 18.0 KiB | +1.3 KiB (+7.1%) | over-baseline | non-spine package remains advisory |
| `@croco/openapi-spec` | `packages/openapi-spec/dist/cli.mjs` | 6.7 KiB | 4.5 KiB | +2.3 KiB (+51.0%) | over-baseline | non-spine package remains advisory |
| `@croco/openapi-spec` | `packages/openapi-spec/dist/index.d.ts` | 1.9 KiB | 1.6 KiB | +267 B (+15.8%) | over-baseline | non-spine package remains advisory |
| `@croco/openapi-spec` | `packages/openapi-spec/dist/index.js` | 11.8 KiB | 8.7 KiB | +3.1 KiB (+35.7%) | over-baseline | non-spine package remains advisory |
| `@croco/openapi-spec` | `packages/openapi-spec/dist/index.mjs` | 221 B | 148 B | +73 B (+49.3%) | over-baseline | non-spine package remains advisory |
| `@croco/openapi-spec` | `packages/openapi-spec/dist/output-*.mjs` | 576 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/outbox-core` | `packages/outbox-core/dist/index.d.ts` | 10.2 KiB | 9.5 KiB | +782 B (+8.1%) | over-baseline | non-spine package remains advisory |
| `@croco/outbox-core` | `packages/outbox-core/dist/index.js` | 28.1 KiB | 22.8 KiB | +5.3 KiB (+23.3%) | over-baseline | non-spine package remains advisory |
| `@croco/outbox-core` | `packages/outbox-core/dist/index.mjs` | 27.1 KiB | 21.9 KiB | +5.2 KiB (+23.6%) | over-baseline | non-spine package remains advisory |
| `@croco/pagination-core` | `packages/pagination-core/dist/index.d.ts` | 7.5 KiB | 5.0 KiB | +2.5 KiB (+49.9%) | over-baseline | non-spine package remains advisory |
| `@croco/pagination-core` | `packages/pagination-core/dist/index.js` | 9.3 KiB | 4.0 KiB | +5.3 KiB (+132.8%) | over-baseline | non-spine package remains advisory |
| `@croco/pagination-core` | `packages/pagination-core/dist/index.mjs` | 8.3 KiB | 3.3 KiB | +5.1 KiB (+155.2%) | over-baseline | non-spine package remains advisory |
| `@croco/presentation-preset` | `packages/presentation-preset/dist/index.d.ts` | 10.4 KiB | 8.9 KiB | +1.5 KiB (+16.5%) | over-baseline | non-spine package remains advisory |
| `@croco/presentation-preset` | `packages/presentation-preset/dist/index.js` | 33.1 KiB | 17.9 KiB | +15.2 KiB (+84.8%) | over-baseline | non-spine package remains advisory |
| `@croco/presentation-preset` | `packages/presentation-preset/dist/index.mjs` | 31.0 KiB | 16.0 KiB | +15.0 KiB (+94.2%) | over-baseline | non-spine package remains advisory |
| `@croco/presentation-preset` | `packages/presentation-preset/dist/runtime-profiles.json` | 6.5 KiB | 5.1 KiB | +1.4 KiB (+27.0%) | over-baseline | non-spine package remains advisory |
| `@croco/preset-cloudflare` | `packages/preset-cloudflare/dist/chunk-*.mjs` | 1.4 KiB | 538 B | +921 B (+171.2%) | over-baseline | non-spine package remains advisory |
| `@croco/preset-cloudflare` | `packages/preset-cloudflare/dist/fetch.d.ts` | 4.2 KiB | 2.0 KiB | +2.2 KiB (+114.1%) | over-baseline | non-spine package remains advisory |
| `@croco/preset-cloudflare` | `packages/preset-cloudflare/dist/fetch.mjs` | 164 B | 114 B | +50 B (+43.9%) | over-baseline | non-spine package remains advisory |
| `@croco/preset-cloudflare` | `packages/preset-cloudflare/dist/index.d.ts` | 1.0 KiB | 524 B | +537 B (+102.5%) | over-baseline | non-spine package remains advisory |
| `@croco/preset-cloudflare` | `packages/preset-cloudflare/dist/index.mjs` | 646 B | 494 B | +152 B (+30.8%) | over-baseline | non-spine package remains advisory |
| `@croco/preset-lambda` | `packages/preset-lambda/dist/chunk-*.mjs` | 1.6 KiB | 1.3 KiB | +302 B (+23.2%) | over-baseline | non-spine package remains advisory |
| `@croco/preset-lambda` | `packages/preset-lambda/dist/handler.d.ts` | 822 B | 350 B | +472 B (+134.9%) | over-baseline | non-spine package remains advisory |
| `@croco/preset-lambda` | `packages/preset-lambda/dist/handler.js` | 1.8 KiB | 1.5 KiB | +334 B (+21.9%) | over-baseline | non-spine package remains advisory |
| `@croco/preset-lambda` | `packages/preset-lambda/dist/handler.mjs` | 136 B | 96 B | +40 B (+41.7%) | over-baseline | non-spine package remains advisory |
| `@croco/preset-lambda` | `packages/preset-lambda/dist/index.d.ts` | 655 B | 381 B | +274 B (+71.9%) | over-baseline | non-spine package remains advisory |
| `@croco/preset-lambda` | `packages/preset-lambda/dist/index.js` | 4.1 KiB | 3.4 KiB | +720 B (+20.8%) | over-baseline | non-spine package remains advisory |
| `@croco/preset-lambda` | `packages/preset-lambda/dist/index.mjs` | 1.6 KiB | 1.2 KiB | +378 B (+30.3%) | over-baseline | non-spine package remains advisory |
| `@croco/preset-node` | `packages/preset-node/dist/chunk-*.mjs` | 10.7 KiB | 2.2 KiB | +8.4 KiB (+379.3%) | over-baseline | non-spine package remains advisory |
| `@croco/preset-node` | `packages/preset-node/dist/entry.d.ts` | 791 B | 485 B | +306 B (+63.1%) | over-baseline | non-spine package remains advisory |
| `@croco/preset-node` | `packages/preset-node/dist/entry.js` | 11.6 KiB | 2.4 KiB | +9.3 KiB (+387.1%) | over-baseline | non-spine package remains advisory |
| `@croco/preset-node` | `packages/preset-node/dist/entry.mjs` | 124 B | 88 B | +36 B (+40.9%) | over-baseline | non-spine package remains advisory |
| `@croco/preset-node` | `packages/preset-node/dist/index.d.ts` | 1.2 KiB | 332 B | +926 B (+278.9%) | over-baseline | non-spine package remains advisory |
| `@croco/preset-node` | `packages/preset-node/dist/index.js` | 13.4 KiB | 4.3 KiB | +9.1 KiB (+212.9%) | over-baseline | non-spine package remains advisory |
| `@croco/preset-node` | `packages/preset-node/dist/index.mjs` | 1.8 KiB | 1.2 KiB | +546 B (+43.8%) | over-baseline | non-spine package remains advisory |
| `@croco/problems-core` | `packages/problems-core/dist/index.d.ts` | 1.59 MiB | 564.2 KiB | +1.04 MiB (+188.1%) | over-baseline | non-spine package remains advisory |
| `@croco/problems-core` | `packages/problems-core/dist/index.js` | 876.3 KiB | 336.6 KiB | +539.7 KiB (+160.3%) | over-baseline | non-spine package remains advisory |
| `@croco/problems-core` | `packages/problems-core/dist/index.mjs` | 875.3 KiB | 335.9 KiB | +539.3 KiB (+160.6%) | over-baseline | non-spine package remains advisory |
| `@croco/promotions-core` | `packages/promotions-core/dist/credit-grant-CLnwmJP8.d.ts` | 11.3 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/promotions-core` | `packages/promotions-core/dist/credit-grant.d.ts` | 143 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/promotions-core` | `packages/promotions-core/dist/credit-grant.js` | 3.4 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/promotions-core` | `packages/promotions-core/dist/credit-grant.mjs` | 2.9 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/promotions-core` | `packages/promotions-core/dist/index.d.ts` | 18.1 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/promotions-core` | `packages/promotions-core/dist/index.js` | 31.1 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/promotions-core` | `packages/promotions-core/dist/index.mjs` | 29.6 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/promotions-drizzle` | `packages/promotions-drizzle/dist/index.d.ts` | 1.6 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/promotions-drizzle` | `packages/promotions-drizzle/dist/index.js` | 12.3 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/promotions-drizzle` | `packages/promotions-drizzle/dist/index.mjs` | 11.6 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/protocol-codegen` | `packages/protocol-codegen/dist/index.d.ts` | 3.5 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/protocol-codegen` | `packages/protocol-codegen/dist/index.js` | 21.0 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/protocol-codegen` | `packages/protocol-codegen/dist/index.mjs` | 20.0 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/protocols-core` | `packages/protocols-core/dist/index.d.ts` | 40.8 KiB | 30.3 KiB | +10.5 KiB (+34.6%) | over-baseline | non-spine package remains advisory |
| `@croco/protocols-core` | `packages/protocols-core/dist/index.js` | 103.6 KiB | 57.5 KiB | +46.1 KiB (+80.1%) | over-baseline | non-spine package remains advisory |
| `@croco/protocols-core` | `packages/protocols-core/dist/index.mjs` | 101.4 KiB | 55.8 KiB | +45.6 KiB (+81.8%) | over-baseline | non-spine package remains advisory |
| `@croco/protocols-graphql` | `packages/protocols-graphql/dist/index.cjs` | 20.7 KiB | 16.0 KiB | +4.7 KiB (+29.3%) | over-baseline | non-spine package remains advisory |
| `@croco/protocols-graphql` | `packages/protocols-graphql/dist/index.d.ts` | 12.4 KiB | 11.4 KiB | +1.0 KiB (+9.1%) | over-baseline | non-spine package remains advisory |
| `@croco/protocols-graphql` | `packages/protocols-graphql/dist/index.js` | 19.3 KiB | 14.7 KiB | +4.5 KiB (+30.8%) | over-baseline | non-spine package remains advisory |
| `@croco/protocols-rest` | `packages/protocols-rest/dist/index.d.ts` | 35.2 KiB | 29.4 KiB | +5.8 KiB (+19.7%) | over-baseline | non-spine package remains advisory |
| `@croco/protocols-rest` | `packages/protocols-rest/dist/index.js` | 22.2 KiB | 15.6 KiB | +6.6 KiB (+42.3%) | over-baseline | non-spine package remains advisory |
| `@croco/protocols-rest` | `packages/protocols-rest/dist/index.mjs` | 20.4 KiB | 14.0 KiB | +6.4 KiB (+45.6%) | over-baseline | non-spine package remains advisory |
| `@croco/protocols-trpc` | `packages/protocols-trpc/dist/index.cjs` | 18.5 KiB | 1.6 KiB | +16.9 KiB (+1039.4%) | over-baseline | non-spine package remains advisory |
| `@croco/protocols-trpc` | `packages/protocols-trpc/dist/index.d.ts` | 2.2 KiB | 584 B | +1.7 KiB (+292.1%) | over-baseline | non-spine package remains advisory |
| `@croco/protocols-trpc` | `packages/protocols-trpc/dist/index.js` | 17.8 KiB | 1.1 KiB | +16.7 KiB (+1464.8%) | over-baseline | non-spine package remains advisory |
| `@croco/ratelimit-core` | `packages/ratelimit-core/dist/index.d.ts` | 16.2 KiB | 13.9 KiB | +2.3 KiB (+16.5%) | over-baseline | non-spine package remains advisory |
| `@croco/ratelimit-core` | `packages/ratelimit-core/dist/index.js` | 24.4 KiB | 17.5 KiB | +6.9 KiB (+39.1%) | over-baseline | non-spine package remains advisory |
| `@croco/ratelimit-core` | `packages/ratelimit-core/dist/index.mjs` | 23.2 KiB | 16.5 KiB | +6.7 KiB (+40.3%) | over-baseline | non-spine package remains advisory |
| `@croco/ratelimit-upstash` | `packages/ratelimit-upstash/dist/index.d.ts` | 4.5 KiB | 4.3 KiB | +205 B (+4.7%) | over-baseline | non-spine package remains advisory |
| `@croco/ratelimit-upstash` | `packages/ratelimit-upstash/dist/index.js` | 17.6 KiB | 15.7 KiB | +1.9 KiB (+11.8%) | over-baseline | non-spine package remains advisory |
| `@croco/ratelimit-upstash` | `packages/ratelimit-upstash/dist/index.mjs` | 16.9 KiB | 15.0 KiB | +1.9 KiB (+12.4%) | over-baseline | non-spine package remains advisory |
| `@croco/referral-core` | `packages/referral-core/dist/credit-grant.d.ts` | 3.9 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/referral-core` | `packages/referral-core/dist/credit-grant.js` | 5.3 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/referral-core` | `packages/referral-core/dist/credit-grant.mjs` | 4.8 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/referral-core` | `packages/referral-core/dist/index.d.ts` | 25.3 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/referral-core` | `packages/referral-core/dist/index.js` | 41.1 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/referral-core` | `packages/referral-core/dist/index.mjs` | 39.4 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/referral-core` | `packages/referral-core/dist/link-token.d.ts` | 319 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/referral-core` | `packages/referral-core/dist/link-token.js` | 833 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/referral-core` | `packages/referral-core/dist/link-token.mjs` | 344 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/referral-core` | `packages/referral-core/dist/types-2VX6NpQ3.d.ts` | 11.6 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/referral-drizzle` | `packages/referral-drizzle/dist/index.d.ts` | 2.0 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/referral-drizzle` | `packages/referral-drizzle/dist/index.js` | 22.2 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/referral-drizzle` | `packages/referral-drizzle/dist/index.mjs` | 21.2 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/repository-core` | `packages/repository-core/dist/index.d.ts` | 11.0 KiB | 6.1 KiB | +4.9 KiB (+79.9%) | over-baseline | non-spine package remains advisory |
| `@croco/repository-core` | `packages/repository-core/dist/index.js` | 5.7 KiB | 2.1 KiB | +3.7 KiB (+179.6%) | over-baseline | non-spine package remains advisory |
| `@croco/repository-core` | `packages/repository-core/dist/index.mjs` | 4.9 KiB | 1.5 KiB | +3.4 KiB (+233.8%) | over-baseline | non-spine package remains advisory |
| `@croco/research-core` | `packages/research-core/dist/index.d.ts` | 16.7 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/research-core` | `packages/research-core/dist/index.js` | 32.1 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/research-core` | `packages/research-core/dist/index.mjs` | 31.1 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/research-drizzle` | `packages/research-drizzle/dist/index.d.ts` | 3.2 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/research-drizzle` | `packages/research-drizzle/dist/index.js` | 6.9 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/research-drizzle` | `packages/research-drizzle/dist/index.mjs` | 6.1 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/retry-core` | `packages/retry-core/dist/index.d.ts` | 35.8 KiB | 31.2 KiB | +4.7 KiB (+15.0%) | over-baseline | non-spine package remains advisory |
| `@croco/retry-core` | `packages/retry-core/dist/index.js` | 40.6 KiB | 29.2 KiB | +11.4 KiB (+39.0%) | over-baseline | non-spine package remains advisory |
| `@croco/retry-core` | `packages/retry-core/dist/index.mjs` | 39.2 KiB | 28.0 KiB | +11.2 KiB (+40.1%) | over-baseline | non-spine package remains advisory |
| `@croco/rpc-codegen` | `packages/rpc-codegen/dist/chunk-*.js` | 99.7 KiB | 68.8 KiB | +31.0 KiB (+45.0%) | over-baseline | non-spine package remains advisory |
| `@croco/rpc-codegen` | `packages/rpc-codegen/dist/cli.cjs` | 108.7 KiB | 74.9 KiB | +33.7 KiB (+45.0%) | over-baseline | non-spine package remains advisory |
| `@croco/rpc-codegen` | `packages/rpc-codegen/dist/cli.js` | 7.7 KiB | 5.2 KiB | +2.4 KiB (+46.7%) | over-baseline | non-spine package remains advisory |
| `@croco/rpc-codegen` | `packages/rpc-codegen/dist/generate-*.js` | 314 B | 240 B | +74 B (+30.8%) | over-baseline | non-spine package remains advisory |
| `@croco/rpc-codegen` | `packages/rpc-codegen/dist/index.cjs` | 100.1 KiB | 69.7 KiB | +30.3 KiB (+43.5%) | over-baseline | non-spine package remains advisory |
| `@croco/rpc-codegen` | `packages/rpc-codegen/dist/index.d.ts` | 1.7 KiB | 1.5 KiB | +253 B (+16.6%) | over-baseline | non-spine package remains advisory |
| `@croco/search-core` | `packages/search-core/dist/chunk-*.js` | 2.4 KiB | 1.9 KiB | +556 B (+29.0%) | over-baseline | non-spine package remains advisory |
| `@croco/search-core` | `packages/search-core/dist/index.d.ts` | 15.6 KiB | 7.4 KiB | +8.2 KiB (+111.8%) | over-baseline | non-spine package remains advisory |
| `@croco/search-core` | `packages/search-core/dist/index.js` | 26.8 KiB | 10.7 KiB | +16.1 KiB (+151.2%) | over-baseline | non-spine package remains advisory |
| `@croco/search-core` | `packages/search-core/dist/ko/index.js` | 4.1 KiB | 3.6 KiB | +477 B (+13.0%) | over-baseline | non-spine package remains advisory |
| `@croco/search-core` | `packages/search-core/dist/textTransforms-CoCREejn.d.ts` | 4.1 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/search-drizzle` | `packages/search-drizzle/dist/index.d.ts` | 10.2 KiB | 7.1 KiB | +3.1 KiB (+43.7%) | over-baseline | non-spine package remains advisory |
| `@croco/search-drizzle` | `packages/search-drizzle/dist/index.js` | 30.4 KiB | 12.2 KiB | +18.3 KiB (+150.3%) | over-baseline | non-spine package remains advisory |
| `@croco/search-meilisearch` | `packages/search-meilisearch/dist/index.cjs` | 21.2 KiB | 15.4 KiB | +5.8 KiB (+37.9%) | over-baseline | non-spine package remains advisory |
| `@croco/search-meilisearch` | `packages/search-meilisearch/dist/index.d.ts` | 6.4 KiB | 5.3 KiB | +1.1 KiB (+20.5%) | over-baseline | non-spine package remains advisory |
| `@croco/search-meilisearch` | `packages/search-meilisearch/dist/index.js` | 20.3 KiB | 14.6 KiB | +5.6 KiB (+38.6%) | over-baseline | non-spine package remains advisory |
| `@croco/storage-cloudflare` | `packages/storage-cloudflare/dist/index.d.ts` | 8.9 KiB | 8.1 KiB | +829 B (+10.0%) | over-baseline | non-spine package remains advisory |
| `@croco/storage-cloudflare` | `packages/storage-cloudflare/dist/index.js` | 24.5 KiB | 14.7 KiB | +9.9 KiB (+67.5%) | over-baseline | non-spine package remains advisory |
| `@croco/storage-cloudflare` | `packages/storage-cloudflare/dist/index.mjs` | 23.7 KiB | 13.8 KiB | +9.9 KiB (+71.4%) | over-baseline | non-spine package remains advisory |
| `@croco/storage-cloudinary` | `packages/storage-cloudinary/dist/index.d.ts` | 6.6 KiB | 5.7 KiB | +938 B (+16.0%) | over-baseline | non-spine package remains advisory |
| `@croco/storage-cloudinary` | `packages/storage-cloudinary/dist/index.js` | 23.4 KiB | 13.6 KiB | +9.8 KiB (+71.7%) | over-baseline | non-spine package remains advisory |
| `@croco/storage-cloudinary` | `packages/storage-cloudinary/dist/index.mjs` | 22.5 KiB | 12.8 KiB | +9.7 KiB (+75.2%) | over-baseline | non-spine package remains advisory |
| `@croco/storage-core` | `packages/storage-core/dist/StorageProblem-NVc-7q_q.d.ts` | 6.5 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/storage-core` | `packages/storage-core/dist/chunk-*.mjs` | 1.4 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/storage-core` | `packages/storage-core/dist/index.js` | 8.9 KiB | 4.3 KiB | +4.5 KiB (+104.3%) | over-baseline | non-spine package remains advisory |
| `@croco/storage-core` | `packages/storage-core/dist/index.mjs` | 7.3 KiB | 3.8 KiB | +3.6 KiB (+95.1%) | over-baseline | non-spine package remains advisory |
| `@croco/storage-core` | `packages/storage-core/dist/node.d.ts` | 764 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/storage-core` | `packages/storage-core/dist/node.js` | 2.6 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/storage-core` | `packages/storage-core/dist/node.mjs` | 1.1 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/storage-r2` | `packages/storage-r2/dist/index.d.ts` | 4.6 KiB | 4.3 KiB | +313 B (+7.2%) | over-baseline | non-spine package remains advisory |
| `@croco/storage-r2` | `packages/storage-r2/dist/index.js` | 14.1 KiB | 11.1 KiB | +3.0 KiB (+27.0%) | over-baseline | non-spine package remains advisory |
| `@croco/storage-r2` | `packages/storage-r2/dist/index.mjs` | 13.4 KiB | 10.5 KiB | +2.9 KiB (+28.1%) | over-baseline | non-spine package remains advisory |
| `@croco/tasks-core` | `packages/tasks-core/dist/index.d.ts` | 10.2 KiB | 3.4 KiB | +6.7 KiB (+196.7%) | over-baseline | non-spine package remains advisory |
| `@croco/tasks-core` | `packages/tasks-core/dist/index.js` | 14.6 KiB | 4.7 KiB | +9.9 KiB (+212.8%) | over-baseline | non-spine package remains advisory |
| `@croco/tasks-core` | `packages/tasks-core/dist/index.mjs` | 13.7 KiB | 4.1 KiB | +9.6 KiB (+235.0%) | over-baseline | non-spine package remains advisory |
| `@croco/tasks-qstash` | `packages/tasks-qstash/dist/index.d.ts` | 2.2 KiB | 2.1 KiB | +174 B (+8.2%) | over-baseline | non-spine package remains advisory |
| `@croco/tasks-qstash` | `packages/tasks-qstash/dist/index.js` | 6.5 KiB | 4.4 KiB | +2.1 KiB (+48.4%) | over-baseline | non-spine package remains advisory |
| `@croco/tasks-qstash` | `packages/tasks-qstash/dist/index.mjs` | 5.9 KiB | 3.8 KiB | +2.1 KiB (+54.0%) | over-baseline | non-spine package remains advisory |
| `@croco/telemetry-api` | `packages/telemetry-api/dist/index.d.ts` | 5.4 KiB | 4.3 KiB | +1.1 KiB (+26.4%) | over-baseline | non-spine package remains advisory |
| `@croco/telemetry-api` | `packages/telemetry-api/dist/index.js` | 9.5 KiB | 4.7 KiB | +4.8 KiB (+101.2%) | over-baseline | non-spine package remains advisory |
| `@croco/telemetry-api` | `packages/telemetry-api/dist/index.mjs` | 8.9 KiB | 4.2 KiB | +4.7 KiB (+113.4%) | over-baseline | non-spine package remains advisory |
| `@croco/telemetry-sdk-node` | `packages/telemetry-sdk-node/dist/chunk-*.mjs` | 5.4 KiB | 1.8 KiB | +3.6 KiB (+201.5%) | over-baseline | non-spine package remains advisory |
| `@croco/telemetry-sdk-node` | `packages/telemetry-sdk-node/dist/index.js` | 31.9 KiB | 8.1 KiB | +23.8 KiB (+292.3%) | over-baseline | non-spine package remains advisory |
| `@croco/telemetry-sdk-node` | `packages/telemetry-sdk-node/dist/index.mjs` | 25.2 KiB | 5.5 KiB | +19.7 KiB (+359.9%) | over-baseline | non-spine package remains advisory |
| `@croco/tenant-core` | `packages/tenant-core/dist/chunk-*.mjs` | 12.7 KiB | 10.9 KiB | +1.8 KiB (+16.7%) | over-baseline | non-spine package remains advisory |
| `@croco/tenant-core` | `packages/tenant-core/dist/index.d.ts` | 22.0 KiB | 21.4 KiB | +622 B (+2.8%) | over-baseline | non-spine package remains advisory |
| `@croco/tenant-core` | `packages/tenant-core/dist/index.js` | 28.8 KiB | 24.5 KiB | +4.3 KiB (+17.5%) | over-baseline | non-spine package remains advisory |
| `@croco/tenant-core` | `packages/tenant-core/dist/index.mjs` | 14.8 KiB | 12.5 KiB | +2.3 KiB (+18.8%) | over-baseline | non-spine package remains advisory |
| `@croco/tenant-core` | `packages/tenant-core/dist/tenant-model.d.ts` | 13.6 KiB | 12.0 KiB | +1.6 KiB (+13.7%) | over-baseline | non-spine package remains advisory |
| `@croco/tenant-core` | `packages/tenant-core/dist/tenant-model.js` | 13.7 KiB | 11.7 KiB | +2.0 KiB (+17.1%) | over-baseline | non-spine package remains advisory |
| `@croco/tenant-core` | `packages/tenant-core/dist/tenant-model.mjs` | 659 B | 496 B | +163 B (+32.9%) | over-baseline | non-spine package remains advisory |
| `@croco/testing` | `packages/testing/dist/chunk-*.mjs` | 59.3 KiB | 2.6 KiB | +56.7 KiB (+2177.6%) | over-baseline | non-spine package remains advisory |
| `@croco/testing` | `packages/testing/dist/drizzle.js` | 2.6 KiB | 2.4 KiB | +199 B (+8.0%) | over-baseline | non-spine package remains advisory |
| `@croco/testing` | `packages/testing/dist/drizzle.mjs` | 155 B | 121 B | +34 B (+28.1%) | over-baseline | non-spine package remains advisory |
| `@croco/testing` | `packages/testing/dist/executable-assurance-Bv9pWeNr.d.ts` | 16.1 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/testing` | `packages/testing/dist/executable-assurance.d.ts` | 1.4 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/testing` | `packages/testing/dist/executable-assurance.js` | 48.5 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/testing` | `packages/testing/dist/executable-assurance.mjs` | 851 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/testing` | `packages/testing/dist/index.d.ts` | 55.7 KiB | 35.1 KiB | +20.6 KiB (+58.7%) | over-baseline | non-spine package remains advisory |
| `@croco/testing` | `packages/testing/dist/index.js` | 195.9 KiB | 57.3 KiB | +138.5 KiB (+241.6%) | over-baseline | non-spine package remains advisory |
| `@croco/testing` | `packages/testing/dist/index.mjs` | 132.2 KiB | 52.9 KiB | +79.3 KiB (+150.1%) | over-baseline | non-spine package remains advisory |
| `@croco/testing` | `packages/testing/dist/notifications.d.ts` | 1.7 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/testing` | `packages/testing/dist/notifications.js` | 1.7 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/testing` | `packages/testing/dist/notifications.mjs` | 1.1 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/testing` | `packages/testing/dist/playwright-*.js` | 17.7 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/testing` | `packages/testing/dist/playwright-*.mjs` | 121 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/testing` | `packages/testing/dist/playwright-reporter.d.ts` | 359 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/testing` | `packages/testing/dist/schemas/test-evidence-bundle-v1.schema.json` | 1.4 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/testing` | `packages/testing/dist/schemas/test-evidence-v1.schema.json` | 4.8 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/testing` | `packages/testing/dist/test-evidence-BmmXRVJ-.d.ts` | 28.1 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/testing` | `packages/testing/dist/vitest-*.js` | 16.6 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/testing` | `packages/testing/dist/vitest-*.mjs` | 121 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/testing` | `packages/testing/dist/vitest-reporter-DOsrWH9a.d.ts` | 4.0 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/testing` | `packages/testing/dist/vitest-reporter.d.ts` | 359 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/testing-resources` | `packages/testing-resources/dist/index.d.ts` | 3.8 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/testing-resources` | `packages/testing-resources/dist/index.js` | 11.4 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/testing-resources` | `packages/testing-resources/dist/index.mjs` | 10.6 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/transports-cloudflare-workers` | `packages/transports-cloudflare-workers/dist/index.js` | 1.1 KiB | 1002 B | +167 B (+16.7%) | over-baseline | non-spine package remains advisory |
| `@croco/transports-cloudflare-workers` | `packages/transports-cloudflare-workers/dist/index.mjs` | 704 B | 509 B | +195 B (+38.3%) | over-baseline | non-spine package remains advisory |
| `@croco/transports-graphql` | `packages/transports-graphql/dist/chunk-*.js` | 6.1 KiB | 1.9 KiB | +4.2 KiB (+216.8%) | over-baseline | non-spine package remains advisory |
| `@croco/transports-graphql` | `packages/transports-graphql/dist/index.cjs` | 17.2 KiB | 5.6 KiB | +11.6 KiB (+207.1%) | over-baseline | non-spine package remains advisory |
| `@croco/transports-graphql` | `packages/transports-graphql/dist/index.d.ts` | 3.9 KiB | 2.7 KiB | +1.3 KiB (+47.9%) | over-baseline | non-spine package remains advisory |
| `@croco/transports-graphql` | `packages/transports-graphql/dist/index.js` | 10.0 KiB | 2.9 KiB | +7.0 KiB (+238.5%) | over-baseline | non-spine package remains advisory |
| `@croco/transports-http` | `packages/transports-http/dist/GracefulShutdownMiddleware-*.mjs` | 329 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/transports-http` | `packages/transports-http/dist/chunk-*.mjs` | 8.7 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/transports-http` | `packages/transports-http/dist/index.d.ts` | 32.0 KiB | 23.0 KiB | +9.0 KiB (+39.3%) | over-baseline | non-spine package remains advisory |
| `@croco/transports-http` | `packages/transports-http/dist/index.js` | 104.7 KiB | 55.8 KiB | +49.0 KiB (+87.9%) | over-baseline | non-spine package remains advisory |
| `@croco/transports-http` | `packages/transports-http/dist/index.mjs` | 93.2 KiB | 54.2 KiB | +39.0 KiB (+71.9%) | over-baseline | non-spine package remains advisory |
| `@croco/triggers-core` | `packages/triggers-core/dist/index.d.ts` | 10.4 KiB | 5.6 KiB | +4.8 KiB (+86.3%) | over-baseline | non-spine package remains advisory |
| `@croco/triggers-core` | `packages/triggers-core/dist/index.js` | 4.7 KiB | 3.4 KiB | +1.3 KiB (+37.7%) | over-baseline | non-spine package remains advisory |
| `@croco/triggers-core` | `packages/triggers-core/dist/index.mjs` | 4.0 KiB | 2.7 KiB | +1.3 KiB (+47.8%) | over-baseline | non-spine package remains advisory |
| `@croco/triggers-qstash` | `packages/triggers-qstash/dist/index.d.ts` | 14.8 KiB | 9.8 KiB | +5.1 KiB (+51.8%) | over-baseline | non-spine package remains advisory |
| `@croco/triggers-qstash` | `packages/triggers-qstash/dist/index.js` | 21.4 KiB | 9.8 KiB | +11.5 KiB (+117.0%) | over-baseline | non-spine package remains advisory |
| `@croco/triggers-qstash` | `packages/triggers-qstash/dist/index.mjs` | 20.6 KiB | 9.3 KiB | +11.2 KiB (+120.6%) | over-baseline | non-spine package remains advisory |
| `@croco/tx-core` | `packages/tx-core/dist/index.d.ts` | 10.4 KiB | 5.6 KiB | +4.9 KiB (+87.3%) | over-baseline | non-spine package remains advisory |
| `@croco/tx-core` | `packages/tx-core/dist/index.js` | 15.6 KiB | 6.8 KiB | +8.8 KiB (+128.9%) | over-baseline | non-spine package remains advisory |
| `@croco/tx-core` | `packages/tx-core/dist/index.mjs` | 14.3 KiB | 5.9 KiB | +8.4 KiB (+141.6%) | over-baseline | non-spine package remains advisory |
| `@croco/tx-drizzle` | `packages/tx-drizzle/dist/index.d.ts` | 8.5 KiB | 4.1 KiB | +4.4 KiB (+107.5%) | over-baseline | non-spine package remains advisory |
| `@croco/tx-drizzle` | `packages/tx-drizzle/dist/index.js` | 18.1 KiB | 4.7 KiB | +13.4 KiB (+287.5%) | over-baseline | non-spine package remains advisory |
| `@croco/tx-drizzle` | `packages/tx-drizzle/dist/index.mjs` | 17.1 KiB | 4.0 KiB | +13.1 KiB (+329.4%) | over-baseline | non-spine package remains advisory |
| `@croco/ui-astryx` | `packages/ui-astryx/dist/index.d.ts` | 3.6 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/ui-astryx` | `packages/ui-astryx/dist/index.js` | 4.8 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/ui-astryx` | `packages/ui-astryx/dist/index.mjs` | 4.2 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/ui-astryx` | `packages/ui-astryx/dist/styles.css` | 130 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/warehouse-core` | `packages/warehouse-core/dist/chunk-*.mjs` | 8.7 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/warehouse-core` | `packages/warehouse-core/dist/index.d.ts` | 4.1 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/warehouse-core` | `packages/warehouse-core/dist/index.js` | 11.6 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/warehouse-core` | `packages/warehouse-core/dist/index.mjs` | 2.5 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/warehouse-core` | `packages/warehouse-core/dist/runtime.d.ts` | 8.8 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/warehouse-core` | `packages/warehouse-core/dist/runtime.js` | 12.2 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/warehouse-core` | `packages/warehouse-core/dist/runtime.mjs` | 3.6 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/warehouse-core` | `packages/warehouse-core/dist/types-Dp6Twlnj.d.ts` | 3.8 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/warehouse-postgres` | `packages/warehouse-postgres/dist/chunk-*.mjs` | 21.2 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/warehouse-postgres` | `packages/warehouse-postgres/dist/facts.d.ts` | 6.2 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/warehouse-postgres` | `packages/warehouse-postgres/dist/facts.js` | 46.4 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/warehouse-postgres` | `packages/warehouse-postgres/dist/facts.mjs` | 22.8 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/warehouse-postgres` | `packages/warehouse-postgres/dist/index.d.ts` | 13 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/warehouse-postgres` | `packages/warehouse-postgres/dist/index.js` | 397 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/warehouse-postgres` | `packages/warehouse-postgres/dist/index.mjs` | 0 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/warehouse-postgres` | `packages/warehouse-postgres/dist/metrics.d.ts` | 2.9 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/warehouse-postgres` | `packages/warehouse-postgres/dist/metrics.js` | 10.9 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/warehouse-postgres` | `packages/warehouse-postgres/dist/metrics.mjs` | 10.2 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/warehouse-postgres` | `packages/warehouse-postgres/dist/pipeline.d.ts` | 860 B | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/warehouse-postgres` | `packages/warehouse-postgres/dist/pipeline.js` | 20.6 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/warehouse-postgres` | `packages/warehouse-postgres/dist/pipeline.mjs` | 3.1 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/warehouse-tooling` | `packages/warehouse-tooling/dist/index.d.ts` | 4.5 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/warehouse-tooling` | `packages/warehouse-tooling/dist/index.js` | 249.7 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `@croco/webhooks-core` | `packages/webhooks-core/dist/index.d.ts` | 31.1 KiB | 12.2 KiB | +18.9 KiB (+155.1%) | over-baseline | non-spine package remains advisory |
| `@croco/webhooks-core` | `packages/webhooks-core/dist/index.js` | 61.0 KiB | 16.1 KiB | +44.9 KiB (+278.3%) | over-baseline | non-spine package remains advisory |
| `@croco/webhooks-core` | `packages/webhooks-core/dist/index.mjs` | 59.0 KiB | 15.0 KiB | +44.0 KiB (+293.6%) | over-baseline | non-spine package remains advisory |
| `@croco/workflow-core` | `packages/workflow-core/dist/index.d.ts` | 21.6 KiB | 15.4 KiB | +6.2 KiB (+40.5%) | over-baseline | non-spine package remains advisory |
| `@croco/workflow-core` | `packages/workflow-core/dist/index.js` | 36.4 KiB | 22.0 KiB | +14.4 KiB (+65.3%) | over-baseline | non-spine package remains advisory |
| `@croco/workflow-core` | `packages/workflow-core/dist/index.mjs` | 35.0 KiB | 21.0 KiB | +14.0 KiB (+66.6%) | over-baseline | non-spine package remains advisory |
| `create-croco-app` | `packages/create-croco-app/dist/bin.d.ts` | 13 B | missing | - | missing-baseline | non-spine package remains advisory |
| `create-croco-app` | `packages/create-croco-app/dist/bin.js` | 306 B | missing | - | missing-baseline | non-spine package remains advisory |
| `create-croco-app` | `packages/create-croco-app/dist/chunk-*.js` | 189.7 KiB | 39.7 KiB | +150.0 KiB (+377.9%) | over-baseline | non-spine package remains advisory |
| `create-croco-app` | `packages/create-croco-app/dist/generator-C40LYnb1.d.ts` | 7.4 KiB | missing | - | missing-baseline | non-spine package remains advisory |
| `create-croco-app` | `packages/create-croco-app/dist/generator.d.ts` | 291 B | missing | - | missing-baseline | non-spine package remains advisory |
| `create-croco-app` | `packages/create-croco-app/dist/generator.js` | 123 B | missing | - | missing-baseline | non-spine package remains advisory |
| `create-croco-app` | `packages/create-croco-app/dist/index.d.ts` | 326 B | 13 B | +313 B (+2407.7%) | over-baseline | non-spine package remains advisory |
| `create-croco-app` | `packages/create-croco-app/dist/options-BfvYfI62.d.ts` | 902 B | missing | - | missing-baseline | non-spine package remains advisory |
| `create-croco-app` | `packages/create-croco-app/dist/programmatic.d.ts` | 459 B | missing | - | missing-baseline | non-spine package remains advisory |
| `create-croco-app` | `packages/create-croco-app/dist/programmatic.js` | 355 B | missing | - | missing-baseline | non-spine package remains advisory |
| `create-croco-app` | `packages/create-croco-app/dist/prompts-*.js` | 13.4 KiB | 11.1 KiB | +2.2 KiB (+20.0%) | over-baseline | non-spine package remains advisory |
| `create-croco-app` | `packages/create-croco-app/dist/verification.d.ts` | 635 B | missing | - | missing-baseline | non-spine package remains advisory |
| `create-croco-app` | `packages/create-croco-app/dist/verification.js` | 663 B | missing | - | missing-baseline | non-spine package remains advisory |

## Artifact responsibility
| Package | Artifact | Size | Baseline | Baseline key | Delta | Status | Recovery |
| --- | --- | ---: | ---: | --- | ---: | --- | --- |
| `@croco/access-core` | `packages/access-core/dist/index.d.ts` | 7.3 KiB | 6.8 KiB | `@croco/access-core:packages/access-core/dist/index.d.ts` | +439 B (+6.3%) | over-baseline | `pnpm --filter @croco/access-core build && pnpm package-quality:report` |
| `@croco/access-core` | `packages/access-core/dist/index.js` | 12.2 KiB | 9.3 KiB | `@croco/access-core:packages/access-core/dist/index.js` | +2.9 KiB (+31.5%) | over-baseline | `pnpm --filter @croco/access-core build && pnpm package-quality:report` |
| `@croco/access-core` | `packages/access-core/dist/index.mjs` | 11.3 KiB | 8.5 KiB | `@croco/access-core:packages/access-core/dist/index.mjs` | +2.8 KiB (+33.6%) | over-baseline | `pnpm --filter @croco/access-core build && pnpm package-quality:report` |
| `@croco/access-drizzle` | `packages/access-drizzle/dist/index.d.ts` | 4.9 KiB | 4.8 KiB | `@croco/access-drizzle:packages/access-drizzle/dist/index.d.ts` | +70 B (+1.4%) | over-baseline | `pnpm --filter @croco/access-drizzle build && pnpm package-quality:report` |
| `@croco/access-drizzle` | `packages/access-drizzle/dist/index.js` | 4.2 KiB | 3.4 KiB | `@croco/access-drizzle:packages/access-drizzle/dist/index.js` | +765 B (+21.7%) | over-baseline | `pnpm --filter @croco/access-drizzle build && pnpm package-quality:report` |
| `@croco/access-drizzle` | `packages/access-drizzle/dist/index.mjs` | 3.6 KiB | 2.9 KiB | `@croco/access-drizzle:packages/access-drizzle/dist/index.mjs` | +793 B (+27.0%) | over-baseline | `pnpm --filter @croco/access-drizzle build && pnpm package-quality:report` |
| `@croco/admin-core` | `packages/admin-core/dist/chunk-*.mjs` | 1.4 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/admin-core build && pnpm package-quality:report` |
| `@croco/admin-core` | `packages/admin-core/dist/fact-history-operations.d.ts` | 330 B | missing | - | - | missing-baseline | `pnpm --filter @croco/admin-core build && pnpm package-quality:report` |
| `@croco/admin-core` | `packages/admin-core/dist/fact-history-operations.js` | 3.3 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/admin-core build && pnpm package-quality:report` |
| `@croco/admin-core` | `packages/admin-core/dist/fact-history-operations.mjs` | 2.4 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/admin-core build && pnpm package-quality:report` |
| `@croco/admin-core` | `packages/admin-core/dist/fact-history-validation-DJCEn0uT.d.ts` | 3.3 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/admin-core build && pnpm package-quality:report` |
| `@croco/admin-core` | `packages/admin-core/dist/fact-history-validation.d.ts` | 221 B | missing | - | - | missing-baseline | `pnpm --filter @croco/admin-core build && pnpm package-quality:report` |
| `@croco/admin-core` | `packages/admin-core/dist/fact-history-validation.js` | 1.6 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/admin-core build && pnpm package-quality:report` |
| `@croco/admin-core` | `packages/admin-core/dist/fact-history-validation.mjs` | 1.0 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/admin-core build && pnpm package-quality:report` |
| `@croco/admin-core` | `packages/admin-core/dist/index.d.ts` | 147.1 KiB | 8.0 KiB | `@croco/admin-core:packages/admin-core/dist/index.d.ts` | +139.1 KiB (+1734.1%) | over-baseline | `pnpm --filter @croco/admin-core build && pnpm package-quality:report` |
| `@croco/admin-core` | `packages/admin-core/dist/index.js` | 160.9 KiB | 8.9 KiB | `@croco/admin-core:packages/admin-core/dist/index.js` | +152.0 KiB (+1698.8%) | over-baseline | `pnpm --filter @croco/admin-core build && pnpm package-quality:report` |
| `@croco/admin-core` | `packages/admin-core/dist/index.mjs` | 154.2 KiB | 8.4 KiB | `@croco/admin-core:packages/admin-core/dist/index.mjs` | +145.8 KiB (+1727.1%) | over-baseline | `pnpm --filter @croco/admin-core build && pnpm package-quality:report` |
| `@croco/admin-core` | `packages/admin-core/dist/survey-operations.d.ts` | 743 B | missing | - | - | missing-baseline | `pnpm --filter @croco/admin-core build && pnpm package-quality:report` |
| `@croco/admin-core` | `packages/admin-core/dist/survey-operations.js` | 1.3 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/admin-core build && pnpm package-quality:report` |
| `@croco/admin-core` | `packages/admin-core/dist/survey-operations.mjs` | 151 B | missing | - | - | missing-baseline | `pnpm --filter @croco/admin-core build && pnpm package-quality:report` |
| `@croco/admin-core` | `packages/admin-core/dist/targeting-impact-operations.d.ts` | 3.0 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/admin-core build && pnpm package-quality:report` |
| `@croco/admin-core` | `packages/admin-core/dist/targeting-impact-operations.js` | 7.1 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/admin-core build && pnpm package-quality:report` |
| `@croco/admin-core` | `packages/admin-core/dist/targeting-impact-operations.mjs` | 5.8 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/admin-core build && pnpm package-quality:report` |
| `@croco/admin-generated` | `packages/admin-generated/dist/index.d.ts` | 5.4 KiB | 4.7 KiB | `@croco/admin-generated:packages/admin-generated/dist/index.d.ts` | +647 B (+13.4%) | over-baseline | `pnpm --filter @croco/admin-generated build && pnpm package-quality:report` |
| `@croco/admin-generated` | `packages/admin-generated/dist/index.js` | 19.7 KiB | 15.4 KiB | `@croco/admin-generated:packages/admin-generated/dist/index.js` | +4.3 KiB (+28.3%) | over-baseline | `pnpm --filter @croco/admin-generated build && pnpm package-quality:report` |
| `@croco/admin-generated` | `packages/admin-generated/dist/index.mjs` | 18.9 KiB | 14.6 KiB | `@croco/admin-generated:packages/admin-generated/dist/index.mjs` | +4.3 KiB (+29.7%) | over-baseline | `pnpm --filter @croco/admin-generated build && pnpm package-quality:report` |
| `@croco/admin-ops` | `packages/admin-ops/dist/index.d.ts` | 23.5 KiB | 18.4 KiB | `@croco/admin-ops:packages/admin-ops/dist/index.d.ts` | +5.1 KiB (+27.6%) | over-baseline | `pnpm --filter @croco/admin-ops build && pnpm package-quality:report` |
| `@croco/admin-ops` | `packages/admin-ops/dist/index.js` | 37.8 KiB | 21.3 KiB | `@croco/admin-ops:packages/admin-ops/dist/index.js` | +16.5 KiB (+77.4%) | over-baseline | `pnpm --filter @croco/admin-ops build && pnpm package-quality:report` |
| `@croco/admin-ops` | `packages/admin-ops/dist/index.mjs` | 35.6 KiB | 19.8 KiB | `@croco/admin-ops:packages/admin-ops/dist/index.mjs` | +15.8 KiB (+80.0%) | over-baseline | `pnpm --filter @croco/admin-ops build && pnpm package-quality:report` |
| `@croco/admin-postgres` | `packages/admin-postgres/dist/index.d.ts` | 3.2 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/admin-postgres build && pnpm package-quality:report` |
| `@croco/admin-postgres` | `packages/admin-postgres/dist/index.js` | 12.7 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/admin-postgres build && pnpm package-quality:report` |
| `@croco/admin-postgres` | `packages/admin-postgres/dist/index.mjs` | 11.7 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/admin-postgres build && pnpm package-quality:report` |
| `@croco/admin-react` | `packages/admin-react/dist/chunk-*.mjs` | 21.5 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/admin-react build && pnpm package-quality:report` |
| `@croco/admin-react` | `packages/admin-react/dist/experience-console.d.ts` | 943 B | missing | - | - | missing-baseline | `pnpm --filter @croco/admin-react build && pnpm package-quality:report` |
| `@croco/admin-react` | `packages/admin-react/dist/experience-console.js` | 9.1 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/admin-react build && pnpm package-quality:report` |
| `@croco/admin-react` | `packages/admin-react/dist/experience-console.mjs` | 102 B | missing | - | - | missing-baseline | `pnpm --filter @croco/admin-react build && pnpm package-quality:report` |
| `@croco/admin-react` | `packages/admin-react/dist/experiment-console.d.ts` | 1.1 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/admin-react build && pnpm package-quality:report` |
| `@croco/admin-react` | `packages/admin-react/dist/experiment-console.js` | 9.5 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/admin-react build && pnpm package-quality:report` |
| `@croco/admin-react` | `packages/admin-react/dist/experiment-console.mjs` | 102 B | missing | - | - | missing-baseline | `pnpm --filter @croco/admin-react build && pnpm package-quality:report` |
| `@croco/admin-react` | `packages/admin-react/dist/index.d.ts` | 93.1 KiB | 40.2 KiB | `@croco/admin-react:packages/admin-react/dist/index.d.ts` | +52.9 KiB (+131.6%) | over-baseline | `pnpm --filter @croco/admin-react build && pnpm package-quality:report` |
| `@croco/admin-react` | `packages/admin-react/dist/index.js` | 339.0 KiB | 40.1 KiB | `@croco/admin-react:packages/admin-react/dist/index.js` | +299.0 KiB (+746.2%) | over-baseline | `pnpm --filter @croco/admin-react build && pnpm package-quality:report` |
| `@croco/admin-react` | `packages/admin-react/dist/index.mjs` | 283.4 KiB | 35.7 KiB | `@croco/admin-react:packages/admin-react/dist/index.mjs` | +247.7 KiB (+693.6%) | over-baseline | `pnpm --filter @croco/admin-react build && pnpm package-quality:report` |
| `@croco/admin-react` | `packages/admin-react/dist/surveys.d.ts` | 1.6 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/admin-react build && pnpm package-quality:report` |
| `@croco/admin-react` | `packages/admin-react/dist/surveys.js` | 6.5 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/admin-react build && pnpm package-quality:report` |
| `@croco/admin-react` | `packages/admin-react/dist/surveys.mjs` | 149 B | missing | - | - | missing-baseline | `pnpm --filter @croco/admin-react build && pnpm package-quality:report` |
| `@croco/ai-usage` | `packages/ai-usage/dist/index.cjs` | 15.2 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/ai-usage build && pnpm package-quality:report` |
| `@croco/ai-usage` | `packages/ai-usage/dist/index.d.ts` | 12.0 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/ai-usage build && pnpm package-quality:report` |
| `@croco/ai-usage` | `packages/ai-usage/dist/index.js` | 14.3 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/ai-usage build && pnpm package-quality:report` |
| `@croco/analytics-core` | `packages/analytics-core/dist/GrowthAnalysis-5KrkVSJo.d.ts` | 3.4 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/analytics-core build && pnpm package-quality:report` |
| `@croco/analytics-core` | `packages/analytics-core/dist/chunk-*.mjs` | 7.7 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/analytics-core build && pnpm package-quality:report` |
| `@croco/analytics-core` | `packages/analytics-core/dist/index.d.ts` | 13.7 KiB | 937 B | `@croco/analytics-core:packages/analytics-core/dist/index.d.ts` | +12.8 KiB (+1401.2%) | over-baseline | `pnpm --filter @croco/analytics-core build && pnpm package-quality:report` |
| `@croco/analytics-core` | `packages/analytics-core/dist/index.js` | 19.6 KiB | 649 B | `@croco/analytics-core:packages/analytics-core/dist/index.js` | +19.0 KiB (+2990.9%) | over-baseline | `pnpm --filter @croco/analytics-core build && pnpm package-quality:report` |
| `@croco/analytics-core` | `packages/analytics-core/dist/index.mjs` | 11.2 KiB | 161 B | `@croco/analytics-core:packages/analytics-core/dist/index.mjs` | +11.1 KiB (+7032.3%) | over-baseline | `pnpm --filter @croco/analytics-core build && pnpm package-quality:report` |
| `@croco/analytics-core` | `packages/analytics-core/dist/runtime.d.ts` | 5.4 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/analytics-core build && pnpm package-quality:report` |
| `@croco/analytics-core` | `packages/analytics-core/dist/runtime.js` | 11.5 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/analytics-core build && pnpm package-quality:report` |
| `@croco/analytics-core` | `packages/analytics-core/dist/runtime.mjs` | 9.2 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/analytics-core build && pnpm package-quality:report` |
| `@croco/analytics-drizzle` | `packages/analytics-drizzle/dist/index.d.ts` | 1.4 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/analytics-drizzle build && pnpm package-quality:report` |
| `@croco/analytics-drizzle` | `packages/analytics-drizzle/dist/index.js` | 10.5 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/analytics-drizzle build && pnpm package-quality:report` |
| `@croco/analytics-drizzle` | `packages/analytics-drizzle/dist/index.mjs` | 9.5 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/analytics-drizzle build && pnpm package-quality:report` |
| `@croco/analytics-posthog` | `packages/analytics-posthog/dist/index.d.ts` | 3.9 KiB | 3.2 KiB | `@croco/analytics-posthog:packages/analytics-posthog/dist/index.d.ts` | +704 B (+21.7%) | over-baseline | `pnpm --filter @croco/analytics-posthog build && pnpm package-quality:report` |
| `@croco/analytics-posthog` | `packages/analytics-posthog/dist/index.js` | 11.2 KiB | 7.8 KiB | `@croco/analytics-posthog:packages/analytics-posthog/dist/index.js` | +3.4 KiB (+44.4%) | over-baseline | `pnpm --filter @croco/analytics-posthog build && pnpm package-quality:report` |
| `@croco/analytics-posthog` | `packages/analytics-posthog/dist/index.mjs` | 10.4 KiB | 7.2 KiB | `@croco/analytics-posthog:packages/analytics-posthog/dist/index.mjs` | +3.3 KiB (+45.8%) | over-baseline | `pnpm --filter @croco/analytics-posthog build && pnpm package-quality:report` |
| `@croco/architecture-policy` | `packages/architecture-policy/dist/index.d.ts` | 5.2 KiB | 5.2 KiB | `@croco/architecture-policy:packages/architecture-policy/dist/index.d.ts` | +0 B (+0.0%) | within-baseline | `pnpm --filter @croco/architecture-policy build && pnpm package-quality:report` |
| `@croco/architecture-policy` | `packages/architecture-policy/dist/index.js` | 31.1 KiB | 27.0 KiB | `@croco/architecture-policy:packages/architecture-policy/dist/index.js` | +4.1 KiB (+15.3%) | over-baseline | `pnpm --filter @croco/architecture-policy build && pnpm package-quality:report` |
| `@croco/audit-core` | `packages/audit-core/dist/index.d.ts` | 5.4 KiB | 4.2 KiB | `@croco/audit-core:packages/audit-core/dist/index.d.ts` | +1.3 KiB (+30.5%) | over-baseline | `pnpm --filter @croco/audit-core build && pnpm package-quality:report` |
| `@croco/audit-core` | `packages/audit-core/dist/index.js` | 17.4 KiB | 7.1 KiB | `@croco/audit-core:packages/audit-core/dist/index.js` | +10.3 KiB (+145.6%) | over-baseline | `pnpm --filter @croco/audit-core build && pnpm package-quality:report` |
| `@croco/audit-core` | `packages/audit-core/dist/index.mjs` | 16.8 KiB | 6.5 KiB | `@croco/audit-core:packages/audit-core/dist/index.mjs` | +10.3 KiB (+157.2%) | over-baseline | `pnpm --filter @croco/audit-core build && pnpm package-quality:report` |
| `@croco/audit-drizzle` | `packages/audit-drizzle/dist/index.d.ts` | 16.8 KiB | 16.7 KiB | `@croco/audit-drizzle:packages/audit-drizzle/dist/index.d.ts` | +53 B (+0.3%) | over-baseline | `pnpm --filter @croco/audit-drizzle build && pnpm package-quality:report` |
| `@croco/audit-drizzle` | `packages/audit-drizzle/dist/index.js` | 5.5 KiB | 4.8 KiB | `@croco/audit-drizzle:packages/audit-drizzle/dist/index.js` | +748 B (+15.3%) | over-baseline | `pnpm --filter @croco/audit-drizzle build && pnpm package-quality:report` |
| `@croco/audit-drizzle` | `packages/audit-drizzle/dist/index.mjs` | 4.8 KiB | 4.0 KiB | `@croco/audit-drizzle:packages/audit-drizzle/dist/index.mjs` | +790 B (+19.2%) | over-baseline | `pnpm --filter @croco/audit-drizzle build && pnpm package-quality:report` |
| `@croco/auth-better-auth` | `packages/auth-better-auth/dist/index.d.ts` | 74.9 KiB | 28.3 KiB | `@croco/auth-better-auth:packages/auth-better-auth/dist/index.d.ts` | +46.6 KiB (+164.3%) | over-baseline | `pnpm --filter @croco/auth-better-auth build && pnpm package-quality:report` |
| `@croco/auth-better-auth` | `packages/auth-better-auth/dist/index.js` | 24.4 KiB | 14.7 KiB | `@croco/auth-better-auth:packages/auth-better-auth/dist/index.js` | +9.7 KiB (+66.2%) | over-baseline | `pnpm --filter @croco/auth-better-auth build && pnpm package-quality:report` |
| `@croco/auth-better-auth` | `packages/auth-better-auth/dist/index.mjs` | 22.9 KiB | 13.4 KiB | `@croco/auth-better-auth:packages/auth-better-auth/dist/index.mjs` | +9.5 KiB (+70.8%) | over-baseline | `pnpm --filter @croco/auth-better-auth build && pnpm package-quality:report` |
| `@croco/auth-clerk` | `packages/auth-clerk/dist/index.d.ts` | 17.1 KiB | 13.2 KiB | `@croco/auth-clerk:packages/auth-clerk/dist/index.d.ts` | +3.8 KiB (+29.1%) | over-baseline | `pnpm --filter @croco/auth-clerk build && pnpm package-quality:report` |
| `@croco/auth-clerk` | `packages/auth-clerk/dist/index.js` | 29.7 KiB | 19.8 KiB | `@croco/auth-clerk:packages/auth-clerk/dist/index.js` | +10.0 KiB (+50.4%) | over-baseline | `pnpm --filter @croco/auth-clerk build && pnpm package-quality:report` |
| `@croco/auth-clerk` | `packages/auth-clerk/dist/index.mjs` | 28.3 KiB | 18.6 KiB | `@croco/auth-clerk:packages/auth-clerk/dist/index.mjs` | +9.7 KiB (+52.1%) | over-baseline | `pnpm --filter @croco/auth-clerk build && pnpm package-quality:report` |
| `@croco/auth-core` | `packages/auth-core/dist/index.d.ts` | 14.3 KiB | 10.3 KiB | `@croco/auth-core:packages/auth-core/dist/index.d.ts` | +4.0 KiB (+38.7%) | over-baseline | `pnpm --filter @croco/auth-core build && pnpm package-quality:report` |
| `@croco/auth-core` | `packages/auth-core/dist/index.js` | 22.5 KiB | 13.2 KiB | `@croco/auth-core:packages/auth-core/dist/index.js` | +9.3 KiB (+70.0%) | over-baseline | `pnpm --filter @croco/auth-core build && pnpm package-quality:report` |
| `@croco/auth-core` | `packages/auth-core/dist/index.mjs` | 20.8 KiB | 12.0 KiB | `@croco/auth-core:packages/auth-core/dist/index.mjs` | +8.8 KiB (+74.0%) | over-baseline | `pnpm --filter @croco/auth-core build && pnpm package-quality:report` |
| `@croco/auth-drizzle` | `packages/auth-drizzle/dist/index.d.ts` | 38.0 KiB | 28.3 KiB | `@croco/auth-drizzle:packages/auth-drizzle/dist/index.d.ts` | +9.7 KiB (+34.4%) | over-baseline | `pnpm --filter @croco/auth-drizzle build && pnpm package-quality:report` |
| `@croco/auth-drizzle` | `packages/auth-drizzle/dist/index.js` | 18.3 KiB | 8.6 KiB | `@croco/auth-drizzle:packages/auth-drizzle/dist/index.js` | +9.7 KiB (+113.4%) | over-baseline | `pnpm --filter @croco/auth-drizzle build && pnpm package-quality:report` |
| `@croco/auth-drizzle` | `packages/auth-drizzle/dist/index.mjs` | 16.4 KiB | 7.4 KiB | `@croco/auth-drizzle:packages/auth-drizzle/dist/index.mjs` | +9.0 KiB (+121.9%) | over-baseline | `pnpm --filter @croco/auth-drizzle build && pnpm package-quality:report` |
| `@croco/batch-core` | `packages/batch-core/dist/index.d.ts` | 4.8 KiB | 3.3 KiB | `@croco/batch-core:packages/batch-core/dist/index.d.ts` | +1.5 KiB (+44.7%) | over-baseline | `pnpm --filter @croco/batch-core build && pnpm package-quality:report` |
| `@croco/batch-core` | `packages/batch-core/dist/index.js` | 6.9 KiB | 3.9 KiB | `@croco/batch-core:packages/batch-core/dist/index.js` | +3.0 KiB (+76.6%) | over-baseline | `pnpm --filter @croco/batch-core build && pnpm package-quality:report` |
| `@croco/batch-core` | `packages/batch-core/dist/index.mjs` | 6.2 KiB | 3.4 KiB | `@croco/batch-core:packages/batch-core/dist/index.mjs` | +2.8 KiB (+82.2%) | over-baseline | `pnpm --filter @croco/batch-core build && pnpm package-quality:report` |
| `@croco/batch-qstash` | `packages/batch-qstash/dist/index.d.ts` | 3.0 KiB | 1.7 KiB | `@croco/batch-qstash:packages/batch-qstash/dist/index.d.ts` | +1.3 KiB (+77.0%) | over-baseline | `pnpm --filter @croco/batch-qstash build && pnpm package-quality:report` |
| `@croco/batch-qstash` | `packages/batch-qstash/dist/index.js` | 10.6 KiB | 5.9 KiB | `@croco/batch-qstash:packages/batch-qstash/dist/index.js` | +4.7 KiB (+78.9%) | over-baseline | `pnpm --filter @croco/batch-qstash build && pnpm package-quality:report` |
| `@croco/batch-qstash` | `packages/batch-qstash/dist/index.mjs` | 10.0 KiB | 5.3 KiB | `@croco/batch-qstash:packages/batch-qstash/dist/index.mjs` | +4.7 KiB (+87.9%) | over-baseline | `pnpm --filter @croco/batch-qstash build && pnpm package-quality:report` |
| `@croco/billing-core` | `packages/billing-core/dist/cancellation.d.ts` | 7.2 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/billing-core build && pnpm package-quality:report` |
| `@croco/billing-core` | `packages/billing-core/dist/cancellation.js` | 4.1 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/billing-core build && pnpm package-quality:report` |
| `@croco/billing-core` | `packages/billing-core/dist/cancellation.mjs` | 328 B | missing | - | - | missing-baseline | `pnpm --filter @croco/billing-core build && pnpm package-quality:report` |
| `@croco/billing-core` | `packages/billing-core/dist/chunk-*.mjs` | 3.6 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/billing-core build && pnpm package-quality:report` |
| `@croco/billing-core` | `packages/billing-core/dist/index.d.ts` | 71.8 KiB | 14.4 KiB | `@croco/billing-core:packages/billing-core/dist/index.d.ts` | +57.5 KiB (+400.4%) | over-baseline | `pnpm --filter @croco/billing-core build && pnpm package-quality:report` |
| `@croco/billing-core` | `packages/billing-core/dist/index.js` | 91.4 KiB | 13.0 KiB | `@croco/billing-core:packages/billing-core/dist/index.js` | +78.4 KiB (+601.1%) | over-baseline | `pnpm --filter @croco/billing-core build && pnpm package-quality:report` |
| `@croco/billing-core` | `packages/billing-core/dist/index.mjs` | 84.1 KiB | 12.1 KiB | `@croco/billing-core:packages/billing-core/dist/index.mjs` | +72.0 KiB (+594.7%) | over-baseline | `pnpm --filter @croco/billing-core build && pnpm package-quality:report` |
| `@croco/billing-drizzle` | `packages/billing-drizzle/dist/index.d.ts` | 3.9 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/billing-drizzle build && pnpm package-quality:report` |
| `@croco/billing-drizzle` | `packages/billing-drizzle/dist/index.js` | 14.6 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/billing-drizzle build && pnpm package-quality:report` |
| `@croco/billing-drizzle` | `packages/billing-drizzle/dist/index.mjs` | 13.8 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/billing-drizzle build && pnpm package-quality:report` |
| `@croco/billing-polar` | `packages/billing-polar/dist/index.d.ts` | 14.0 KiB | 6.0 KiB | `@croco/billing-polar:packages/billing-polar/dist/index.d.ts` | +7.9 KiB (+132.1%) | over-baseline | `pnpm --filter @croco/billing-polar build && pnpm package-quality:report` |
| `@croco/billing-polar` | `packages/billing-polar/dist/index.js` | 40.1 KiB | 15.9 KiB | `@croco/billing-polar:packages/billing-polar/dist/index.js` | +24.2 KiB (+152.1%) | over-baseline | `pnpm --filter @croco/billing-polar build && pnpm package-quality:report` |
| `@croco/billing-polar` | `packages/billing-polar/dist/index.mjs` | 38.6 KiB | 15.1 KiB | `@croco/billing-polar:packages/billing-polar/dist/index.mjs` | +23.6 KiB (+156.4%) | over-baseline | `pnpm --filter @croco/billing-polar build && pnpm package-quality:report` |
| `@croco/cache-core` | `packages/cache-core/dist/index.d.ts` | 22.1 KiB | 13.2 KiB | `@croco/cache-core:packages/cache-core/dist/index.d.ts` | +8.9 KiB (+67.3%) | over-baseline | `pnpm --filter @croco/cache-core build && pnpm package-quality:report` |
| `@croco/cache-core` | `packages/cache-core/dist/index.js` | 28.5 KiB | 14.3 KiB | `@croco/cache-core:packages/cache-core/dist/index.js` | +14.2 KiB (+98.8%) | over-baseline | `pnpm --filter @croco/cache-core build && pnpm package-quality:report` |
| `@croco/cache-core` | `packages/cache-core/dist/index.mjs` | 26.7 KiB | 13.0 KiB | `@croco/cache-core:packages/cache-core/dist/index.mjs` | +13.8 KiB (+106.1%) | over-baseline | `pnpm --filter @croco/cache-core build && pnpm package-quality:report` |
| `@croco/cli` | `packages/cli/dist/agent.d.ts` | 1008 B | missing | - | - | missing-baseline | `pnpm --filter @croco/cli build && pnpm package-quality:report` |
| `@croco/cli` | `packages/cli/dist/agent.js` | 243 B | missing | - | - | missing-baseline | `pnpm --filter @croco/cli build && pnpm package-quality:report` |
| `@croco/cli` | `packages/cli/dist/architecturePolicy-*.js` | 369 B | 309 B | `@croco/cli:packages/cli/dist/architecturePolicy-*.js` | +60 B (+19.4%) | over-baseline | `pnpm --filter @croco/cli build && pnpm package-quality:report` |
| `@croco/cli` | `packages/cli/dist/bin/croco-agent.d.ts` | 20 B | missing | - | - | missing-baseline | `pnpm --filter @croco/cli build && pnpm package-quality:report` |
| `@croco/cli` | `packages/cli/dist/bin/croco-agent.js` | 2.6 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/cli build && pnpm package-quality:report` |
| `@croco/cli` | `packages/cli/dist/bin/croco.d.ts` | 20 B | 20 B | `@croco/cli:packages/cli/dist/bin/croco.d.ts` | +0 B (+0.0%) | within-baseline | `pnpm --filter @croco/cli build && pnpm package-quality:report` |
| `@croco/cli` | `packages/cli/dist/bin/croco.js` | 490 B | 3.1 KiB | `@croco/cli:packages/cli/dist/bin/croco.js` | -2.6 KiB (-84.6%) | within-baseline | `pnpm --filter @croco/cli build && pnpm package-quality:report` |
| `@croco/cli` | `packages/cli/dist/chunk-*.js` | 1.91 MiB | 334.7 KiB | `@croco/cli:packages/cli/dist/chunk-*.js` | +1.59 MiB (+485.3%) | over-baseline | `pnpm --filter @croco/cli build && pnpm package-quality:report` |
| `@croco/cli` | `packages/cli/dist/codegen-*.js` | 191 B | 101 B | `@croco/cli:packages/cli/dist/codegen-*.js` | +90 B (+89.1%) | over-baseline | `pnpm --filter @croco/cli build && pnpm package-quality:report` |
| `@croco/cli` | `packages/cli/dist/contracts-*.js` | 255 B | 105 B | `@croco/cli:packages/cli/dist/contracts-*.js` | +150 B (+142.9%) | over-baseline | `pnpm --filter @croco/cli build && pnpm package-quality:report` |
| `@croco/cli` | `packages/cli/dist/create-*.js` | 279 B | 189 B | `@croco/cli:packages/cli/dist/create-*.js` | +90 B (+47.6%) | over-baseline | `pnpm --filter @croco/cli build && pnpm package-quality:report` |
| `@croco/cli` | `packages/cli/dist/data-*.js` | 10.6 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/cli build && pnpm package-quality:report` |
| `@croco/cli` | `packages/cli/dist/di-*.js` | 181 B | 121 B | `@croco/cli:packages/cli/dist/di-*.js` | +60 B (+49.6%) | over-baseline | `pnpm --filter @croco/cli build && pnpm package-quality:report` |
| `@croco/cli` | `packages/cli/dist/generate-*.js` | 343 B | 223 B | `@croco/cli:packages/cli/dist/generate-*.js` | +120 B (+53.8%) | over-baseline | `pnpm --filter @croco/cli build && pnpm package-quality:report` |
| `@croco/cli` | `packages/cli/dist/index.d.ts` | 31.7 KiB | 28.1 KiB | `@croco/cli:packages/cli/dist/index.d.ts` | +3.6 KiB (+12.8%) | over-baseline | `pnpm --filter @croco/cli build && pnpm package-quality:report` |
| `@croco/cli` | `packages/cli/dist/index.js` | 4.9 KiB | 4.1 KiB | `@croco/cli:packages/cli/dist/index.js` | +877 B (+20.9%) | over-baseline | `pnpm --filter @croco/cli build && pnpm package-quality:report` |
| `@croco/cli` | `packages/cli/dist/jobs-*.js` | 749 B | 659 B | `@croco/cli:packages/cli/dist/jobs-*.js` | +90 B (+13.7%) | over-baseline | `pnpm --filter @croco/cli build && pnpm package-quality:report` |
| `@croco/cli` | `packages/cli/dist/jobs-BsRu-P_y.d.ts` | 3.9 KiB | 3.9 KiB | `@croco/cli:packages/cli/dist/jobs-BsRu-P_y.d.ts` | +0 B (+0.0%) | within-baseline | `pnpm --filter @croco/cli build && pnpm package-quality:report` |
| `@croco/cli` | `packages/cli/dist/jobs.d.ts` | 448 B | 448 B | `@croco/cli:packages/cli/dist/jobs.d.ts` | +0 B (+0.0%) | within-baseline | `pnpm --filter @croco/cli build && pnpm package-quality:report` |
| `@croco/cli` | `packages/cli/dist/jobs.js` | 561 B | 471 B | `@croco/cli:packages/cli/dist/jobs.js` | +90 B (+19.1%) | over-baseline | `pnpm --filter @croco/cli build && pnpm package-quality:report` |
| `@croco/cli` | `packages/cli/dist/make-*.js` | 245 B | 155 B | `@croco/cli:packages/cli/dist/make-*.js` | +90 B (+58.1%) | over-baseline | `pnpm --filter @croco/cli build && pnpm package-quality:report` |
| `@croco/cli` | `packages/cli/dist/ops-*.js` | 461 B | 371 B | `@croco/cli:packages/cli/dist/ops-*.js` | +90 B (+24.3%) | over-baseline | `pnpm --filter @croco/cli build && pnpm package-quality:report` |
| `@croco/cli` | `packages/cli/dist/ops.d.ts` | 1.7 KiB | 1.7 KiB | `@croco/cli:packages/cli/dist/ops.d.ts` | +0 B (+0.0%) | within-baseline | `pnpm --filter @croco/cli build && pnpm package-quality:report` |
| `@croco/cli` | `packages/cli/dist/ops.js` | 299 B | 239 B | `@croco/cli:packages/cli/dist/ops.js` | +60 B (+25.1%) | over-baseline | `pnpm --filter @croco/cli build && pnpm package-quality:report` |
| `@croco/cli` | `packages/cli/dist/pipeline-*.js` | 4.8 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/cli build && pnpm package-quality:report` |
| `@croco/cli` | `packages/cli/dist/project-*.js` | 576 B | 426 B | `@croco/cli:packages/cli/dist/project-*.js` | +150 B (+35.2%) | over-baseline | `pnpm --filter @croco/cli build && pnpm package-quality:report` |
| `@croco/cli` | `packages/cli/dist/runtimePolicy-*.js` | 359 B | 269 B | `@croco/cli:packages/cli/dist/runtimePolicy-*.js` | +90 B (+33.5%) | over-baseline | `pnpm --filter @croco/cli build && pnpm package-quality:report` |
| `@croco/cli` | `packages/cli/dist/test-*.js` | 12.8 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/cli build && pnpm package-quality:report` |
| `@croco/cli` | `packages/cli/dist/upgrade-*.js` | 395 B | 305 B | `@croco/cli:packages/cli/dist/upgrade-*.js` | +90 B (+29.5%) | over-baseline | `pnpm --filter @croco/cli build && pnpm package-quality:report` |
| `@croco/cohort-core` | `packages/cohort-core/dist/index.d.ts` | 6.2 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/cohort-core build && pnpm package-quality:report` |
| `@croco/cohort-core` | `packages/cohort-core/dist/index.js` | 9.1 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/cohort-core build && pnpm package-quality:report` |
| `@croco/cohort-core` | `packages/cohort-core/dist/index.mjs` | 8.4 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/cohort-core build && pnpm package-quality:report` |
| `@croco/cohort-drizzle` | `packages/cohort-drizzle/dist/index.d.ts` | 3.3 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/cohort-drizzle build && pnpm package-quality:report` |
| `@croco/cohort-drizzle` | `packages/cohort-drizzle/dist/index.js` | 12.9 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/cohort-drizzle build && pnpm package-quality:report` |
| `@croco/cohort-drizzle` | `packages/cohort-drizzle/dist/index.mjs` | 12.0 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/cohort-drizzle build && pnpm package-quality:report` |
| `@croco/credits-core` | `packages/credits-core/dist/index.d.ts` | 21.6 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/credits-core build && pnpm package-quality:report` |
| `@croco/credits-core` | `packages/credits-core/dist/index.js` | 51.5 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/credits-core build && pnpm package-quality:report` |
| `@croco/credits-core` | `packages/credits-core/dist/index.mjs` | 49.9 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/credits-core build && pnpm package-quality:report` |
| `@croco/credits-drizzle` | `packages/credits-drizzle/dist/index.d.ts` | 90.1 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/credits-drizzle build && pnpm package-quality:report` |
| `@croco/credits-drizzle` | `packages/credits-drizzle/dist/index.js` | 53.2 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/credits-drizzle build && pnpm package-quality:report` |
| `@croco/credits-drizzle` | `packages/credits-drizzle/dist/index.mjs` | 48.2 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/credits-drizzle build && pnpm package-quality:report` |
| `@croco/customer-health-core` | `packages/customer-health-core/dist/index.d.ts` | 10.5 KiB | 5.7 KiB | `@croco/customer-health-core:packages/customer-health-core/dist/index.d.ts` | +4.8 KiB (+83.9%) | over-baseline | `pnpm --filter @croco/customer-health-core build && pnpm package-quality:report` |
| `@croco/customer-health-core` | `packages/customer-health-core/dist/index.js` | 15.5 KiB | 4.8 KiB | `@croco/customer-health-core:packages/customer-health-core/dist/index.js` | +10.7 KiB (+225.1%) | over-baseline | `pnpm --filter @croco/customer-health-core build && pnpm package-quality:report` |
| `@croco/customer-health-core` | `packages/customer-health-core/dist/index.mjs` | 14.4 KiB | 4.1 KiB | `@croco/customer-health-core:packages/customer-health-core/dist/index.mjs` | +10.3 KiB (+249.8%) | over-baseline | `pnpm --filter @croco/customer-health-core build && pnpm package-quality:report` |
| `@croco/customer-health-drizzle` | `packages/customer-health-drizzle/dist/index.d.ts` | 18.6 KiB | 9.6 KiB | `@croco/customer-health-drizzle:packages/customer-health-drizzle/dist/index.d.ts` | +9.0 KiB (+93.7%) | over-baseline | `pnpm --filter @croco/customer-health-drizzle build && pnpm package-quality:report` |
| `@croco/customer-health-drizzle` | `packages/customer-health-drizzle/dist/index.js` | 14.6 KiB | 4.6 KiB | `@croco/customer-health-drizzle:packages/customer-health-drizzle/dist/index.js` | +10.0 KiB (+215.1%) | over-baseline | `pnpm --filter @croco/customer-health-drizzle build && pnpm package-quality:report` |
| `@croco/customer-health-drizzle` | `packages/customer-health-drizzle/dist/index.mjs` | 13.7 KiB | 4.1 KiB | `@croco/customer-health-drizzle:packages/customer-health-drizzle/dist/index.mjs` | +9.6 KiB (+235.7%) | over-baseline | `pnpm --filter @croco/customer-health-drizzle build && pnpm package-quality:report` |
| `@croco/dataloader-core` | `packages/dataloader-core/dist/index.cjs` | 12.1 KiB | 8.4 KiB | `@croco/dataloader-core:packages/dataloader-core/dist/index.cjs` | +3.7 KiB (+44.2%) | over-baseline | `pnpm --filter @croco/dataloader-core build && pnpm package-quality:report` |
| `@croco/dataloader-core` | `packages/dataloader-core/dist/index.d.ts` | 3.6 KiB | 2.6 KiB | `@croco/dataloader-core:packages/dataloader-core/dist/index.d.ts` | +1.1 KiB (+41.3%) | over-baseline | `pnpm --filter @croco/dataloader-core build && pnpm package-quality:report` |
| `@croco/dataloader-core` | `packages/dataloader-core/dist/index.js` | 10.7 KiB | 7.1 KiB | `@croco/dataloader-core:packages/dataloader-core/dist/index.js` | +3.6 KiB (+50.6%) | over-baseline | `pnpm --filter @croco/dataloader-core build && pnpm package-quality:report` |
| `@croco/diagnostics-core` | `packages/diagnostics-core/dist/index.d.ts` | 24.3 KiB | 16.3 KiB | `@croco/diagnostics-core:packages/diagnostics-core/dist/index.d.ts` | +8.0 KiB (+49.2%) | over-baseline | `pnpm --filter @croco/diagnostics-core build && pnpm package-quality:report` |
| `@croco/diagnostics-core` | `packages/diagnostics-core/dist/index.js` | 55.0 KiB | 38.2 KiB | `@croco/diagnostics-core:packages/diagnostics-core/dist/index.js` | +16.8 KiB (+43.9%) | over-baseline | `pnpm --filter @croco/diagnostics-core build && pnpm package-quality:report` |
| `@croco/diagnostics-core` | `packages/diagnostics-core/dist/index.mjs` | 54.2 KiB | 37.5 KiB | `@croco/diagnostics-core:packages/diagnostics-core/dist/index.mjs` | +16.7 KiB (+44.6%) | over-baseline | `pnpm --filter @croco/diagnostics-core build && pnpm package-quality:report` |
| `@croco/engagement-core` | `packages/engagement-core/dist/index.d.ts` | 60.4 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/engagement-core build && pnpm package-quality:report` |
| `@croco/engagement-core` | `packages/engagement-core/dist/index.js` | 124.8 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/engagement-core build && pnpm package-quality:report` |
| `@croco/engagement-core` | `packages/engagement-core/dist/index.mjs` | 120.5 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/engagement-core build && pnpm package-quality:report` |
| `@croco/engagement-drizzle` | `packages/engagement-drizzle/dist/index.d.ts` | 215.0 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/engagement-drizzle build && pnpm package-quality:report` |
| `@croco/engagement-drizzle` | `packages/engagement-drizzle/dist/index.js` | 67.4 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/engagement-drizzle build && pnpm package-quality:report` |
| `@croco/engagement-drizzle` | `packages/engagement-drizzle/dist/index.mjs` | 61.8 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/engagement-drizzle build && pnpm package-quality:report` |
| `@croco/entitlements-core` | `packages/entitlements-core/dist/index.d.ts` | 17.9 KiB | 11.6 KiB | `@croco/entitlements-core:packages/entitlements-core/dist/index.d.ts` | +6.3 KiB (+53.9%) | over-baseline | `pnpm --filter @croco/entitlements-core build && pnpm package-quality:report` |
| `@croco/entitlements-core` | `packages/entitlements-core/dist/index.js` | 30.4 KiB | 15.8 KiB | `@croco/entitlements-core:packages/entitlements-core/dist/index.js` | +14.6 KiB (+92.3%) | over-baseline | `pnpm --filter @croco/entitlements-core build && pnpm package-quality:report` |
| `@croco/entitlements-core` | `packages/entitlements-core/dist/index.mjs` | 28.6 KiB | 14.5 KiB | `@croco/entitlements-core:packages/entitlements-core/dist/index.mjs` | +14.1 KiB (+97.3%) | over-baseline | `pnpm --filter @croco/entitlements-core build && pnpm package-quality:report` |
| `@croco/entitlements-drizzle` | `packages/entitlements-drizzle/dist/index.d.ts` | 12.8 KiB | 7.4 KiB | `@croco/entitlements-drizzle:packages/entitlements-drizzle/dist/index.d.ts` | +5.4 KiB (+73.8%) | over-baseline | `pnpm --filter @croco/entitlements-drizzle build && pnpm package-quality:report` |
| `@croco/entitlements-drizzle` | `packages/entitlements-drizzle/dist/index.js` | 14.3 KiB | 2.4 KiB | `@croco/entitlements-drizzle:packages/entitlements-drizzle/dist/index.js` | +11.9 KiB (+494.4%) | over-baseline | `pnpm --filter @croco/entitlements-drizzle build && pnpm package-quality:report` |
| `@croco/entitlements-drizzle` | `packages/entitlements-drizzle/dist/index.mjs` | 13.2 KiB | 1.9 KiB | `@croco/entitlements-drizzle:packages/entitlements-drizzle/dist/index.mjs` | +11.3 KiB (+610.3%) | over-baseline | `pnpm --filter @croco/entitlements-drizzle build && pnpm package-quality:report` |
| `@croco/esbuild-plugin` | `packages/esbuild-plugin/dist/index.d.ts` | 7.8 KiB | 2.4 KiB | `@croco/esbuild-plugin:packages/esbuild-plugin/dist/index.d.ts` | +5.4 KiB (+228.4%) | over-baseline | `pnpm --filter @croco/esbuild-plugin build && pnpm package-quality:report` |
| `@croco/esbuild-plugin` | `packages/esbuild-plugin/dist/index.js` | 42.7 KiB | 8.6 KiB | `@croco/esbuild-plugin:packages/esbuild-plugin/dist/index.js` | +34.1 KiB (+396.5%) | over-baseline | `pnpm --filter @croco/esbuild-plugin build && pnpm package-quality:report` |
| `@croco/esbuild-plugin` | `packages/esbuild-plugin/dist/index.mjs` | 41.8 KiB | 7.8 KiB | `@croco/esbuild-plugin:packages/esbuild-plugin/dist/index.mjs` | +34.0 KiB (+434.1%) | over-baseline | `pnpm --filter @croco/esbuild-plugin build && pnpm package-quality:report` |
| `@croco/etl-core` | `packages/etl-core/dist/chunk-*.mjs` | 12.8 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/etl-core build && pnpm package-quality:report` |
| `@croco/etl-core` | `packages/etl-core/dist/index.d.ts` | 320 B | missing | - | - | missing-baseline | `pnpm --filter @croco/etl-core build && pnpm package-quality:report` |
| `@croco/etl-core` | `packages/etl-core/dist/index.js` | 13.3 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/etl-core build && pnpm package-quality:report` |
| `@croco/etl-core` | `packages/etl-core/dist/index.mjs` | 210 B | missing | - | - | missing-baseline | `pnpm --filter @croco/etl-core build && pnpm package-quality:report` |
| `@croco/etl-core` | `packages/etl-core/dist/pipeline.d.ts` | 7.1 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/etl-core build && pnpm package-quality:report` |
| `@croco/etl-core` | `packages/etl-core/dist/pipeline.js` | 30.8 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/etl-core build && pnpm package-quality:report` |
| `@croco/etl-core` | `packages/etl-core/dist/pipeline.mjs` | 19.1 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/etl-core build && pnpm package-quality:report` |
| `@croco/etl-core` | `packages/etl-core/dist/source.d.ts` | 1.6 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/etl-core build && pnpm package-quality:report` |
| `@croco/etl-core` | `packages/etl-core/dist/source.js` | 13.3 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/etl-core build && pnpm package-quality:report` |
| `@croco/etl-core` | `packages/etl-core/dist/source.mjs` | 210 B | missing | - | - | missing-baseline | `pnpm --filter @croco/etl-core build && pnpm package-quality:report` |
| `@croco/etl-core` | `packages/etl-core/dist/types-zHkwzeIb.d.ts` | 890 B | missing | - | - | missing-baseline | `pnpm --filter @croco/etl-core build && pnpm package-quality:report` |
| `@croco/etl-events-tx` | `packages/etl-events-tx/dist/AnalyticsOutboxConsumer-T_-xjuxg.d.ts` | 2.7 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/etl-events-tx build && pnpm package-quality:report` |
| `@croco/etl-events-tx` | `packages/etl-events-tx/dist/chunk-*.mjs` | 323 B | missing | - | - | missing-baseline | `pnpm --filter @croco/etl-events-tx build && pnpm package-quality:report` |
| `@croco/etl-events-tx` | `packages/etl-events-tx/dist/index.d.ts` | 672 B | missing | - | - | missing-baseline | `pnpm --filter @croco/etl-events-tx build && pnpm package-quality:report` |
| `@croco/etl-events-tx` | `packages/etl-events-tx/dist/index.js` | 5.1 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/etl-events-tx build && pnpm package-quality:report` |
| `@croco/etl-events-tx` | `packages/etl-events-tx/dist/index.mjs` | 4.4 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/etl-events-tx build && pnpm package-quality:report` |
| `@croco/etl-events-tx` | `packages/etl-events-tx/dist/postgres.d.ts` | 1.2 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/etl-events-tx build && pnpm package-quality:report` |
| `@croco/etl-events-tx` | `packages/etl-events-tx/dist/postgres.js` | 2.1 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/etl-events-tx build && pnpm package-quality:report` |
| `@croco/etl-events-tx` | `packages/etl-events-tx/dist/postgres.mjs` | 1.4 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/etl-events-tx build && pnpm package-quality:report` |
| `@croco/events-core` | `packages/events-core/dist/index.d.ts` | 23.5 KiB | 24.2 KiB | `@croco/events-core:packages/events-core/dist/index.d.ts` | -723 B (-2.9%) | within-baseline | `pnpm --filter @croco/events-core build && pnpm package-quality:report` |
| `@croco/events-core` | `packages/events-core/dist/index.js` | 18.9 KiB | 12.8 KiB | `@croco/events-core:packages/events-core/dist/index.js` | +6.1 KiB (+47.4%) | over-baseline | `pnpm --filter @croco/events-core build && pnpm package-quality:report` |
| `@croco/events-core` | `packages/events-core/dist/index.mjs` | 17.3 KiB | 11.7 KiB | `@croco/events-core:packages/events-core/dist/index.mjs` | +5.6 KiB (+48.4%) | over-baseline | `pnpm --filter @croco/events-core build && pnpm package-quality:report` |
| `@croco/events-inmemory` | `packages/events-inmemory/dist/index.d.ts` | 12.8 KiB | 3.3 KiB | `@croco/events-inmemory:packages/events-inmemory/dist/index.d.ts` | +9.5 KiB (+289.7%) | over-baseline | `pnpm --filter @croco/events-inmemory build && pnpm package-quality:report` |
| `@croco/events-inmemory` | `packages/events-inmemory/dist/index.js` | 25.6 KiB | 8.4 KiB | `@croco/events-inmemory:packages/events-inmemory/dist/index.js` | +17.2 KiB (+206.1%) | over-baseline | `pnpm --filter @croco/events-inmemory build && pnpm package-quality:report` |
| `@croco/events-inmemory` | `packages/events-inmemory/dist/index.mjs` | 24.3 KiB | 7.8 KiB | `@croco/events-inmemory:packages/events-inmemory/dist/index.mjs` | +16.5 KiB (+211.8%) | over-baseline | `pnpm --filter @croco/events-inmemory build && pnpm package-quality:report` |
| `@croco/events-tx` | `packages/events-tx/dist/index.d.ts` | 46.5 KiB | 40.0 KiB | `@croco/events-tx:packages/events-tx/dist/index.d.ts` | +6.5 KiB (+16.3%) | over-baseline | `pnpm --filter @croco/events-tx build && pnpm package-quality:report` |
| `@croco/events-tx` | `packages/events-tx/dist/index.js` | 52.4 KiB | 30.0 KiB | `@croco/events-tx:packages/events-tx/dist/index.js` | +22.4 KiB (+74.6%) | over-baseline | `pnpm --filter @croco/events-tx build && pnpm package-quality:report` |
| `@croco/events-tx` | `packages/events-tx/dist/index.mjs` | 50.2 KiB | 28.5 KiB | `@croco/events-tx:packages/events-tx/dist/index.mjs` | +21.7 KiB (+76.0%) | over-baseline | `pnpm --filter @croco/events-tx build && pnpm package-quality:report` |
| `@croco/execution-core` | `packages/execution-core/dist/index.d.ts` | 36.2 KiB | 16.8 KiB | `@croco/execution-core:packages/execution-core/dist/index.d.ts` | +19.4 KiB (+115.8%) | over-baseline | `pnpm --filter @croco/execution-core build && pnpm package-quality:report` |
| `@croco/execution-core` | `packages/execution-core/dist/index.js` | 26.2 KiB | 8.1 KiB | `@croco/execution-core:packages/execution-core/dist/index.js` | +18.1 KiB (+222.7%) | over-baseline | `pnpm --filter @croco/execution-core build && pnpm package-quality:report` |
| `@croco/execution-core` | `packages/execution-core/dist/index.mjs` | 25.2 KiB | 7.5 KiB | `@croco/execution-core:packages/execution-core/dist/index.mjs` | +17.7 KiB (+234.6%) | over-baseline | `pnpm --filter @croco/execution-core build && pnpm package-quality:report` |
| `@croco/execution-drizzle` | `packages/execution-drizzle/dist/index.d.ts` | 18.2 KiB | 14.6 KiB | `@croco/execution-drizzle:packages/execution-drizzle/dist/index.d.ts` | +3.6 KiB (+25.1%) | over-baseline | `pnpm --filter @croco/execution-drizzle build && pnpm package-quality:report` |
| `@croco/execution-drizzle` | `packages/execution-drizzle/dist/index.js` | 14.4 KiB | 6.4 KiB | `@croco/execution-drizzle:packages/execution-drizzle/dist/index.js` | +8.1 KiB (+126.4%) | over-baseline | `pnpm --filter @croco/execution-drizzle build && pnpm package-quality:report` |
| `@croco/execution-drizzle` | `packages/execution-drizzle/dist/index.mjs` | 13.4 KiB | 5.7 KiB | `@croco/execution-drizzle:packages/execution-drizzle/dist/index.mjs` | +7.8 KiB (+136.9%) | over-baseline | `pnpm --filter @croco/execution-drizzle build && pnpm package-quality:report` |
| `@croco/experience-core` | `packages/experience-core/dist/index.d.ts` | 13.6 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/experience-core build && pnpm package-quality:report` |
| `@croco/experience-core` | `packages/experience-core/dist/index.js` | 20.5 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/experience-core build && pnpm package-quality:report` |
| `@croco/experience-core` | `packages/experience-core/dist/index.mjs` | 19.7 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/experience-core build && pnpm package-quality:report` |
| `@croco/experience-drizzle` | `packages/experience-drizzle/dist/index.d.ts` | 2.4 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/experience-drizzle build && pnpm package-quality:report` |
| `@croco/experience-drizzle` | `packages/experience-drizzle/dist/index.js` | 19.4 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/experience-drizzle build && pnpm package-quality:report` |
| `@croco/experience-drizzle` | `packages/experience-drizzle/dist/index.mjs` | 18.5 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/experience-drizzle build && pnpm package-quality:report` |
| `@croco/features-core` | `packages/features-core/dist/index.d.ts` | 39.0 KiB | 712 B | `@croco/features-core:packages/features-core/dist/index.d.ts` | +38.3 KiB (+5511.1%) | over-baseline | `pnpm --filter @croco/features-core build && pnpm package-quality:report` |
| `@croco/features-core` | `packages/features-core/dist/index.js` | 51.4 KiB | 610 B | `@croco/features-core:packages/features-core/dist/index.js` | +50.8 KiB (+8528.7%) | over-baseline | `pnpm --filter @croco/features-core build && pnpm package-quality:report` |
| `@croco/features-core` | `packages/features-core/dist/index.mjs` | 49.8 KiB | 124 B | `@croco/features-core:packages/features-core/dist/index.mjs` | +49.7 KiB (+41028.2%) | over-baseline | `pnpm --filter @croco/features-core build && pnpm package-quality:report` |
| `@croco/features-drizzle` | `packages/features-drizzle/dist/index.d.ts` | 73.7 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/features-drizzle build && pnpm package-quality:report` |
| `@croco/features-drizzle` | `packages/features-drizzle/dist/index.js` | 58.1 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/features-drizzle build && pnpm package-quality:report` |
| `@croco/features-drizzle` | `packages/features-drizzle/dist/index.mjs` | 53.3 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/features-drizzle build && pnpm package-quality:report` |
| `@croco/features-posthog` | `packages/features-posthog/dist/index.d.ts` | 1.4 KiB | 675 B | `@croco/features-posthog:packages/features-posthog/dist/index.d.ts` | +769 B (+113.9%) | over-baseline | `pnpm --filter @croco/features-posthog build && pnpm package-quality:report` |
| `@croco/features-posthog` | `packages/features-posthog/dist/index.js` | 4.3 KiB | 1.9 KiB | `@croco/features-posthog:packages/features-posthog/dist/index.js` | +2.4 KiB (+130.7%) | over-baseline | `pnpm --filter @croco/features-posthog build && pnpm package-quality:report` |
| `@croco/features-posthog` | `packages/features-posthog/dist/index.mjs` | 3.8 KiB | 1.4 KiB | `@croco/features-posthog:packages/features-posthog/dist/index.mjs` | +2.4 KiB (+169.5%) | over-baseline | `pnpm --filter @croco/features-posthog build && pnpm package-quality:report` |
| `@croco/framework-config` | `packages/framework-config/dist/index.d.ts` | 9.4 KiB | 3.0 KiB | `@croco/framework-config:packages/framework-config/dist/index.d.ts` | +6.3 KiB (+207.4%) | over-baseline | `pnpm --filter @croco/framework-config build && pnpm package-quality:report` |
| `@croco/framework-config` | `packages/framework-config/dist/index.js` | 9.9 KiB | 3.8 KiB | `@croco/framework-config:packages/framework-config/dist/index.js` | +6.1 KiB (+159.0%) | over-baseline | `pnpm --filter @croco/framework-config build && pnpm package-quality:report` |
| `@croco/framework-config` | `packages/framework-config/dist/index.mjs` | 9.1 KiB | 3.2 KiB | `@croco/framework-config:packages/framework-config/dist/index.mjs` | +5.9 KiB (+182.4%) | over-baseline | `pnpm --filter @croco/framework-config build && pnpm package-quality:report` |
| `@croco/framework-context` | `packages/framework-context/dist/index.d.ts` | 65.3 KiB | 41.6 KiB | `@croco/framework-context:packages/framework-context/dist/index.d.ts` | +23.7 KiB (+57.0%) | over-baseline | `pnpm --filter @croco/framework-context build && pnpm package-quality:report` |
| `@croco/framework-context` | `packages/framework-context/dist/index.js` | 98.2 KiB | 49.2 KiB | `@croco/framework-context:packages/framework-context/dist/index.js` | +48.9 KiB (+99.4%) | over-baseline | `pnpm --filter @croco/framework-context build && pnpm package-quality:report` |
| `@croco/framework-context` | `packages/framework-context/dist/index.mjs` | 94.7 KiB | 46.8 KiB | `@croco/framework-context:packages/framework-context/dist/index.mjs` | +48.0 KiB (+102.6%) | over-baseline | `pnpm --filter @croco/framework-context build && pnpm package-quality:report` |
| `@croco/framework-logger` | `packages/framework-logger/dist/index.d.ts` | 1.4 KiB | 1.4 KiB | `@croco/framework-logger:packages/framework-logger/dist/index.d.ts` | +56 B (+4.0%) | over-baseline | `pnpm --filter @croco/framework-logger build && pnpm package-quality:report` |
| `@croco/framework-logger` | `packages/framework-logger/dist/index.js` | 7.3 KiB | 2.7 KiB | `@croco/framework-logger:packages/framework-logger/dist/index.js` | +4.6 KiB (+173.9%) | over-baseline | `pnpm --filter @croco/framework-logger build && pnpm package-quality:report` |
| `@croco/framework-logger` | `packages/framework-logger/dist/index.mjs` | 6.7 KiB | 2.1 KiB | `@croco/framework-logger:packages/framework-logger/dist/index.mjs` | +4.6 KiB (+214.3%) | over-baseline | `pnpm --filter @croco/framework-logger build && pnpm package-quality:report` |
| `@croco/framework-module` | `packages/framework-module/dist/index.d.ts` | 20.9 KiB | 7.0 KiB | `@croco/framework-module:packages/framework-module/dist/index.d.ts` | +13.9 KiB (+198.3%) | over-baseline | `pnpm --filter @croco/framework-module build && pnpm package-quality:report` |
| `@croco/framework-module` | `packages/framework-module/dist/index.js` | 116.5 KiB | 26.9 KiB | `@croco/framework-module:packages/framework-module/dist/index.js` | +89.6 KiB (+332.9%) | over-baseline | `pnpm --filter @croco/framework-module build && pnpm package-quality:report` |
| `@croco/framework-module` | `packages/framework-module/dist/index.mjs` | 112.3 KiB | 25.1 KiB | `@croco/framework-module:packages/framework-module/dist/index.mjs` | +87.2 KiB (+348.1%) | over-baseline | `pnpm --filter @croco/framework-module build && pnpm package-quality:report` |
| `@croco/framework-preset` | `packages/framework-preset/dist/index.d.ts` | 1.8 KiB | 930 B | `@croco/framework-preset:packages/framework-preset/dist/index.d.ts` | +915 B (+98.4%) | over-baseline | `pnpm --filter @croco/framework-preset build && pnpm package-quality:report` |
| `@croco/framework-preset` | `packages/framework-preset/dist/index.js` | 2.9 KiB | 2.5 KiB | `@croco/framework-preset:packages/framework-preset/dist/index.js` | +356 B (+13.8%) | over-baseline | `pnpm --filter @croco/framework-preset build && pnpm package-quality:report` |
| `@croco/framework-preset` | `packages/framework-preset/dist/index.mjs` | 1.9 KiB | 1.6 KiB | `@croco/framework-preset:packages/framework-preset/dist/index.mjs` | +300 B (+18.2%) | over-baseline | `pnpm --filter @croco/framework-preset build && pnpm package-quality:report` |
| `@croco/framework-routes` | `packages/framework-routes/dist/chunk-*.mjs` | 318.5 KiB | 478.8 KiB | `@croco/framework-routes:packages/framework-routes/dist/chunk-*.mjs` | -160.4 KiB (-33.5%) | within-baseline | `pnpm --filter @croco/framework-routes build && pnpm package-quality:report` |
| `@croco/framework-routes` | `packages/framework-routes/dist/compiler.d.ts` | 2.2 KiB | 1.9 KiB | `@croco/framework-routes:packages/framework-routes/dist/compiler.d.ts` | +365 B (+18.8%) | over-baseline | `pnpm --filter @croco/framework-routes build && pnpm package-quality:report` |
| `@croco/framework-routes` | `packages/framework-routes/dist/compiler.js` | 317.6 KiB | 239.1 KiB | `@croco/framework-routes:packages/framework-routes/dist/compiler.js` | +78.5 KiB (+32.8%) | over-baseline | `pnpm --filter @croco/framework-routes build && pnpm package-quality:report` |
| `@croco/framework-routes` | `packages/framework-routes/dist/compiler.mjs` | 433 B | 433 B | `@croco/framework-routes:packages/framework-routes/dist/compiler.mjs` | +0 B (+0.0%) | within-baseline | `pnpm --filter @croco/framework-routes build && pnpm package-quality:report` |
| `@croco/framework-routes` | `packages/framework-routes/dist/index.d.ts` | 11.7 KiB | 11.7 KiB | `@croco/framework-routes:packages/framework-routes/dist/index.d.ts` | +64 B (+0.5%) | over-baseline | `pnpm --filter @croco/framework-routes build && pnpm package-quality:report` |
| `@croco/framework-routes` | `packages/framework-routes/dist/index.js` | 320.3 KiB | 241.4 KiB | `@croco/framework-routes:packages/framework-routes/dist/index.js` | +78.9 KiB (+32.7%) | over-baseline | `pnpm --filter @croco/framework-routes build && pnpm package-quality:report` |
| `@croco/framework-routes` | `packages/framework-routes/dist/index.mjs` | 1.1 KiB | 1.1 KiB | `@croco/framework-routes:packages/framework-routes/dist/index.mjs` | +0 B (+0.0%) | within-baseline | `pnpm --filter @croco/framework-routes build && pnpm package-quality:report` |
| `@croco/framework-routes` | `packages/framework-routes/dist/metadata-reader.d.ts` | 1.2 KiB | 955 B | `@croco/framework-routes:packages/framework-routes/dist/metadata-reader.d.ts` | +275 B (+28.8%) | over-baseline | `pnpm --filter @croco/framework-routes build && pnpm package-quality:report` |
| `@croco/framework-routes` | `packages/framework-routes/dist/metadata-reader.js` | 4.6 KiB | 10.3 KiB | `@croco/framework-routes:packages/framework-routes/dist/metadata-reader.js` | -5.8 KiB (-55.9%) | within-baseline | `pnpm --filter @croco/framework-routes build && pnpm package-quality:report` |
| `@croco/framework-routes` | `packages/framework-routes/dist/metadata-reader.mjs` | 350 B | 302 B | `@croco/framework-routes:packages/framework-routes/dist/metadata-reader.mjs` | +48 B (+15.9%) | over-baseline | `pnpm --filter @croco/framework-routes build && pnpm package-quality:report` |
| `@croco/frontend-cloudflare` | `packages/frontend-cloudflare/dist/worker.cjs` | 3.3 KiB | 1.5 KiB | `@croco/frontend-cloudflare:packages/frontend-cloudflare/dist/worker.cjs` | +1.8 KiB (+120.2%) | over-baseline | `pnpm --filter @croco/frontend-cloudflare build && pnpm package-quality:report` |
| `@croco/frontend-cloudflare` | `packages/frontend-cloudflare/dist/worker.d.ts` | 2.7 KiB | 1.3 KiB | `@croco/frontend-cloudflare:packages/frontend-cloudflare/dist/worker.d.ts` | +1.4 KiB (+106.6%) | over-baseline | `pnpm --filter @croco/frontend-cloudflare build && pnpm package-quality:report` |
| `@croco/frontend-cloudflare` | `packages/frontend-cloudflare/dist/worker.js` | 2.9 KiB | 1.0 KiB | `@croco/frontend-cloudflare:packages/frontend-cloudflare/dist/worker.js` | +1.8 KiB (+173.7%) | over-baseline | `pnpm --filter @croco/frontend-cloudflare build && pnpm package-quality:report` |
| `@croco/frontend-problems` | `packages/frontend-problems/dist/index.d.ts` | 10.1 KiB | 9.4 KiB | `@croco/frontend-problems:packages/frontend-problems/dist/index.d.ts` | +675 B (+7.0%) | over-baseline | `pnpm --filter @croco/frontend-problems build && pnpm package-quality:report` |
| `@croco/frontend-problems` | `packages/frontend-problems/dist/index.js` | 13.1 KiB | 5.5 KiB | `@croco/frontend-problems:packages/frontend-problems/dist/index.js` | +7.6 KiB (+139.8%) | over-baseline | `pnpm --filter @croco/frontend-problems build && pnpm package-quality:report` |
| `@croco/frontend-problems` | `packages/frontend-problems/dist/index.mjs` | 12.2 KiB | 4.6 KiB | `@croco/frontend-problems:packages/frontend-problems/dist/index.mjs` | +7.6 KiB (+163.8%) | over-baseline | `pnpm --filter @croco/frontend-problems build && pnpm package-quality:report` |
| `@croco/frontend-react` | `packages/frontend-react/dist/chunk-*.mjs` | 7.1 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/frontend-react build && pnpm package-quality:report` |
| `@croco/frontend-react` | `packages/frontend-react/dist/experience-slot.d.ts` | 816 B | missing | - | - | missing-baseline | `pnpm --filter @croco/frontend-react build && pnpm package-quality:report` |
| `@croco/frontend-react` | `packages/frontend-react/dist/experience-slot.js` | 4.1 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/frontend-react build && pnpm package-quality:report` |
| `@croco/frontend-react` | `packages/frontend-react/dist/experience-slot.mjs` | 99 B | missing | - | - | missing-baseline | `pnpm --filter @croco/frontend-react build && pnpm package-quality:report` |
| `@croco/frontend-react` | `packages/frontend-react/dist/index.d.ts` | 33.1 KiB | 18.1 KiB | `@croco/frontend-react:packages/frontend-react/dist/index.d.ts` | +14.9 KiB (+82.4%) | over-baseline | `pnpm --filter @croco/frontend-react build && pnpm package-quality:report` |
| `@croco/frontend-react` | `packages/frontend-react/dist/index.js` | 61.3 KiB | 15.9 KiB | `@croco/frontend-react:packages/frontend-react/dist/index.js` | +45.3 KiB (+284.3%) | over-baseline | `pnpm --filter @croco/frontend-react build && pnpm package-quality:report` |
| `@croco/frontend-react` | `packages/frontend-react/dist/index.mjs` | 48.0 KiB | 14.1 KiB | `@croco/frontend-react:packages/frontend-react/dist/index.mjs` | +33.9 KiB (+239.8%) | over-baseline | `pnpm --filter @croco/frontend-react build && pnpm package-quality:report` |
| `@croco/frontend-react` | `packages/frontend-react/dist/surveys.d.ts` | 729 B | missing | - | - | missing-baseline | `pnpm --filter @croco/frontend-react build && pnpm package-quality:report` |
| `@croco/frontend-react` | `packages/frontend-react/dist/surveys.js` | 4.7 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/frontend-react build && pnpm package-quality:report` |
| `@croco/frontend-react` | `packages/frontend-react/dist/surveys.mjs` | 119 B | missing | - | - | missing-baseline | `pnpm --filter @croco/frontend-react build && pnpm package-quality:report` |
| `@croco/frontend-vite` | `packages/frontend-vite/dist/index.d.ts` | 1.8 KiB | 1.8 KiB | `@croco/frontend-vite:packages/frontend-vite/dist/index.d.ts` | +0 B (+0.0%) | within-baseline | `pnpm --filter @croco/frontend-vite build && pnpm package-quality:report` |
| `@croco/frontend-vite` | `packages/frontend-vite/dist/index.js` | 2.1 KiB | 1.9 KiB | `@croco/frontend-vite:packages/frontend-vite/dist/index.js` | +254 B (+13.2%) | over-baseline | `pnpm --filter @croco/frontend-vite build && pnpm package-quality:report` |
| `@croco/frontend-vite` | `packages/frontend-vite/dist/index.mjs` | 1.5 KiB | 1.2 KiB | `@croco/frontend-vite:packages/frontend-vite/dist/index.mjs` | +278 B (+22.9%) | over-baseline | `pnpm --filter @croco/frontend-vite build && pnpm package-quality:report` |
| `@croco/gamification-core` | `packages/gamification-core/dist/chunk-*.js` | 5.9 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/gamification-core build && pnpm package-quality:report` |
| `@croco/gamification-core` | `packages/gamification-core/dist/chunk-*.mjs` | 4.7 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/gamification-core build && pnpm package-quality:report` |
| `@croco/gamification-core` | `packages/gamification-core/dist/index.d.ts` | 12.2 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/gamification-core build && pnpm package-quality:report` |
| `@croco/gamification-core` | `packages/gamification-core/dist/index.js` | 31.2 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/gamification-core build && pnpm package-quality:report` |
| `@croco/gamification-core` | `packages/gamification-core/dist/index.mjs` | 25.9 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/gamification-core build && pnpm package-quality:report` |
| `@croco/gamification-core` | `packages/gamification-core/dist/mission-validation-BLVRosLO.d.ts` | 1.7 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/gamification-core build && pnpm package-quality:report` |
| `@croco/gamification-core` | `packages/gamification-core/dist/mission-validation.d.ts` | 204 B | missing | - | - | missing-baseline | `pnpm --filter @croco/gamification-core build && pnpm package-quality:report` |
| `@croco/gamification-core` | `packages/gamification-core/dist/mission-validation.js` | 266 B | missing | - | - | missing-baseline | `pnpm --filter @croco/gamification-core build && pnpm package-quality:report` |
| `@croco/gamification-core` | `packages/gamification-core/dist/mission-validation.mjs` | 144 B | missing | - | - | missing-baseline | `pnpm --filter @croco/gamification-core build && pnpm package-quality:report` |
| `@croco/gamification-core` | `packages/gamification-core/dist/reward-contracts.d.ts` | 1.6 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/gamification-core build && pnpm package-quality:report` |
| `@croco/gamification-core` | `packages/gamification-core/dist/reward-contracts.js` | 5.4 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/gamification-core build && pnpm package-quality:report` |
| `@croco/gamification-core` | `packages/gamification-core/dist/reward-contracts.mjs` | 4.3 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/gamification-core build && pnpm package-quality:report` |
| `@croco/gamification-core` | `packages/gamification-core/dist/types-C_7-jxsq.d.ts` | 7.1 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/gamification-core build && pnpm package-quality:report` |
| `@croco/gamification-drizzle` | `packages/gamification-drizzle/dist/index.d.ts` | 95.8 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/gamification-drizzle build && pnpm package-quality:report` |
| `@croco/gamification-drizzle` | `packages/gamification-drizzle/dist/index.js` | 35.7 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/gamification-drizzle build && pnpm package-quality:report` |
| `@croco/gamification-drizzle` | `packages/gamification-drizzle/dist/index.mjs` | 32.6 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/gamification-drizzle build && pnpm package-quality:report` |
| `@croco/gid-core` | `packages/gid-core/dist/index.d.ts` | 2.3 KiB | 2.0 KiB | `@croco/gid-core:packages/gid-core/dist/index.d.ts` | +239 B (+11.5%) | over-baseline | `pnpm --filter @croco/gid-core build && pnpm package-quality:report` |
| `@croco/gid-core` | `packages/gid-core/dist/index.js` | 3.0 KiB | 1.9 KiB | `@croco/gid-core:packages/gid-core/dist/index.js` | +1.1 KiB (+55.5%) | over-baseline | `pnpm --filter @croco/gid-core build && pnpm package-quality:report` |
| `@croco/gid-core` | `packages/gid-core/dist/index.mjs` | 2.5 KiB | 1.4 KiB | `@croco/gid-core:packages/gid-core/dist/index.mjs` | +1.1 KiB (+78.6%) | over-baseline | `pnpm --filter @croco/gid-core build && pnpm package-quality:report` |
| `@croco/governance-core` | `packages/governance-core/dist/index.d.ts` | 14.8 KiB | 14.0 KiB | `@croco/governance-core:packages/governance-core/dist/index.d.ts` | +785 B (+5.5%) | over-baseline | `pnpm --filter @croco/governance-core build && pnpm package-quality:report` |
| `@croco/governance-core` | `packages/governance-core/dist/index.js` | 26.4 KiB | 15.1 KiB | `@croco/governance-core:packages/governance-core/dist/index.js` | +11.4 KiB (+75.4%) | over-baseline | `pnpm --filter @croco/governance-core build && pnpm package-quality:report` |
| `@croco/governance-core` | `packages/governance-core/dist/index.mjs` | 25.6 KiB | 14.2 KiB | `@croco/governance-core:packages/governance-core/dist/index.mjs` | +11.4 KiB (+79.8%) | over-baseline | `pnpm --filter @croco/governance-core build && pnpm package-quality:report` |
| `@croco/health-core` | `packages/health-core/dist/index.d.ts` | 5.3 KiB | 1.5 KiB | `@croco/health-core:packages/health-core/dist/index.d.ts` | +3.8 KiB (+250.6%) | over-baseline | `pnpm --filter @croco/health-core build && pnpm package-quality:report` |
| `@croco/health-core` | `packages/health-core/dist/index.js` | 5.9 KiB | 1.7 KiB | `@croco/health-core:packages/health-core/dist/index.js` | +4.2 KiB (+248.9%) | over-baseline | `pnpm --filter @croco/health-core build && pnpm package-quality:report` |
| `@croco/health-core` | `packages/health-core/dist/index.mjs` | 5.3 KiB | 1.2 KiB | `@croco/health-core:packages/health-core/dist/index.mjs` | +4.1 KiB (+341.2%) | over-baseline | `pnpm --filter @croco/health-core build && pnpm package-quality:report` |
| `@croco/idempotency-core` | `packages/idempotency-core/dist/index.d.ts` | 16.2 KiB | 13.1 KiB | `@croco/idempotency-core:packages/idempotency-core/dist/index.d.ts` | +3.1 KiB (+23.3%) | over-baseline | `pnpm --filter @croco/idempotency-core build && pnpm package-quality:report` |
| `@croco/idempotency-core` | `packages/idempotency-core/dist/index.js` | 29.1 KiB | 14.1 KiB | `@croco/idempotency-core:packages/idempotency-core/dist/index.js` | +15.0 KiB (+106.0%) | over-baseline | `pnpm --filter @croco/idempotency-core build && pnpm package-quality:report` |
| `@croco/idempotency-core` | `packages/idempotency-core/dist/index.mjs` | 27.8 KiB | 13.2 KiB | `@croco/idempotency-core:packages/idempotency-core/dist/index.mjs` | +14.5 KiB (+109.6%) | over-baseline | `pnpm --filter @croco/idempotency-core build && pnpm package-quality:report` |
| `@croco/impersonation-core` | `packages/impersonation-core/dist/index.d.ts` | 12.5 KiB | 4.3 KiB | `@croco/impersonation-core:packages/impersonation-core/dist/index.d.ts` | +8.2 KiB (+192.2%) | over-baseline | `pnpm --filter @croco/impersonation-core build && pnpm package-quality:report` |
| `@croco/impersonation-core` | `packages/impersonation-core/dist/index.js` | 19.5 KiB | 5.1 KiB | `@croco/impersonation-core:packages/impersonation-core/dist/index.js` | +14.3 KiB (+279.4%) | over-baseline | `pnpm --filter @croco/impersonation-core build && pnpm package-quality:report` |
| `@croco/impersonation-core` | `packages/impersonation-core/dist/index.mjs` | 18.0 KiB | 4.3 KiB | `@croco/impersonation-core:packages/impersonation-core/dist/index.mjs` | +13.7 KiB (+320.6%) | over-baseline | `pnpm --filter @croco/impersonation-core build && pnpm package-quality:report` |
| `@croco/integrations-posthog` | `packages/integrations-posthog/dist/index.d.ts` | 1.6 KiB | 600 B | `@croco/integrations-posthog:packages/integrations-posthog/dist/index.d.ts` | +1.0 KiB (+177.7%) | over-baseline | `pnpm --filter @croco/integrations-posthog build && pnpm package-quality:report` |
| `@croco/integrations-posthog` | `packages/integrations-posthog/dist/index.js` | 3.3 KiB | 1.5 KiB | `@croco/integrations-posthog:packages/integrations-posthog/dist/index.js` | +1.7 KiB (+113.0%) | over-baseline | `pnpm --filter @croco/integrations-posthog build && pnpm package-quality:report` |
| `@croco/integrations-posthog` | `packages/integrations-posthog/dist/index.mjs` | 2.8 KiB | 1.1 KiB | `@croco/integrations-posthog:packages/integrations-posthog/dist/index.mjs` | +1.6 KiB (+144.1%) | over-baseline | `pnpm --filter @croco/integrations-posthog build && pnpm package-quality:report` |
| `@croco/invitation-core` | `packages/invitation-core/dist/index.d.ts` | 21.2 KiB | 12.5 KiB | `@croco/invitation-core:packages/invitation-core/dist/index.d.ts` | +8.7 KiB (+69.2%) | over-baseline | `pnpm --filter @croco/invitation-core build && pnpm package-quality:report` |
| `@croco/invitation-core` | `packages/invitation-core/dist/index.js` | 34.6 KiB | 14.6 KiB | `@croco/invitation-core:packages/invitation-core/dist/index.js` | +20.0 KiB (+136.5%) | over-baseline | `pnpm --filter @croco/invitation-core build && pnpm package-quality:report` |
| `@croco/invitation-core` | `packages/invitation-core/dist/index.mjs` | 33.0 KiB | 13.5 KiB | `@croco/invitation-core:packages/invitation-core/dist/index.mjs` | +19.5 KiB (+145.1%) | over-baseline | `pnpm --filter @croco/invitation-core build && pnpm package-quality:report` |
| `@croco/invitation-drizzle` | `packages/invitation-drizzle/dist/index.d.ts` | 38.7 KiB | 14.6 KiB | `@croco/invitation-drizzle:packages/invitation-drizzle/dist/index.d.ts` | +24.1 KiB (+165.5%) | over-baseline | `pnpm --filter @croco/invitation-drizzle build && pnpm package-quality:report` |
| `@croco/invitation-drizzle` | `packages/invitation-drizzle/dist/index.js` | 26.6 KiB | 6.4 KiB | `@croco/invitation-drizzle:packages/invitation-drizzle/dist/index.js` | +20.2 KiB (+313.5%) | over-baseline | `pnpm --filter @croco/invitation-drizzle build && pnpm package-quality:report` |
| `@croco/invitation-drizzle` | `packages/invitation-drizzle/dist/index.mjs` | 24.4 KiB | 5.6 KiB | `@croco/invitation-drizzle:packages/invitation-drizzle/dist/index.mjs` | +18.8 KiB (+338.0%) | over-baseline | `pnpm --filter @croco/invitation-drizzle build && pnpm package-quality:report` |
| `@croco/lifecycle-core` | `packages/lifecycle-core/dist/index.d.ts` | 65.2 KiB | 11.6 KiB | `@croco/lifecycle-core:packages/lifecycle-core/dist/index.d.ts` | +53.6 KiB (+461.7%) | over-baseline | `pnpm --filter @croco/lifecycle-core build && pnpm package-quality:report` |
| `@croco/lifecycle-core` | `packages/lifecycle-core/dist/index.js` | 94.8 KiB | 11.0 KiB | `@croco/lifecycle-core:packages/lifecycle-core/dist/index.js` | +83.8 KiB (+760.7%) | over-baseline | `pnpm --filter @croco/lifecycle-core build && pnpm package-quality:report` |
| `@croco/lifecycle-core` | `packages/lifecycle-core/dist/index.mjs` | 91.6 KiB | 10.1 KiB | `@croco/lifecycle-core:packages/lifecycle-core/dist/index.mjs` | +81.6 KiB (+810.8%) | over-baseline | `pnpm --filter @croco/lifecycle-core build && pnpm package-quality:report` |
| `@croco/lifecycle-drizzle` | `packages/lifecycle-drizzle/dist/index.d.ts` | 1018 B | missing | - | - | missing-baseline | `pnpm --filter @croco/lifecycle-drizzle build && pnpm package-quality:report` |
| `@croco/lifecycle-drizzle` | `packages/lifecycle-drizzle/dist/index.js` | 4.1 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/lifecycle-drizzle build && pnpm package-quality:report` |
| `@croco/lifecycle-drizzle` | `packages/lifecycle-drizzle/dist/index.mjs` | 3.6 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/lifecycle-drizzle build && pnpm package-quality:report` |
| `@croco/membership-core` | `packages/membership-core/dist/index.d.ts` | 15.4 KiB | 8.3 KiB | `@croco/membership-core:packages/membership-core/dist/index.d.ts` | +7.0 KiB (+84.4%) | over-baseline | `pnpm --filter @croco/membership-core build && pnpm package-quality:report` |
| `@croco/membership-core` | `packages/membership-core/dist/index.js` | 20.5 KiB | 10.2 KiB | `@croco/membership-core:packages/membership-core/dist/index.js` | +10.2 KiB (+99.9%) | over-baseline | `pnpm --filter @croco/membership-core build && pnpm package-quality:report` |
| `@croco/membership-core` | `packages/membership-core/dist/index.mjs` | 19.0 KiB | 9.2 KiB | `@croco/membership-core:packages/membership-core/dist/index.mjs` | +9.8 KiB (+107.0%) | over-baseline | `pnpm --filter @croco/membership-core build && pnpm package-quality:report` |
| `@croco/membership-drizzle` | `packages/membership-drizzle/dist/index.d.ts` | 14.4 KiB | 5.7 KiB | `@croco/membership-drizzle:packages/membership-drizzle/dist/index.d.ts` | +8.7 KiB (+153.0%) | over-baseline | `pnpm --filter @croco/membership-drizzle build && pnpm package-quality:report` |
| `@croco/membership-drizzle` | `packages/membership-drizzle/dist/index.js` | 18.6 KiB | 3.1 KiB | `@croco/membership-drizzle:packages/membership-drizzle/dist/index.js` | +15.5 KiB (+507.0%) | over-baseline | `pnpm --filter @croco/membership-drizzle build && pnpm package-quality:report` |
| `@croco/membership-drizzle` | `packages/membership-drizzle/dist/index.mjs` | 17.2 KiB | 2.5 KiB | `@croco/membership-drizzle:packages/membership-drizzle/dist/index.mjs` | +14.7 KiB (+587.1%) | over-baseline | `pnpm --filter @croco/membership-drizzle build && pnpm package-quality:report` |
| `@croco/meta-vite` | `packages/meta-vite/dist/chunk-*.mjs` | 6.0 KiB | 452 B | `@croco/meta-vite:packages/meta-vite/dist/chunk-*.mjs` | +5.5 KiB (+1253.3%) | over-baseline | `pnpm --filter @croco/meta-vite build && pnpm package-quality:report` |
| `@croco/meta-vite` | `packages/meta-vite/dist/flightBrowser.entry-BMCPtbk-.d.ts` | 6.1 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/meta-vite build && pnpm package-quality:report` |
| `@croco/meta-vite` | `packages/meta-vite/dist/index.d.ts` | 36.7 KiB | 24.6 KiB | `@croco/meta-vite:packages/meta-vite/dist/index.d.ts` | +12.2 KiB (+49.7%) | over-baseline | `pnpm --filter @croco/meta-vite build && pnpm package-quality:report` |
| `@croco/meta-vite` | `packages/meta-vite/dist/index.js` | 75.7 KiB | 21.9 KiB | `@croco/meta-vite:packages/meta-vite/dist/index.js` | +53.8 KiB (+246.2%) | over-baseline | `pnpm --filter @croco/meta-vite build && pnpm package-quality:report` |
| `@croco/meta-vite` | `packages/meta-vite/dist/index.mjs` | 65.6 KiB | 19.6 KiB | `@croco/meta-vite:packages/meta-vite/dist/index.mjs` | +46.0 KiB (+234.6%) | over-baseline | `pnpm --filter @croco/meta-vite build && pnpm package-quality:report` |
| `@croco/meta-vite` | `packages/meta-vite/dist/libs/isr/adapters/index.d.ts` | 1.1 KiB | 1.1 KiB | `@croco/meta-vite:packages/meta-vite/dist/libs/isr/adapters/index.d.ts` | +0 B (+0.0%) | within-baseline | `pnpm --filter @croco/meta-vite build && pnpm package-quality:report` |
| `@croco/meta-vite` | `packages/meta-vite/dist/libs/isr/adapters/index.js` | 2.1 KiB | 1.8 KiB | `@croco/meta-vite:packages/meta-vite/dist/libs/isr/adapters/index.js` | +308 B (+16.8%) | over-baseline | `pnpm --filter @croco/meta-vite build && pnpm package-quality:report` |
| `@croco/meta-vite` | `packages/meta-vite/dist/libs/isr/adapters/index.mjs` | 1.4 KiB | 1.3 KiB | `@croco/meta-vite:packages/meta-vite/dist/libs/isr/adapters/index.mjs` | +140 B (+10.5%) | over-baseline | `pnpm --filter @croco/meta-vite build && pnpm package-quality:report` |
| `@croco/meta-vite` | `packages/meta-vite/dist/libs/rsc/flightBrowser.entry.d.ts` | 312 B | missing | - | - | missing-baseline | `pnpm --filter @croco/meta-vite build && pnpm package-quality:report` |
| `@croco/meta-vite` | `packages/meta-vite/dist/libs/rsc/flightBrowser.entry.js` | 2.2 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/meta-vite build && pnpm package-quality:report` |
| `@croco/meta-vite` | `packages/meta-vite/dist/libs/rsc/flightBrowser.entry.mjs` | 275 B | missing | - | - | missing-baseline | `pnpm --filter @croco/meta-vite build && pnpm package-quality:report` |
| `@croco/meta-vite` | `packages/meta-vite/dist/libs/rsc/flightEncode.entry.d.ts` | 506 B | missing | - | - | missing-baseline | `pnpm --filter @croco/meta-vite build && pnpm package-quality:report` |
| `@croco/meta-vite` | `packages/meta-vite/dist/libs/rsc/flightEncode.entry.js` | 4.0 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/meta-vite build && pnpm package-quality:report` |
| `@croco/meta-vite` | `packages/meta-vite/dist/libs/rsc/flightEncode.entry.mjs` | 2.9 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/meta-vite build && pnpm package-quality:report` |
| `@croco/meta-vite` | `packages/meta-vite/dist/ssrCodec-*.mjs` | 589 B | missing | - | - | missing-baseline | `pnpm --filter @croco/meta-vite build && pnpm package-quality:report` |
| `@croco/meta-vite` | `packages/meta-vite/dist/types-BYiUO5XA.d.ts` | 916 B | missing | - | - | missing-baseline | `pnpm --filter @croco/meta-vite build && pnpm package-quality:report` |
| `@croco/meta-vite` | `packages/meta-vite/dist/types-CXHJ1Fx4.d.ts` | 9.3 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/meta-vite build && pnpm package-quality:report` |
| `@croco/metering-core` | `packages/metering-core/dist/index.d.ts` | 41.2 KiB | 18.5 KiB | `@croco/metering-core:packages/metering-core/dist/index.d.ts` | +22.6 KiB (+121.9%) | over-baseline | `pnpm --filter @croco/metering-core build && pnpm package-quality:report` |
| `@croco/metering-core` | `packages/metering-core/dist/index.js` | 66.1 KiB | 19.2 KiB | `@croco/metering-core:packages/metering-core/dist/index.js` | +46.9 KiB (+244.6%) | over-baseline | `pnpm --filter @croco/metering-core build && pnpm package-quality:report` |
| `@croco/metering-core` | `packages/metering-core/dist/index.mjs` | 65.0 KiB | 18.4 KiB | `@croco/metering-core:packages/metering-core/dist/index.mjs` | +46.6 KiB (+252.8%) | over-baseline | `pnpm --filter @croco/metering-core build && pnpm package-quality:report` |
| `@croco/metering-drizzle` | `packages/metering-drizzle/dist/index.d.ts` | 35.1 KiB | 22.4 KiB | `@croco/metering-drizzle:packages/metering-drizzle/dist/index.d.ts` | +12.7 KiB (+56.7%) | over-baseline | `pnpm --filter @croco/metering-drizzle build && pnpm package-quality:report` |
| `@croco/metering-drizzle` | `packages/metering-drizzle/dist/index.js` | 16.7 KiB | 5.6 KiB | `@croco/metering-drizzle:packages/metering-drizzle/dist/index.js` | +11.1 KiB (+199.6%) | over-baseline | `pnpm --filter @croco/metering-drizzle build && pnpm package-quality:report` |
| `@croco/metering-drizzle` | `packages/metering-drizzle/dist/index.mjs` | 15.4 KiB | 4.8 KiB | `@croco/metering-drizzle:packages/metering-drizzle/dist/index.mjs` | +10.7 KiB (+224.3%) | over-baseline | `pnpm --filter @croco/metering-drizzle build && pnpm package-quality:report` |
| `@croco/metering-upstash` | `packages/metering-upstash/dist/index.d.ts` | 2.6 KiB | 2.1 KiB | `@croco/metering-upstash:packages/metering-upstash/dist/index.d.ts` | +537 B (+25.5%) | over-baseline | `pnpm --filter @croco/metering-upstash build && pnpm package-quality:report` |
| `@croco/metering-upstash` | `packages/metering-upstash/dist/index.js` | 5.2 KiB | 4.0 KiB | `@croco/metering-upstash:packages/metering-upstash/dist/index.js` | +1.3 KiB (+31.9%) | over-baseline | `pnpm --filter @croco/metering-upstash build && pnpm package-quality:report` |
| `@croco/metering-upstash` | `packages/metering-upstash/dist/index.mjs` | 4.6 KiB | 3.4 KiB | `@croco/metering-upstash:packages/metering-upstash/dist/index.mjs` | +1.2 KiB (+35.7%) | over-baseline | `pnpm --filter @croco/metering-upstash build && pnpm package-quality:report` |
| `@croco/metrics-billing` | `packages/metrics-billing/dist/index.d.ts` | 4.4 KiB | 2.4 KiB | `@croco/metrics-billing:packages/metrics-billing/dist/index.d.ts` | +2.0 KiB (+81.6%) | over-baseline | `pnpm --filter @croco/metrics-billing build && pnpm package-quality:report` |
| `@croco/metrics-billing` | `packages/metrics-billing/dist/index.js` | 10.4 KiB | 5.6 KiB | `@croco/metrics-billing:packages/metrics-billing/dist/index.js` | +4.8 KiB (+86.9%) | over-baseline | `pnpm --filter @croco/metrics-billing build && pnpm package-quality:report` |
| `@croco/metrics-billing` | `packages/metrics-billing/dist/index.mjs` | 9.6 KiB | 5.0 KiB | `@croco/metrics-billing:packages/metrics-billing/dist/index.mjs` | +4.5 KiB (+90.7%) | over-baseline | `pnpm --filter @croco/metrics-billing build && pnpm package-quality:report` |
| `@croco/metrics-core` | `packages/metrics-core/dist/BehaviorMetrics-CWiF6zJu.d.ts` | 17.7 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/metrics-core build && pnpm package-quality:report` |
| `@croco/metrics-core` | `packages/metrics-core/dist/chunk-*.mjs` | 37.3 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/metrics-core build && pnpm package-quality:report` |
| `@croco/metrics-core` | `packages/metrics-core/dist/index.d.ts` | 49.9 KiB | 29.7 KiB | `@croco/metrics-core:packages/metrics-core/dist/index.d.ts` | +20.3 KiB (+68.4%) | over-baseline | `pnpm --filter @croco/metrics-core build && pnpm package-quality:report` |
| `@croco/metrics-core` | `packages/metrics-core/dist/index.js` | 97.4 KiB | 13.6 KiB | `@croco/metrics-core:packages/metrics-core/dist/index.js` | +83.8 KiB (+615.0%) | over-baseline | `pnpm --filter @croco/metrics-core build && pnpm package-quality:report` |
| `@croco/metrics-core` | `packages/metrics-core/dist/index.mjs` | 59.5 KiB | 12.7 KiB | `@croco/metrics-core:packages/metrics-core/dist/index.mjs` | +46.8 KiB (+367.6%) | over-baseline | `pnpm --filter @croco/metrics-core build && pnpm package-quality:report` |
| `@croco/metrics-core` | `packages/metrics-core/dist/runtime.d.ts` | 16.4 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/metrics-core build && pnpm package-quality:report` |
| `@croco/metrics-core` | `packages/metrics-core/dist/runtime.js` | 76.3 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/metrics-core build && pnpm package-quality:report` |
| `@croco/metrics-core` | `packages/metrics-core/dist/runtime.mjs` | 38.1 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/metrics-core build && pnpm package-quality:report` |
| `@croco/migration-runner` | `packages/migration-runner/dist/chunk-*.mjs` | 14.1 KiB | 6.2 KiB | `@croco/migration-runner:packages/migration-runner/dist/chunk-*.mjs` | +7.9 KiB (+126.7%) | over-baseline | `pnpm --filter @croco/migration-runner build && pnpm package-quality:report` |
| `@croco/migration-runner` | `packages/migration-runner/dist/cli.d.ts` | 1.4 KiB | 681 B | `@croco/migration-runner:packages/migration-runner/dist/cli.d.ts` | +739 B (+108.5%) | over-baseline | `pnpm --filter @croco/migration-runner build && pnpm package-quality:report` |
| `@croco/migration-runner` | `packages/migration-runner/dist/cli.js` | 21.3 KiB | 10.8 KiB | `@croco/migration-runner:packages/migration-runner/dist/cli.js` | +10.5 KiB (+97.1%) | over-baseline | `pnpm --filter @croco/migration-runner build && pnpm package-quality:report` |
| `@croco/migration-runner` | `packages/migration-runner/dist/cli.mjs` | 7.2 KiB | 4.6 KiB | `@croco/migration-runner:packages/migration-runner/dist/cli.mjs` | +2.7 KiB (+59.2%) | over-baseline | `pnpm --filter @croco/migration-runner build && pnpm package-quality:report` |
| `@croco/migration-runner` | `packages/migration-runner/dist/db-types-CxupYU_m.d.ts` | 193 B | missing | - | - | missing-baseline | `pnpm --filter @croco/migration-runner build && pnpm package-quality:report` |
| `@croco/migration-runner` | `packages/migration-runner/dist/index.d.ts` | 5.6 KiB | 3.8 KiB | `@croco/migration-runner:packages/migration-runner/dist/index.d.ts` | +1.8 KiB (+47.9%) | over-baseline | `pnpm --filter @croco/migration-runner build && pnpm package-quality:report` |
| `@croco/migration-runner` | `packages/migration-runner/dist/index.js` | 14.7 KiB | 6.8 KiB | `@croco/migration-runner:packages/migration-runner/dist/index.js` | +8.0 KiB (+117.4%) | over-baseline | `pnpm --filter @croco/migration-runner build && pnpm package-quality:report` |
| `@croco/migration-runner` | `packages/migration-runner/dist/index.mjs` | 535 B | 415 B | `@croco/migration-runner:packages/migration-runner/dist/index.mjs` | +120 B (+28.9%) | over-baseline | `pnpm --filter @croco/migration-runner build && pnpm package-quality:report` |
| `@croco/notifications-core` | `packages/notifications-core/dist/index.d.ts` | 18.1 KiB | 14.4 KiB | `@croco/notifications-core:packages/notifications-core/dist/index.d.ts` | +3.7 KiB (+25.6%) | over-baseline | `pnpm --filter @croco/notifications-core build && pnpm package-quality:report` |
| `@croco/notifications-core` | `packages/notifications-core/dist/index.js` | 25.7 KiB | 16.4 KiB | `@croco/notifications-core:packages/notifications-core/dist/index.js` | +9.3 KiB (+56.5%) | over-baseline | `pnpm --filter @croco/notifications-core build && pnpm package-quality:report` |
| `@croco/notifications-core` | `packages/notifications-core/dist/index.mjs` | 23.5 KiB | 14.6 KiB | `@croco/notifications-core:packages/notifications-core/dist/index.mjs` | +8.9 KiB (+60.8%) | over-baseline | `pnpm --filter @croco/notifications-core build && pnpm package-quality:report` |
| `@croco/notifications-fcm` | `packages/notifications-fcm/dist/index.d.ts` | 2.5 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/notifications-fcm build && pnpm package-quality:report` |
| `@croco/notifications-fcm` | `packages/notifications-fcm/dist/index.js` | 9.2 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/notifications-fcm build && pnpm package-quality:report` |
| `@croco/notifications-fcm` | `packages/notifications-fcm/dist/index.mjs` | 8.6 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/notifications-fcm build && pnpm package-quality:report` |
| `@croco/notifications-react-email` | `packages/notifications-react-email/dist/index.d.ts` | 810 B | missing | - | - | missing-baseline | `pnpm --filter @croco/notifications-react-email build && pnpm package-quality:report` |
| `@croco/notifications-react-email` | `packages/notifications-react-email/dist/index.js` | 1.6 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/notifications-react-email build && pnpm package-quality:report` |
| `@croco/notifications-react-email` | `packages/notifications-react-email/dist/index.mjs` | 1.1 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/notifications-react-email build && pnpm package-quality:report` |
| `@croco/notifications-resend` | `packages/notifications-resend/dist/index.d.ts` | 3.3 KiB | 3.2 KiB | `@croco/notifications-resend:packages/notifications-resend/dist/index.d.ts` | +97 B (+3.0%) | over-baseline | `pnpm --filter @croco/notifications-resend build && pnpm package-quality:report` |
| `@croco/notifications-resend` | `packages/notifications-resend/dist/index.js` | 16.6 KiB | 11.6 KiB | `@croco/notifications-resend:packages/notifications-resend/dist/index.js` | +5.0 KiB (+42.8%) | over-baseline | `pnpm --filter @croco/notifications-resend build && pnpm package-quality:report` |
| `@croco/notifications-resend` | `packages/notifications-resend/dist/index.mjs` | 15.9 KiB | 10.9 KiB | `@croco/notifications-resend:packages/notifications-resend/dist/index.mjs` | +4.9 KiB (+45.3%) | over-baseline | `pnpm --filter @croco/notifications-resend build && pnpm package-quality:report` |
| `@croco/onboarding-core` | `packages/onboarding-core/dist/chunk-*.mjs` | 4.3 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/onboarding-core build && pnpm package-quality:report` |
| `@croco/onboarding-core` | `packages/onboarding-core/dist/goal-validation-Do-OrHxp.d.ts` | 5.0 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/onboarding-core build && pnpm package-quality:report` |
| `@croco/onboarding-core` | `packages/onboarding-core/dist/goal-validation.d.ts` | 164 B | missing | - | - | missing-baseline | `pnpm --filter @croco/onboarding-core build && pnpm package-quality:report` |
| `@croco/onboarding-core` | `packages/onboarding-core/dist/goal-validation.js` | 3.1 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/onboarding-core build && pnpm package-quality:report` |
| `@croco/onboarding-core` | `packages/onboarding-core/dist/goal-validation.mjs` | 119 B | missing | - | - | missing-baseline | `pnpm --filter @croco/onboarding-core build && pnpm package-quality:report` |
| `@croco/onboarding-core` | `packages/onboarding-core/dist/index.d.ts` | 11.0 KiB | 3.7 KiB | `@croco/onboarding-core:packages/onboarding-core/dist/index.d.ts` | +7.2 KiB (+193.4%) | over-baseline | `pnpm --filter @croco/onboarding-core build && pnpm package-quality:report` |
| `@croco/onboarding-core` | `packages/onboarding-core/dist/index.js` | 26.5 KiB | 3.6 KiB | `@croco/onboarding-core:packages/onboarding-core/dist/index.js` | +22.9 KiB (+637.2%) | over-baseline | `pnpm --filter @croco/onboarding-core build && pnpm package-quality:report` |
| `@croco/onboarding-core` | `packages/onboarding-core/dist/index.mjs` | 20.9 KiB | 3.0 KiB | `@croco/onboarding-core:packages/onboarding-core/dist/index.mjs` | +17.9 KiB (+586.8%) | over-baseline | `pnpm --filter @croco/onboarding-core build && pnpm package-quality:report` |
| `@croco/onboarding-drizzle` | `packages/onboarding-drizzle/dist/index.d.ts` | 44.2 KiB | 6.6 KiB | `@croco/onboarding-drizzle:packages/onboarding-drizzle/dist/index.d.ts` | +37.6 KiB (+570.6%) | over-baseline | `pnpm --filter @croco/onboarding-drizzle build && pnpm package-quality:report` |
| `@croco/onboarding-drizzle` | `packages/onboarding-drizzle/dist/index.js` | 28.3 KiB | 2.3 KiB | `@croco/onboarding-drizzle:packages/onboarding-drizzle/dist/index.js` | +26.0 KiB (+1153.7%) | over-baseline | `pnpm --filter @croco/onboarding-drizzle build && pnpm package-quality:report` |
| `@croco/onboarding-drizzle` | `packages/onboarding-drizzle/dist/index.mjs` | 26.3 KiB | 1.8 KiB | `@croco/onboarding-drizzle:packages/onboarding-drizzle/dist/index.mjs` | +24.6 KiB (+1395.0%) | over-baseline | `pnpm --filter @croco/onboarding-drizzle build && pnpm package-quality:report` |
| `@croco/openapi-spec` | `packages/openapi-spec/dist/chunk-*.mjs` | 11.6 KiB | 8.4 KiB | `@croco/openapi-spec:packages/openapi-spec/dist/chunk-*.mjs` | +3.2 KiB (+37.8%) | over-baseline | `pnpm --filter @croco/openapi-spec build && pnpm package-quality:report` |
| `@croco/openapi-spec` | `packages/openapi-spec/dist/cli.d.ts` | 20 B | 20 B | `@croco/openapi-spec:packages/openapi-spec/dist/cli.d.ts` | +0 B (+0.0%) | within-baseline | `pnpm --filter @croco/openapi-spec build && pnpm package-quality:report` |
| `@croco/openapi-spec` | `packages/openapi-spec/dist/cli.js` | 19.3 KiB | 18.0 KiB | `@croco/openapi-spec:packages/openapi-spec/dist/cli.js` | +1.3 KiB (+7.1%) | over-baseline | `pnpm --filter @croco/openapi-spec build && pnpm package-quality:report` |
| `@croco/openapi-spec` | `packages/openapi-spec/dist/cli.mjs` | 6.7 KiB | 4.5 KiB | `@croco/openapi-spec:packages/openapi-spec/dist/cli.mjs` | +2.3 KiB (+51.0%) | over-baseline | `pnpm --filter @croco/openapi-spec build && pnpm package-quality:report` |
| `@croco/openapi-spec` | `packages/openapi-spec/dist/emitOpenAPI-*.mjs` | 133 B | 133 B | `@croco/openapi-spec:packages/openapi-spec/dist/emitOpenAPI-*.mjs` | +0 B (+0.0%) | within-baseline | `pnpm --filter @croco/openapi-spec build && pnpm package-quality:report` |
| `@croco/openapi-spec` | `packages/openapi-spec/dist/index.d.ts` | 1.9 KiB | 1.6 KiB | `@croco/openapi-spec:packages/openapi-spec/dist/index.d.ts` | +267 B (+15.8%) | over-baseline | `pnpm --filter @croco/openapi-spec build && pnpm package-quality:report` |
| `@croco/openapi-spec` | `packages/openapi-spec/dist/index.js` | 11.8 KiB | 8.7 KiB | `@croco/openapi-spec:packages/openapi-spec/dist/index.js` | +3.1 KiB (+35.7%) | over-baseline | `pnpm --filter @croco/openapi-spec build && pnpm package-quality:report` |
| `@croco/openapi-spec` | `packages/openapi-spec/dist/index.mjs` | 221 B | 148 B | `@croco/openapi-spec:packages/openapi-spec/dist/index.mjs` | +73 B (+49.3%) | over-baseline | `pnpm --filter @croco/openapi-spec build && pnpm package-quality:report` |
| `@croco/openapi-spec` | `packages/openapi-spec/dist/loadControllers-*.mjs` | 101 B | 4.7 KiB | `@croco/openapi-spec:packages/openapi-spec/dist/loadControllers-*.mjs` | -4.6 KiB (-97.9%) | within-baseline | `pnpm --filter @croco/openapi-spec build && pnpm package-quality:report` |
| `@croco/openapi-spec` | `packages/openapi-spec/dist/output-*.mjs` | 576 B | missing | - | - | missing-baseline | `pnpm --filter @croco/openapi-spec build && pnpm package-quality:report` |
| `@croco/outbox-core` | `packages/outbox-core/dist/index.d.ts` | 10.2 KiB | 9.5 KiB | `@croco/outbox-core:packages/outbox-core/dist/index.d.ts` | +782 B (+8.1%) | over-baseline | `pnpm --filter @croco/outbox-core build && pnpm package-quality:report` |
| `@croco/outbox-core` | `packages/outbox-core/dist/index.js` | 28.1 KiB | 22.8 KiB | `@croco/outbox-core:packages/outbox-core/dist/index.js` | +5.3 KiB (+23.3%) | over-baseline | `pnpm --filter @croco/outbox-core build && pnpm package-quality:report` |
| `@croco/outbox-core` | `packages/outbox-core/dist/index.mjs` | 27.1 KiB | 21.9 KiB | `@croco/outbox-core:packages/outbox-core/dist/index.mjs` | +5.2 KiB (+23.6%) | over-baseline | `pnpm --filter @croco/outbox-core build && pnpm package-quality:report` |
| `@croco/pagination-core` | `packages/pagination-core/dist/index.d.ts` | 7.5 KiB | 5.0 KiB | `@croco/pagination-core:packages/pagination-core/dist/index.d.ts` | +2.5 KiB (+49.9%) | over-baseline | `pnpm --filter @croco/pagination-core build && pnpm package-quality:report` |
| `@croco/pagination-core` | `packages/pagination-core/dist/index.js` | 9.3 KiB | 4.0 KiB | `@croco/pagination-core:packages/pagination-core/dist/index.js` | +5.3 KiB (+132.8%) | over-baseline | `pnpm --filter @croco/pagination-core build && pnpm package-quality:report` |
| `@croco/pagination-core` | `packages/pagination-core/dist/index.mjs` | 8.3 KiB | 3.3 KiB | `@croco/pagination-core:packages/pagination-core/dist/index.mjs` | +5.1 KiB (+155.2%) | over-baseline | `pnpm --filter @croco/pagination-core build && pnpm package-quality:report` |
| `@croco/presentation-preset` | `packages/presentation-preset/dist/index.d.ts` | 10.4 KiB | 8.9 KiB | `@croco/presentation-preset:packages/presentation-preset/dist/index.d.ts` | +1.5 KiB (+16.5%) | over-baseline | `pnpm --filter @croco/presentation-preset build && pnpm package-quality:report` |
| `@croco/presentation-preset` | `packages/presentation-preset/dist/index.js` | 33.1 KiB | 17.9 KiB | `@croco/presentation-preset:packages/presentation-preset/dist/index.js` | +15.2 KiB (+84.8%) | over-baseline | `pnpm --filter @croco/presentation-preset build && pnpm package-quality:report` |
| `@croco/presentation-preset` | `packages/presentation-preset/dist/index.mjs` | 31.0 KiB | 16.0 KiB | `@croco/presentation-preset:packages/presentation-preset/dist/index.mjs` | +15.0 KiB (+94.2%) | over-baseline | `pnpm --filter @croco/presentation-preset build && pnpm package-quality:report` |
| `@croco/presentation-preset` | `packages/presentation-preset/dist/runtime-profiles.json` | 6.5 KiB | 5.1 KiB | `@croco/presentation-preset:packages/presentation-preset/dist/runtime-profiles.json` | +1.4 KiB (+27.0%) | over-baseline | `pnpm --filter @croco/presentation-preset build && pnpm package-quality:report` |
| `@croco/preset-cloudflare` | `packages/preset-cloudflare/dist/chunk-*.mjs` | 1.4 KiB | 538 B | `@croco/preset-cloudflare:packages/preset-cloudflare/dist/chunk-*.mjs` | +921 B (+171.2%) | over-baseline | `pnpm --filter @croco/preset-cloudflare build && pnpm package-quality:report` |
| `@croco/preset-cloudflare` | `packages/preset-cloudflare/dist/fetch.d.ts` | 4.2 KiB | 2.0 KiB | `@croco/preset-cloudflare:packages/preset-cloudflare/dist/fetch.d.ts` | +2.2 KiB (+114.1%) | over-baseline | `pnpm --filter @croco/preset-cloudflare build && pnpm package-quality:report` |
| `@croco/preset-cloudflare` | `packages/preset-cloudflare/dist/fetch.mjs` | 164 B | 114 B | `@croco/preset-cloudflare:packages/preset-cloudflare/dist/fetch.mjs` | +50 B (+43.9%) | over-baseline | `pnpm --filter @croco/preset-cloudflare build && pnpm package-quality:report` |
| `@croco/preset-cloudflare` | `packages/preset-cloudflare/dist/index.d.ts` | 1.0 KiB | 524 B | `@croco/preset-cloudflare:packages/preset-cloudflare/dist/index.d.ts` | +537 B (+102.5%) | over-baseline | `pnpm --filter @croco/preset-cloudflare build && pnpm package-quality:report` |
| `@croco/preset-cloudflare` | `packages/preset-cloudflare/dist/index.mjs` | 646 B | 494 B | `@croco/preset-cloudflare:packages/preset-cloudflare/dist/index.mjs` | +152 B (+30.8%) | over-baseline | `pnpm --filter @croco/preset-cloudflare build && pnpm package-quality:report` |
| `@croco/preset-lambda` | `packages/preset-lambda/dist/chunk-*.mjs` | 1.6 KiB | 1.3 KiB | `@croco/preset-lambda:packages/preset-lambda/dist/chunk-*.mjs` | +302 B (+23.2%) | over-baseline | `pnpm --filter @croco/preset-lambda build && pnpm package-quality:report` |
| `@croco/preset-lambda` | `packages/preset-lambda/dist/handler.d.ts` | 822 B | 350 B | `@croco/preset-lambda:packages/preset-lambda/dist/handler.d.ts` | +472 B (+134.9%) | over-baseline | `pnpm --filter @croco/preset-lambda build && pnpm package-quality:report` |
| `@croco/preset-lambda` | `packages/preset-lambda/dist/handler.js` | 1.8 KiB | 1.5 KiB | `@croco/preset-lambda:packages/preset-lambda/dist/handler.js` | +334 B (+21.9%) | over-baseline | `pnpm --filter @croco/preset-lambda build && pnpm package-quality:report` |
| `@croco/preset-lambda` | `packages/preset-lambda/dist/handler.mjs` | 136 B | 96 B | `@croco/preset-lambda:packages/preset-lambda/dist/handler.mjs` | +40 B (+41.7%) | over-baseline | `pnpm --filter @croco/preset-lambda build && pnpm package-quality:report` |
| `@croco/preset-lambda` | `packages/preset-lambda/dist/index.d.ts` | 655 B | 381 B | `@croco/preset-lambda:packages/preset-lambda/dist/index.d.ts` | +274 B (+71.9%) | over-baseline | `pnpm --filter @croco/preset-lambda build && pnpm package-quality:report` |
| `@croco/preset-lambda` | `packages/preset-lambda/dist/index.js` | 4.1 KiB | 3.4 KiB | `@croco/preset-lambda:packages/preset-lambda/dist/index.js` | +720 B (+20.8%) | over-baseline | `pnpm --filter @croco/preset-lambda build && pnpm package-quality:report` |
| `@croco/preset-lambda` | `packages/preset-lambda/dist/index.mjs` | 1.6 KiB | 1.2 KiB | `@croco/preset-lambda:packages/preset-lambda/dist/index.mjs` | +378 B (+30.3%) | over-baseline | `pnpm --filter @croco/preset-lambda build && pnpm package-quality:report` |
| `@croco/preset-node` | `packages/preset-node/dist/chunk-*.mjs` | 10.7 KiB | 2.2 KiB | `@croco/preset-node:packages/preset-node/dist/chunk-*.mjs` | +8.4 KiB (+379.3%) | over-baseline | `pnpm --filter @croco/preset-node build && pnpm package-quality:report` |
| `@croco/preset-node` | `packages/preset-node/dist/entry.d.ts` | 791 B | 485 B | `@croco/preset-node:packages/preset-node/dist/entry.d.ts` | +306 B (+63.1%) | over-baseline | `pnpm --filter @croco/preset-node build && pnpm package-quality:report` |
| `@croco/preset-node` | `packages/preset-node/dist/entry.js` | 11.6 KiB | 2.4 KiB | `@croco/preset-node:packages/preset-node/dist/entry.js` | +9.3 KiB (+387.1%) | over-baseline | `pnpm --filter @croco/preset-node build && pnpm package-quality:report` |
| `@croco/preset-node` | `packages/preset-node/dist/entry.mjs` | 124 B | 88 B | `@croco/preset-node:packages/preset-node/dist/entry.mjs` | +36 B (+40.9%) | over-baseline | `pnpm --filter @croco/preset-node build && pnpm package-quality:report` |
| `@croco/preset-node` | `packages/preset-node/dist/index.d.ts` | 1.2 KiB | 332 B | `@croco/preset-node:packages/preset-node/dist/index.d.ts` | +926 B (+278.9%) | over-baseline | `pnpm --filter @croco/preset-node build && pnpm package-quality:report` |
| `@croco/preset-node` | `packages/preset-node/dist/index.js` | 13.4 KiB | 4.3 KiB | `@croco/preset-node:packages/preset-node/dist/index.js` | +9.1 KiB (+212.9%) | over-baseline | `pnpm --filter @croco/preset-node build && pnpm package-quality:report` |
| `@croco/preset-node` | `packages/preset-node/dist/index.mjs` | 1.8 KiB | 1.2 KiB | `@croco/preset-node:packages/preset-node/dist/index.mjs` | +546 B (+43.8%) | over-baseline | `pnpm --filter @croco/preset-node build && pnpm package-quality:report` |
| `@croco/problems-core` | `packages/problems-core/dist/index.d.ts` | 1.59 MiB | 564.2 KiB | `@croco/problems-core:packages/problems-core/dist/index.d.ts` | +1.04 MiB (+188.1%) | over-baseline | `pnpm --filter @croco/problems-core build && pnpm package-quality:report` |
| `@croco/problems-core` | `packages/problems-core/dist/index.js` | 876.3 KiB | 336.6 KiB | `@croco/problems-core:packages/problems-core/dist/index.js` | +539.7 KiB (+160.3%) | over-baseline | `pnpm --filter @croco/problems-core build && pnpm package-quality:report` |
| `@croco/problems-core` | `packages/problems-core/dist/index.mjs` | 875.3 KiB | 335.9 KiB | `@croco/problems-core:packages/problems-core/dist/index.mjs` | +539.3 KiB (+160.6%) | over-baseline | `pnpm --filter @croco/problems-core build && pnpm package-quality:report` |
| `@croco/promotions-core` | `packages/promotions-core/dist/credit-grant-CLnwmJP8.d.ts` | 11.3 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/promotions-core build && pnpm package-quality:report` |
| `@croco/promotions-core` | `packages/promotions-core/dist/credit-grant.d.ts` | 143 B | missing | - | - | missing-baseline | `pnpm --filter @croco/promotions-core build && pnpm package-quality:report` |
| `@croco/promotions-core` | `packages/promotions-core/dist/credit-grant.js` | 3.4 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/promotions-core build && pnpm package-quality:report` |
| `@croco/promotions-core` | `packages/promotions-core/dist/credit-grant.mjs` | 2.9 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/promotions-core build && pnpm package-quality:report` |
| `@croco/promotions-core` | `packages/promotions-core/dist/index.d.ts` | 18.1 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/promotions-core build && pnpm package-quality:report` |
| `@croco/promotions-core` | `packages/promotions-core/dist/index.js` | 31.1 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/promotions-core build && pnpm package-quality:report` |
| `@croco/promotions-core` | `packages/promotions-core/dist/index.mjs` | 29.6 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/promotions-core build && pnpm package-quality:report` |
| `@croco/promotions-drizzle` | `packages/promotions-drizzle/dist/index.d.ts` | 1.6 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/promotions-drizzle build && pnpm package-quality:report` |
| `@croco/promotions-drizzle` | `packages/promotions-drizzle/dist/index.js` | 12.3 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/promotions-drizzle build && pnpm package-quality:report` |
| `@croco/promotions-drizzle` | `packages/promotions-drizzle/dist/index.mjs` | 11.6 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/promotions-drizzle build && pnpm package-quality:report` |
| `@croco/protocol-codegen` | `packages/protocol-codegen/dist/index.d.ts` | 3.5 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/protocol-codegen build && pnpm package-quality:report` |
| `@croco/protocol-codegen` | `packages/protocol-codegen/dist/index.js` | 21.0 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/protocol-codegen build && pnpm package-quality:report` |
| `@croco/protocol-codegen` | `packages/protocol-codegen/dist/index.mjs` | 20.0 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/protocol-codegen build && pnpm package-quality:report` |
| `@croco/protocols-core` | `packages/protocols-core/dist/index.d.ts` | 40.8 KiB | 30.3 KiB | `@croco/protocols-core:packages/protocols-core/dist/index.d.ts` | +10.5 KiB (+34.6%) | over-baseline | `pnpm --filter @croco/protocols-core build && pnpm package-quality:report` |
| `@croco/protocols-core` | `packages/protocols-core/dist/index.js` | 103.6 KiB | 57.5 KiB | `@croco/protocols-core:packages/protocols-core/dist/index.js` | +46.1 KiB (+80.1%) | over-baseline | `pnpm --filter @croco/protocols-core build && pnpm package-quality:report` |
| `@croco/protocols-core` | `packages/protocols-core/dist/index.mjs` | 101.4 KiB | 55.8 KiB | `@croco/protocols-core:packages/protocols-core/dist/index.mjs` | +45.6 KiB (+81.8%) | over-baseline | `pnpm --filter @croco/protocols-core build && pnpm package-quality:report` |
| `@croco/protocols-graphql` | `packages/protocols-graphql/dist/index.cjs` | 20.7 KiB | 16.0 KiB | `@croco/protocols-graphql:packages/protocols-graphql/dist/index.cjs` | +4.7 KiB (+29.3%) | over-baseline | `pnpm --filter @croco/protocols-graphql build && pnpm package-quality:report` |
| `@croco/protocols-graphql` | `packages/protocols-graphql/dist/index.d.ts` | 12.4 KiB | 11.4 KiB | `@croco/protocols-graphql:packages/protocols-graphql/dist/index.d.ts` | +1.0 KiB (+9.1%) | over-baseline | `pnpm --filter @croco/protocols-graphql build && pnpm package-quality:report` |
| `@croco/protocols-graphql` | `packages/protocols-graphql/dist/index.js` | 19.3 KiB | 14.7 KiB | `@croco/protocols-graphql:packages/protocols-graphql/dist/index.js` | +4.5 KiB (+30.8%) | over-baseline | `pnpm --filter @croco/protocols-graphql build && pnpm package-quality:report` |
| `@croco/protocols-rest` | `packages/protocols-rest/dist/index.d.ts` | 35.2 KiB | 29.4 KiB | `@croco/protocols-rest:packages/protocols-rest/dist/index.d.ts` | +5.8 KiB (+19.7%) | over-baseline | `pnpm --filter @croco/protocols-rest build && pnpm package-quality:report` |
| `@croco/protocols-rest` | `packages/protocols-rest/dist/index.js` | 22.2 KiB | 15.6 KiB | `@croco/protocols-rest:packages/protocols-rest/dist/index.js` | +6.6 KiB (+42.3%) | over-baseline | `pnpm --filter @croco/protocols-rest build && pnpm package-quality:report` |
| `@croco/protocols-rest` | `packages/protocols-rest/dist/index.mjs` | 20.4 KiB | 14.0 KiB | `@croco/protocols-rest:packages/protocols-rest/dist/index.mjs` | +6.4 KiB (+45.6%) | over-baseline | `pnpm --filter @croco/protocols-rest build && pnpm package-quality:report` |
| `@croco/protocols-trpc` | `packages/protocols-trpc/dist/index.cjs` | 18.5 KiB | 1.6 KiB | `@croco/protocols-trpc:packages/protocols-trpc/dist/index.cjs` | +16.9 KiB (+1039.4%) | over-baseline | `pnpm --filter @croco/protocols-trpc build && pnpm package-quality:report` |
| `@croco/protocols-trpc` | `packages/protocols-trpc/dist/index.d.ts` | 2.2 KiB | 584 B | `@croco/protocols-trpc:packages/protocols-trpc/dist/index.d.ts` | +1.7 KiB (+292.1%) | over-baseline | `pnpm --filter @croco/protocols-trpc build && pnpm package-quality:report` |
| `@croco/protocols-trpc` | `packages/protocols-trpc/dist/index.js` | 17.8 KiB | 1.1 KiB | `@croco/protocols-trpc:packages/protocols-trpc/dist/index.js` | +16.7 KiB (+1464.8%) | over-baseline | `pnpm --filter @croco/protocols-trpc build && pnpm package-quality:report` |
| `@croco/ratelimit-core` | `packages/ratelimit-core/dist/index.d.ts` | 16.2 KiB | 13.9 KiB | `@croco/ratelimit-core:packages/ratelimit-core/dist/index.d.ts` | +2.3 KiB (+16.5%) | over-baseline | `pnpm --filter @croco/ratelimit-core build && pnpm package-quality:report` |
| `@croco/ratelimit-core` | `packages/ratelimit-core/dist/index.js` | 24.4 KiB | 17.5 KiB | `@croco/ratelimit-core:packages/ratelimit-core/dist/index.js` | +6.9 KiB (+39.1%) | over-baseline | `pnpm --filter @croco/ratelimit-core build && pnpm package-quality:report` |
| `@croco/ratelimit-core` | `packages/ratelimit-core/dist/index.mjs` | 23.2 KiB | 16.5 KiB | `@croco/ratelimit-core:packages/ratelimit-core/dist/index.mjs` | +6.7 KiB (+40.3%) | over-baseline | `pnpm --filter @croco/ratelimit-core build && pnpm package-quality:report` |
| `@croco/ratelimit-upstash` | `packages/ratelimit-upstash/dist/index.d.ts` | 4.5 KiB | 4.3 KiB | `@croco/ratelimit-upstash:packages/ratelimit-upstash/dist/index.d.ts` | +205 B (+4.7%) | over-baseline | `pnpm --filter @croco/ratelimit-upstash build && pnpm package-quality:report` |
| `@croco/ratelimit-upstash` | `packages/ratelimit-upstash/dist/index.js` | 17.6 KiB | 15.7 KiB | `@croco/ratelimit-upstash:packages/ratelimit-upstash/dist/index.js` | +1.9 KiB (+11.8%) | over-baseline | `pnpm --filter @croco/ratelimit-upstash build && pnpm package-quality:report` |
| `@croco/ratelimit-upstash` | `packages/ratelimit-upstash/dist/index.mjs` | 16.9 KiB | 15.0 KiB | `@croco/ratelimit-upstash:packages/ratelimit-upstash/dist/index.mjs` | +1.9 KiB (+12.4%) | over-baseline | `pnpm --filter @croco/ratelimit-upstash build && pnpm package-quality:report` |
| `@croco/referral-core` | `packages/referral-core/dist/credit-grant.d.ts` | 3.9 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/referral-core build && pnpm package-quality:report` |
| `@croco/referral-core` | `packages/referral-core/dist/credit-grant.js` | 5.3 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/referral-core build && pnpm package-quality:report` |
| `@croco/referral-core` | `packages/referral-core/dist/credit-grant.mjs` | 4.8 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/referral-core build && pnpm package-quality:report` |
| `@croco/referral-core` | `packages/referral-core/dist/index.d.ts` | 25.3 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/referral-core build && pnpm package-quality:report` |
| `@croco/referral-core` | `packages/referral-core/dist/index.js` | 41.1 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/referral-core build && pnpm package-quality:report` |
| `@croco/referral-core` | `packages/referral-core/dist/index.mjs` | 39.4 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/referral-core build && pnpm package-quality:report` |
| `@croco/referral-core` | `packages/referral-core/dist/link-token.d.ts` | 319 B | missing | - | - | missing-baseline | `pnpm --filter @croco/referral-core build && pnpm package-quality:report` |
| `@croco/referral-core` | `packages/referral-core/dist/link-token.js` | 833 B | missing | - | - | missing-baseline | `pnpm --filter @croco/referral-core build && pnpm package-quality:report` |
| `@croco/referral-core` | `packages/referral-core/dist/link-token.mjs` | 344 B | missing | - | - | missing-baseline | `pnpm --filter @croco/referral-core build && pnpm package-quality:report` |
| `@croco/referral-core` | `packages/referral-core/dist/types-2VX6NpQ3.d.ts` | 11.6 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/referral-core build && pnpm package-quality:report` |
| `@croco/referral-drizzle` | `packages/referral-drizzle/dist/index.d.ts` | 2.0 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/referral-drizzle build && pnpm package-quality:report` |
| `@croco/referral-drizzle` | `packages/referral-drizzle/dist/index.js` | 22.2 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/referral-drizzle build && pnpm package-quality:report` |
| `@croco/referral-drizzle` | `packages/referral-drizzle/dist/index.mjs` | 21.2 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/referral-drizzle build && pnpm package-quality:report` |
| `@croco/repository-core` | `packages/repository-core/dist/index.d.ts` | 11.0 KiB | 6.1 KiB | `@croco/repository-core:packages/repository-core/dist/index.d.ts` | +4.9 KiB (+79.9%) | over-baseline | `pnpm --filter @croco/repository-core build && pnpm package-quality:report` |
| `@croco/repository-core` | `packages/repository-core/dist/index.js` | 5.7 KiB | 2.1 KiB | `@croco/repository-core:packages/repository-core/dist/index.js` | +3.7 KiB (+179.6%) | over-baseline | `pnpm --filter @croco/repository-core build && pnpm package-quality:report` |
| `@croco/repository-core` | `packages/repository-core/dist/index.mjs` | 4.9 KiB | 1.5 KiB | `@croco/repository-core:packages/repository-core/dist/index.mjs` | +3.4 KiB (+233.8%) | over-baseline | `pnpm --filter @croco/repository-core build && pnpm package-quality:report` |
| `@croco/research-core` | `packages/research-core/dist/index.d.ts` | 16.7 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/research-core build && pnpm package-quality:report` |
| `@croco/research-core` | `packages/research-core/dist/index.js` | 32.1 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/research-core build && pnpm package-quality:report` |
| `@croco/research-core` | `packages/research-core/dist/index.mjs` | 31.1 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/research-core build && pnpm package-quality:report` |
| `@croco/research-drizzle` | `packages/research-drizzle/dist/index.d.ts` | 3.2 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/research-drizzle build && pnpm package-quality:report` |
| `@croco/research-drizzle` | `packages/research-drizzle/dist/index.js` | 6.9 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/research-drizzle build && pnpm package-quality:report` |
| `@croco/research-drizzle` | `packages/research-drizzle/dist/index.mjs` | 6.1 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/research-drizzle build && pnpm package-quality:report` |
| `@croco/retry-core` | `packages/retry-core/dist/index.d.ts` | 35.8 KiB | 31.2 KiB | `@croco/retry-core:packages/retry-core/dist/index.d.ts` | +4.7 KiB (+15.0%) | over-baseline | `pnpm --filter @croco/retry-core build && pnpm package-quality:report` |
| `@croco/retry-core` | `packages/retry-core/dist/index.js` | 40.6 KiB | 29.2 KiB | `@croco/retry-core:packages/retry-core/dist/index.js` | +11.4 KiB (+39.0%) | over-baseline | `pnpm --filter @croco/retry-core build && pnpm package-quality:report` |
| `@croco/retry-core` | `packages/retry-core/dist/index.mjs` | 39.2 KiB | 28.0 KiB | `@croco/retry-core:packages/retry-core/dist/index.mjs` | +11.2 KiB (+40.1%) | over-baseline | `pnpm --filter @croco/retry-core build && pnpm package-quality:report` |
| `@croco/rpc-codegen` | `packages/rpc-codegen/dist/chunk-*.js` | 99.7 KiB | 68.8 KiB | `@croco/rpc-codegen:packages/rpc-codegen/dist/chunk-*.js` | +31.0 KiB (+45.0%) | over-baseline | `pnpm --filter @croco/rpc-codegen build && pnpm package-quality:report` |
| `@croco/rpc-codegen` | `packages/rpc-codegen/dist/cli.cjs` | 108.7 KiB | 74.9 KiB | `@croco/rpc-codegen:packages/rpc-codegen/dist/cli.cjs` | +33.7 KiB (+45.0%) | over-baseline | `pnpm --filter @croco/rpc-codegen build && pnpm package-quality:report` |
| `@croco/rpc-codegen` | `packages/rpc-codegen/dist/cli.d.ts` | 20 B | 20 B | `@croco/rpc-codegen:packages/rpc-codegen/dist/cli.d.ts` | +0 B (+0.0%) | within-baseline | `pnpm --filter @croco/rpc-codegen build && pnpm package-quality:report` |
| `@croco/rpc-codegen` | `packages/rpc-codegen/dist/cli.js` | 7.7 KiB | 5.2 KiB | `@croco/rpc-codegen:packages/rpc-codegen/dist/cli.js` | +2.4 KiB (+46.7%) | over-baseline | `pnpm --filter @croco/rpc-codegen build && pnpm package-quality:report` |
| `@croco/rpc-codegen` | `packages/rpc-codegen/dist/generate-*.js` | 314 B | 240 B | `@croco/rpc-codegen:packages/rpc-codegen/dist/generate-*.js` | +74 B (+30.8%) | over-baseline | `pnpm --filter @croco/rpc-codegen build && pnpm package-quality:report` |
| `@croco/rpc-codegen` | `packages/rpc-codegen/dist/index.cjs` | 100.1 KiB | 69.7 KiB | `@croco/rpc-codegen:packages/rpc-codegen/dist/index.cjs` | +30.3 KiB (+43.5%) | over-baseline | `pnpm --filter @croco/rpc-codegen build && pnpm package-quality:report` |
| `@croco/rpc-codegen` | `packages/rpc-codegen/dist/index.d.ts` | 1.7 KiB | 1.5 KiB | `@croco/rpc-codegen:packages/rpc-codegen/dist/index.d.ts` | +253 B (+16.6%) | over-baseline | `pnpm --filter @croco/rpc-codegen build && pnpm package-quality:report` |
| `@croco/rpc-codegen` | `packages/rpc-codegen/dist/index.js` | 346 B | 346 B | `@croco/rpc-codegen:packages/rpc-codegen/dist/index.js` | +0 B (+0.0%) | within-baseline | `pnpm --filter @croco/rpc-codegen build && pnpm package-quality:report` |
| `@croco/rpc-codegen` | `packages/rpc-codegen/dist/loadRoutes-*.js` | 113 B | 113 B | `@croco/rpc-codegen:packages/rpc-codegen/dist/loadRoutes-*.js` | +0 B (+0.0%) | within-baseline | `pnpm --filter @croco/rpc-codegen build && pnpm package-quality:report` |
| `@croco/search-core` | `packages/search-core/dist/chunk-*.js` | 2.4 KiB | 1.9 KiB | `@croco/search-core:packages/search-core/dist/chunk-*.js` | +556 B (+29.0%) | over-baseline | `pnpm --filter @croco/search-core build && pnpm package-quality:report` |
| `@croco/search-core` | `packages/search-core/dist/index.d.ts` | 15.6 KiB | 7.4 KiB | `@croco/search-core:packages/search-core/dist/index.d.ts` | +8.2 KiB (+111.8%) | over-baseline | `pnpm --filter @croco/search-core build && pnpm package-quality:report` |
| `@croco/search-core` | `packages/search-core/dist/index.js` | 26.8 KiB | 10.7 KiB | `@croco/search-core:packages/search-core/dist/index.js` | +16.1 KiB (+151.2%) | over-baseline | `pnpm --filter @croco/search-core build && pnpm package-quality:report` |
| `@croco/search-core` | `packages/search-core/dist/ko/index.d.ts` | 1.3 KiB | 1.3 KiB | `@croco/search-core:packages/search-core/dist/ko/index.d.ts` | +0 B (+0.0%) | within-baseline | `pnpm --filter @croco/search-core build && pnpm package-quality:report` |
| `@croco/search-core` | `packages/search-core/dist/ko/index.js` | 4.1 KiB | 3.6 KiB | `@croco/search-core:packages/search-core/dist/ko/index.js` | +477 B (+13.0%) | over-baseline | `pnpm --filter @croco/search-core build && pnpm package-quality:report` |
| `@croco/search-core` | `packages/search-core/dist/textTransforms-CoCREejn.d.ts` | 4.1 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/search-core build && pnpm package-quality:report` |
| `@croco/search-drizzle` | `packages/search-drizzle/dist/index.d.ts` | 10.2 KiB | 7.1 KiB | `@croco/search-drizzle:packages/search-drizzle/dist/index.d.ts` | +3.1 KiB (+43.7%) | over-baseline | `pnpm --filter @croco/search-drizzle build && pnpm package-quality:report` |
| `@croco/search-drizzle` | `packages/search-drizzle/dist/index.js` | 30.4 KiB | 12.2 KiB | `@croco/search-drizzle:packages/search-drizzle/dist/index.js` | +18.3 KiB (+150.3%) | over-baseline | `pnpm --filter @croco/search-drizzle build && pnpm package-quality:report` |
| `@croco/search-meilisearch` | `packages/search-meilisearch/dist/index.cjs` | 21.2 KiB | 15.4 KiB | `@croco/search-meilisearch:packages/search-meilisearch/dist/index.cjs` | +5.8 KiB (+37.9%) | over-baseline | `pnpm --filter @croco/search-meilisearch build && pnpm package-quality:report` |
| `@croco/search-meilisearch` | `packages/search-meilisearch/dist/index.d.ts` | 6.4 KiB | 5.3 KiB | `@croco/search-meilisearch:packages/search-meilisearch/dist/index.d.ts` | +1.1 KiB (+20.5%) | over-baseline | `pnpm --filter @croco/search-meilisearch build && pnpm package-quality:report` |
| `@croco/search-meilisearch` | `packages/search-meilisearch/dist/index.js` | 20.3 KiB | 14.6 KiB | `@croco/search-meilisearch:packages/search-meilisearch/dist/index.js` | +5.6 KiB (+38.6%) | over-baseline | `pnpm --filter @croco/search-meilisearch build && pnpm package-quality:report` |
| `@croco/storage-cloudflare` | `packages/storage-cloudflare/dist/index.d.ts` | 8.9 KiB | 8.1 KiB | `@croco/storage-cloudflare:packages/storage-cloudflare/dist/index.d.ts` | +829 B (+10.0%) | over-baseline | `pnpm --filter @croco/storage-cloudflare build && pnpm package-quality:report` |
| `@croco/storage-cloudflare` | `packages/storage-cloudflare/dist/index.js` | 24.5 KiB | 14.7 KiB | `@croco/storage-cloudflare:packages/storage-cloudflare/dist/index.js` | +9.9 KiB (+67.5%) | over-baseline | `pnpm --filter @croco/storage-cloudflare build && pnpm package-quality:report` |
| `@croco/storage-cloudflare` | `packages/storage-cloudflare/dist/index.mjs` | 23.7 KiB | 13.8 KiB | `@croco/storage-cloudflare:packages/storage-cloudflare/dist/index.mjs` | +9.9 KiB (+71.4%) | over-baseline | `pnpm --filter @croco/storage-cloudflare build && pnpm package-quality:report` |
| `@croco/storage-cloudinary` | `packages/storage-cloudinary/dist/index.d.ts` | 6.6 KiB | 5.7 KiB | `@croco/storage-cloudinary:packages/storage-cloudinary/dist/index.d.ts` | +938 B (+16.0%) | over-baseline | `pnpm --filter @croco/storage-cloudinary build && pnpm package-quality:report` |
| `@croco/storage-cloudinary` | `packages/storage-cloudinary/dist/index.js` | 23.4 KiB | 13.6 KiB | `@croco/storage-cloudinary:packages/storage-cloudinary/dist/index.js` | +9.8 KiB (+71.7%) | over-baseline | `pnpm --filter @croco/storage-cloudinary build && pnpm package-quality:report` |
| `@croco/storage-cloudinary` | `packages/storage-cloudinary/dist/index.mjs` | 22.5 KiB | 12.8 KiB | `@croco/storage-cloudinary:packages/storage-cloudinary/dist/index.mjs` | +9.7 KiB (+75.2%) | over-baseline | `pnpm --filter @croco/storage-cloudinary build && pnpm package-quality:report` |
| `@croco/storage-core` | `packages/storage-core/dist/StorageProblem-NVc-7q_q.d.ts` | 6.5 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/storage-core build && pnpm package-quality:report` |
| `@croco/storage-core` | `packages/storage-core/dist/chunk-*.mjs` | 1.4 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/storage-core build && pnpm package-quality:report` |
| `@croco/storage-core` | `packages/storage-core/dist/index.d.ts` | 5.5 KiB | 7.6 KiB | `@croco/storage-core:packages/storage-core/dist/index.d.ts` | -2.2 KiB (-28.5%) | within-baseline | `pnpm --filter @croco/storage-core build && pnpm package-quality:report` |
| `@croco/storage-core` | `packages/storage-core/dist/index.js` | 8.9 KiB | 4.3 KiB | `@croco/storage-core:packages/storage-core/dist/index.js` | +4.5 KiB (+104.3%) | over-baseline | `pnpm --filter @croco/storage-core build && pnpm package-quality:report` |
| `@croco/storage-core` | `packages/storage-core/dist/index.mjs` | 7.3 KiB | 3.8 KiB | `@croco/storage-core:packages/storage-core/dist/index.mjs` | +3.6 KiB (+95.1%) | over-baseline | `pnpm --filter @croco/storage-core build && pnpm package-quality:report` |
| `@croco/storage-core` | `packages/storage-core/dist/node.d.ts` | 764 B | missing | - | - | missing-baseline | `pnpm --filter @croco/storage-core build && pnpm package-quality:report` |
| `@croco/storage-core` | `packages/storage-core/dist/node.js` | 2.6 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/storage-core build && pnpm package-quality:report` |
| `@croco/storage-core` | `packages/storage-core/dist/node.mjs` | 1.1 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/storage-core build && pnpm package-quality:report` |
| `@croco/storage-r2` | `packages/storage-r2/dist/index.d.ts` | 4.6 KiB | 4.3 KiB | `@croco/storage-r2:packages/storage-r2/dist/index.d.ts` | +313 B (+7.2%) | over-baseline | `pnpm --filter @croco/storage-r2 build && pnpm package-quality:report` |
| `@croco/storage-r2` | `packages/storage-r2/dist/index.js` | 14.1 KiB | 11.1 KiB | `@croco/storage-r2:packages/storage-r2/dist/index.js` | +3.0 KiB (+27.0%) | over-baseline | `pnpm --filter @croco/storage-r2 build && pnpm package-quality:report` |
| `@croco/storage-r2` | `packages/storage-r2/dist/index.mjs` | 13.4 KiB | 10.5 KiB | `@croco/storage-r2:packages/storage-r2/dist/index.mjs` | +2.9 KiB (+28.1%) | over-baseline | `pnpm --filter @croco/storage-r2 build && pnpm package-quality:report` |
| `@croco/tasks-core` | `packages/tasks-core/dist/index.d.ts` | 10.2 KiB | 3.4 KiB | `@croco/tasks-core:packages/tasks-core/dist/index.d.ts` | +6.7 KiB (+196.7%) | over-baseline | `pnpm --filter @croco/tasks-core build && pnpm package-quality:report` |
| `@croco/tasks-core` | `packages/tasks-core/dist/index.js` | 14.6 KiB | 4.7 KiB | `@croco/tasks-core:packages/tasks-core/dist/index.js` | +9.9 KiB (+212.8%) | over-baseline | `pnpm --filter @croco/tasks-core build && pnpm package-quality:report` |
| `@croco/tasks-core` | `packages/tasks-core/dist/index.mjs` | 13.7 KiB | 4.1 KiB | `@croco/tasks-core:packages/tasks-core/dist/index.mjs` | +9.6 KiB (+235.0%) | over-baseline | `pnpm --filter @croco/tasks-core build && pnpm package-quality:report` |
| `@croco/tasks-qstash` | `packages/tasks-qstash/dist/index.d.ts` | 2.2 KiB | 2.1 KiB | `@croco/tasks-qstash:packages/tasks-qstash/dist/index.d.ts` | +174 B (+8.2%) | over-baseline | `pnpm --filter @croco/tasks-qstash build && pnpm package-quality:report` |
| `@croco/tasks-qstash` | `packages/tasks-qstash/dist/index.js` | 6.5 KiB | 4.4 KiB | `@croco/tasks-qstash:packages/tasks-qstash/dist/index.js` | +2.1 KiB (+48.4%) | over-baseline | `pnpm --filter @croco/tasks-qstash build && pnpm package-quality:report` |
| `@croco/tasks-qstash` | `packages/tasks-qstash/dist/index.mjs` | 5.9 KiB | 3.8 KiB | `@croco/tasks-qstash:packages/tasks-qstash/dist/index.mjs` | +2.1 KiB (+54.0%) | over-baseline | `pnpm --filter @croco/tasks-qstash build && pnpm package-quality:report` |
| `@croco/telemetry-api` | `packages/telemetry-api/dist/index.d.ts` | 5.4 KiB | 4.3 KiB | `@croco/telemetry-api:packages/telemetry-api/dist/index.d.ts` | +1.1 KiB (+26.4%) | over-baseline | `pnpm --filter @croco/telemetry-api build && pnpm package-quality:report` |
| `@croco/telemetry-api` | `packages/telemetry-api/dist/index.js` | 9.5 KiB | 4.7 KiB | `@croco/telemetry-api:packages/telemetry-api/dist/index.js` | +4.8 KiB (+101.2%) | over-baseline | `pnpm --filter @croco/telemetry-api build && pnpm package-quality:report` |
| `@croco/telemetry-api` | `packages/telemetry-api/dist/index.mjs` | 8.9 KiB | 4.2 KiB | `@croco/telemetry-api:packages/telemetry-api/dist/index.mjs` | +4.7 KiB (+113.4%) | over-baseline | `pnpm --filter @croco/telemetry-api build && pnpm package-quality:report` |
| `@croco/telemetry-sdk-node` | `packages/telemetry-sdk-node/dist/ProbabilitySampler-*.mjs` | 74 B | 74 B | `@croco/telemetry-sdk-node:packages/telemetry-sdk-node/dist/ProbabilitySampler-*.mjs` | +0 B (+0.0%) | within-baseline | `pnpm --filter @croco/telemetry-sdk-node build && pnpm package-quality:report` |
| `@croco/telemetry-sdk-node` | `packages/telemetry-sdk-node/dist/chunk-*.mjs` | 5.4 KiB | 1.8 KiB | `@croco/telemetry-sdk-node:packages/telemetry-sdk-node/dist/chunk-*.mjs` | +3.6 KiB (+201.5%) | over-baseline | `pnpm --filter @croco/telemetry-sdk-node build && pnpm package-quality:report` |
| `@croco/telemetry-sdk-node` | `packages/telemetry-sdk-node/dist/index.d.ts` | 15.4 KiB | 17.7 KiB | `@croco/telemetry-sdk-node:packages/telemetry-sdk-node/dist/index.d.ts` | -2.2 KiB (-12.6%) | within-baseline | `pnpm --filter @croco/telemetry-sdk-node build && pnpm package-quality:report` |
| `@croco/telemetry-sdk-node` | `packages/telemetry-sdk-node/dist/index.js` | 31.9 KiB | 8.1 KiB | `@croco/telemetry-sdk-node:packages/telemetry-sdk-node/dist/index.js` | +23.8 KiB (+292.3%) | over-baseline | `pnpm --filter @croco/telemetry-sdk-node build && pnpm package-quality:report` |
| `@croco/telemetry-sdk-node` | `packages/telemetry-sdk-node/dist/index.mjs` | 25.2 KiB | 5.5 KiB | `@croco/telemetry-sdk-node:packages/telemetry-sdk-node/dist/index.mjs` | +19.7 KiB (+359.9%) | over-baseline | `pnpm --filter @croco/telemetry-sdk-node build && pnpm package-quality:report` |
| `@croco/tenant-core` | `packages/tenant-core/dist/chunk-*.mjs` | 12.7 KiB | 10.9 KiB | `@croco/tenant-core:packages/tenant-core/dist/chunk-*.mjs` | +1.8 KiB (+16.7%) | over-baseline | `pnpm --filter @croco/tenant-core build && pnpm package-quality:report` |
| `@croco/tenant-core` | `packages/tenant-core/dist/index.d.ts` | 22.0 KiB | 21.4 KiB | `@croco/tenant-core:packages/tenant-core/dist/index.d.ts` | +622 B (+2.8%) | over-baseline | `pnpm --filter @croco/tenant-core build && pnpm package-quality:report` |
| `@croco/tenant-core` | `packages/tenant-core/dist/index.js` | 28.8 KiB | 24.5 KiB | `@croco/tenant-core:packages/tenant-core/dist/index.js` | +4.3 KiB (+17.5%) | over-baseline | `pnpm --filter @croco/tenant-core build && pnpm package-quality:report` |
| `@croco/tenant-core` | `packages/tenant-core/dist/index.mjs` | 14.8 KiB | 12.5 KiB | `@croco/tenant-core:packages/tenant-core/dist/index.mjs` | +2.3 KiB (+18.8%) | over-baseline | `pnpm --filter @croco/tenant-core build && pnpm package-quality:report` |
| `@croco/tenant-core` | `packages/tenant-core/dist/tenant-model.d.ts` | 13.6 KiB | 12.0 KiB | `@croco/tenant-core:packages/tenant-core/dist/tenant-model.d.ts` | +1.6 KiB (+13.7%) | over-baseline | `pnpm --filter @croco/tenant-core build && pnpm package-quality:report` |
| `@croco/tenant-core` | `packages/tenant-core/dist/tenant-model.js` | 13.7 KiB | 11.7 KiB | `@croco/tenant-core:packages/tenant-core/dist/tenant-model.js` | +2.0 KiB (+17.1%) | over-baseline | `pnpm --filter @croco/tenant-core build && pnpm package-quality:report` |
| `@croco/tenant-core` | `packages/tenant-core/dist/tenant-model.mjs` | 659 B | 496 B | `@croco/tenant-core:packages/tenant-core/dist/tenant-model.mjs` | +163 B (+32.9%) | over-baseline | `pnpm --filter @croco/tenant-core build && pnpm package-quality:report` |
| `@croco/testing` | `packages/testing/dist/chunk-*.mjs` | 59.3 KiB | 2.6 KiB | `@croco/testing:packages/testing/dist/chunk-*.mjs` | +56.7 KiB (+2177.6%) | over-baseline | `pnpm --filter @croco/testing build && pnpm package-quality:report` |
| `@croco/testing` | `packages/testing/dist/drizzle.d.ts` | 2.3 KiB | 2.3 KiB | `@croco/testing:packages/testing/dist/drizzle.d.ts` | +0 B (+0.0%) | within-baseline | `pnpm --filter @croco/testing build && pnpm package-quality:report` |
| `@croco/testing` | `packages/testing/dist/drizzle.js` | 2.6 KiB | 2.4 KiB | `@croco/testing:packages/testing/dist/drizzle.js` | +199 B (+8.0%) | over-baseline | `pnpm --filter @croco/testing build && pnpm package-quality:report` |
| `@croco/testing` | `packages/testing/dist/drizzle.mjs` | 155 B | 121 B | `@croco/testing:packages/testing/dist/drizzle.mjs` | +34 B (+28.1%) | over-baseline | `pnpm --filter @croco/testing build && pnpm package-quality:report` |
| `@croco/testing` | `packages/testing/dist/executable-assurance-Bv9pWeNr.d.ts` | 16.1 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/testing build && pnpm package-quality:report` |
| `@croco/testing` | `packages/testing/dist/executable-assurance.d.ts` | 1.4 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/testing build && pnpm package-quality:report` |
| `@croco/testing` | `packages/testing/dist/executable-assurance.js` | 48.5 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/testing build && pnpm package-quality:report` |
| `@croco/testing` | `packages/testing/dist/executable-assurance.mjs` | 851 B | missing | - | - | missing-baseline | `pnpm --filter @croco/testing build && pnpm package-quality:report` |
| `@croco/testing` | `packages/testing/dist/index.d.ts` | 55.7 KiB | 35.1 KiB | `@croco/testing:packages/testing/dist/index.d.ts` | +20.6 KiB (+58.7%) | over-baseline | `pnpm --filter @croco/testing build && pnpm package-quality:report` |
| `@croco/testing` | `packages/testing/dist/index.js` | 195.9 KiB | 57.3 KiB | `@croco/testing:packages/testing/dist/index.js` | +138.5 KiB (+241.6%) | over-baseline | `pnpm --filter @croco/testing build && pnpm package-quality:report` |
| `@croco/testing` | `packages/testing/dist/index.mjs` | 132.2 KiB | 52.9 KiB | `@croco/testing:packages/testing/dist/index.mjs` | +79.3 KiB (+150.1%) | over-baseline | `pnpm --filter @croco/testing build && pnpm package-quality:report` |
| `@croco/testing` | `packages/testing/dist/notifications.d.ts` | 1.7 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/testing build && pnpm package-quality:report` |
| `@croco/testing` | `packages/testing/dist/notifications.js` | 1.7 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/testing build && pnpm package-quality:report` |
| `@croco/testing` | `packages/testing/dist/notifications.mjs` | 1.1 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/testing build && pnpm package-quality:report` |
| `@croco/testing` | `packages/testing/dist/playwright-*.js` | 17.7 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/testing build && pnpm package-quality:report` |
| `@croco/testing` | `packages/testing/dist/playwright-*.mjs` | 121 B | missing | - | - | missing-baseline | `pnpm --filter @croco/testing build && pnpm package-quality:report` |
| `@croco/testing` | `packages/testing/dist/playwright-reporter.d.ts` | 359 B | missing | - | - | missing-baseline | `pnpm --filter @croco/testing build && pnpm package-quality:report` |
| `@croco/testing` | `packages/testing/dist/schemas/test-evidence-bundle-v1.schema.json` | 1.4 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/testing build && pnpm package-quality:report` |
| `@croco/testing` | `packages/testing/dist/schemas/test-evidence-v1.schema.json` | 4.8 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/testing build && pnpm package-quality:report` |
| `@croco/testing` | `packages/testing/dist/test-evidence-BmmXRVJ-.d.ts` | 28.1 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/testing build && pnpm package-quality:report` |
| `@croco/testing` | `packages/testing/dist/vitest-*.js` | 16.6 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/testing build && pnpm package-quality:report` |
| `@croco/testing` | `packages/testing/dist/vitest-*.mjs` | 121 B | missing | - | - | missing-baseline | `pnpm --filter @croco/testing build && pnpm package-quality:report` |
| `@croco/testing` | `packages/testing/dist/vitest-reporter-DOsrWH9a.d.ts` | 4.0 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/testing build && pnpm package-quality:report` |
| `@croco/testing` | `packages/testing/dist/vitest-reporter.d.ts` | 359 B | missing | - | - | missing-baseline | `pnpm --filter @croco/testing build && pnpm package-quality:report` |
| `@croco/testing-resources` | `packages/testing-resources/dist/index.d.ts` | 3.8 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/testing-resources build && pnpm package-quality:report` |
| `@croco/testing-resources` | `packages/testing-resources/dist/index.js` | 11.4 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/testing-resources build && pnpm package-quality:report` |
| `@croco/testing-resources` | `packages/testing-resources/dist/index.mjs` | 10.6 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/testing-resources build && pnpm package-quality:report` |
| `@croco/transports-cloudflare-workers` | `packages/transports-cloudflare-workers/dist/index.d.ts` | 636 B | 636 B | `@croco/transports-cloudflare-workers:packages/transports-cloudflare-workers/dist/index.d.ts` | +0 B (+0.0%) | within-baseline | `pnpm --filter @croco/transports-cloudflare-workers build && pnpm package-quality:report` |
| `@croco/transports-cloudflare-workers` | `packages/transports-cloudflare-workers/dist/index.js` | 1.1 KiB | 1002 B | `@croco/transports-cloudflare-workers:packages/transports-cloudflare-workers/dist/index.js` | +167 B (+16.7%) | over-baseline | `pnpm --filter @croco/transports-cloudflare-workers build && pnpm package-quality:report` |
| `@croco/transports-cloudflare-workers` | `packages/transports-cloudflare-workers/dist/index.mjs` | 704 B | 509 B | `@croco/transports-cloudflare-workers:packages/transports-cloudflare-workers/dist/index.mjs` | +195 B (+38.3%) | over-baseline | `pnpm --filter @croco/transports-cloudflare-workers build && pnpm package-quality:report` |
| `@croco/transports-graphql` | `packages/transports-graphql/dist/SchemaCompiler-*.js` | 69 B | 69 B | `@croco/transports-graphql:packages/transports-graphql/dist/SchemaCompiler-*.js` | +0 B (+0.0%) | within-baseline | `pnpm --filter @croco/transports-graphql build && pnpm package-quality:report` |
| `@croco/transports-graphql` | `packages/transports-graphql/dist/chunk-*.js` | 6.1 KiB | 1.9 KiB | `@croco/transports-graphql:packages/transports-graphql/dist/chunk-*.js` | +4.2 KiB (+216.8%) | over-baseline | `pnpm --filter @croco/transports-graphql build && pnpm package-quality:report` |
| `@croco/transports-graphql` | `packages/transports-graphql/dist/index.cjs` | 17.2 KiB | 5.6 KiB | `@croco/transports-graphql:packages/transports-graphql/dist/index.cjs` | +11.6 KiB (+207.1%) | over-baseline | `pnpm --filter @croco/transports-graphql build && pnpm package-quality:report` |
| `@croco/transports-graphql` | `packages/transports-graphql/dist/index.d.ts` | 3.9 KiB | 2.7 KiB | `@croco/transports-graphql:packages/transports-graphql/dist/index.d.ts` | +1.3 KiB (+47.9%) | over-baseline | `pnpm --filter @croco/transports-graphql build && pnpm package-quality:report` |
| `@croco/transports-graphql` | `packages/transports-graphql/dist/index.js` | 10.0 KiB | 2.9 KiB | `@croco/transports-graphql:packages/transports-graphql/dist/index.js` | +7.0 KiB (+238.5%) | over-baseline | `pnpm --filter @croco/transports-graphql build && pnpm package-quality:report` |
| `@croco/transports-http` | `packages/transports-http/dist/GracefulShutdownMiddleware-*.mjs` | 329 B | missing | - | - | missing-baseline | `pnpm --filter @croco/transports-http build && pnpm package-quality:report` |
| `@croco/transports-http` | `packages/transports-http/dist/chunk-*.mjs` | 8.7 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/transports-http build && pnpm package-quality:report` |
| `@croco/transports-http` | `packages/transports-http/dist/index.d.ts` | 32.0 KiB | 23.0 KiB | `@croco/transports-http:packages/transports-http/dist/index.d.ts` | +9.0 KiB (+39.3%) | over-baseline | `pnpm --filter @croco/transports-http build && pnpm package-quality:report` |
| `@croco/transports-http` | `packages/transports-http/dist/index.js` | 104.7 KiB | 55.8 KiB | `@croco/transports-http:packages/transports-http/dist/index.js` | +49.0 KiB (+87.9%) | over-baseline | `pnpm --filter @croco/transports-http build && pnpm package-quality:report` |
| `@croco/transports-http` | `packages/transports-http/dist/index.mjs` | 93.2 KiB | 54.2 KiB | `@croco/transports-http:packages/transports-http/dist/index.mjs` | +39.0 KiB (+71.9%) | over-baseline | `pnpm --filter @croco/transports-http build && pnpm package-quality:report` |
| `@croco/triggers-core` | `packages/triggers-core/dist/index.d.ts` | 10.4 KiB | 5.6 KiB | `@croco/triggers-core:packages/triggers-core/dist/index.d.ts` | +4.8 KiB (+86.3%) | over-baseline | `pnpm --filter @croco/triggers-core build && pnpm package-quality:report` |
| `@croco/triggers-core` | `packages/triggers-core/dist/index.js` | 4.7 KiB | 3.4 KiB | `@croco/triggers-core:packages/triggers-core/dist/index.js` | +1.3 KiB (+37.7%) | over-baseline | `pnpm --filter @croco/triggers-core build && pnpm package-quality:report` |
| `@croco/triggers-core` | `packages/triggers-core/dist/index.mjs` | 4.0 KiB | 2.7 KiB | `@croco/triggers-core:packages/triggers-core/dist/index.mjs` | +1.3 KiB (+47.8%) | over-baseline | `pnpm --filter @croco/triggers-core build && pnpm package-quality:report` |
| `@croco/triggers-qstash` | `packages/triggers-qstash/dist/index.d.ts` | 14.8 KiB | 9.8 KiB | `@croco/triggers-qstash:packages/triggers-qstash/dist/index.d.ts` | +5.1 KiB (+51.8%) | over-baseline | `pnpm --filter @croco/triggers-qstash build && pnpm package-quality:report` |
| `@croco/triggers-qstash` | `packages/triggers-qstash/dist/index.js` | 21.4 KiB | 9.8 KiB | `@croco/triggers-qstash:packages/triggers-qstash/dist/index.js` | +11.5 KiB (+117.0%) | over-baseline | `pnpm --filter @croco/triggers-qstash build && pnpm package-quality:report` |
| `@croco/triggers-qstash` | `packages/triggers-qstash/dist/index.mjs` | 20.6 KiB | 9.3 KiB | `@croco/triggers-qstash:packages/triggers-qstash/dist/index.mjs` | +11.2 KiB (+120.6%) | over-baseline | `pnpm --filter @croco/triggers-qstash build && pnpm package-quality:report` |
| `@croco/tx-core` | `packages/tx-core/dist/index.d.ts` | 10.4 KiB | 5.6 KiB | `@croco/tx-core:packages/tx-core/dist/index.d.ts` | +4.9 KiB (+87.3%) | over-baseline | `pnpm --filter @croco/tx-core build && pnpm package-quality:report` |
| `@croco/tx-core` | `packages/tx-core/dist/index.js` | 15.6 KiB | 6.8 KiB | `@croco/tx-core:packages/tx-core/dist/index.js` | +8.8 KiB (+128.9%) | over-baseline | `pnpm --filter @croco/tx-core build && pnpm package-quality:report` |
| `@croco/tx-core` | `packages/tx-core/dist/index.mjs` | 14.3 KiB | 5.9 KiB | `@croco/tx-core:packages/tx-core/dist/index.mjs` | +8.4 KiB (+141.6%) | over-baseline | `pnpm --filter @croco/tx-core build && pnpm package-quality:report` |
| `@croco/tx-drizzle` | `packages/tx-drizzle/dist/index.d.ts` | 8.5 KiB | 4.1 KiB | `@croco/tx-drizzle:packages/tx-drizzle/dist/index.d.ts` | +4.4 KiB (+107.5%) | over-baseline | `pnpm --filter @croco/tx-drizzle build && pnpm package-quality:report` |
| `@croco/tx-drizzle` | `packages/tx-drizzle/dist/index.js` | 18.1 KiB | 4.7 KiB | `@croco/tx-drizzle:packages/tx-drizzle/dist/index.js` | +13.4 KiB (+287.5%) | over-baseline | `pnpm --filter @croco/tx-drizzle build && pnpm package-quality:report` |
| `@croco/tx-drizzle` | `packages/tx-drizzle/dist/index.mjs` | 17.1 KiB | 4.0 KiB | `@croco/tx-drizzle:packages/tx-drizzle/dist/index.mjs` | +13.1 KiB (+329.4%) | over-baseline | `pnpm --filter @croco/tx-drizzle build && pnpm package-quality:report` |
| `@croco/ui-astryx` | `packages/ui-astryx/dist/index.d.ts` | 3.6 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/ui-astryx build && pnpm package-quality:report` |
| `@croco/ui-astryx` | `packages/ui-astryx/dist/index.js` | 4.8 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/ui-astryx build && pnpm package-quality:report` |
| `@croco/ui-astryx` | `packages/ui-astryx/dist/index.mjs` | 4.2 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/ui-astryx build && pnpm package-quality:report` |
| `@croco/ui-astryx` | `packages/ui-astryx/dist/styles.css` | 130 B | missing | - | - | missing-baseline | `pnpm --filter @croco/ui-astryx build && pnpm package-quality:report` |
| `@croco/warehouse-core` | `packages/warehouse-core/dist/chunk-*.mjs` | 8.7 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/warehouse-core build && pnpm package-quality:report` |
| `@croco/warehouse-core` | `packages/warehouse-core/dist/index.d.ts` | 4.1 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/warehouse-core build && pnpm package-quality:report` |
| `@croco/warehouse-core` | `packages/warehouse-core/dist/index.js` | 11.6 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/warehouse-core build && pnpm package-quality:report` |
| `@croco/warehouse-core` | `packages/warehouse-core/dist/index.mjs` | 2.5 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/warehouse-core build && pnpm package-quality:report` |
| `@croco/warehouse-core` | `packages/warehouse-core/dist/runtime.d.ts` | 8.8 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/warehouse-core build && pnpm package-quality:report` |
| `@croco/warehouse-core` | `packages/warehouse-core/dist/runtime.js` | 12.2 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/warehouse-core build && pnpm package-quality:report` |
| `@croco/warehouse-core` | `packages/warehouse-core/dist/runtime.mjs` | 3.6 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/warehouse-core build && pnpm package-quality:report` |
| `@croco/warehouse-core` | `packages/warehouse-core/dist/types-Dp6Twlnj.d.ts` | 3.8 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/warehouse-core build && pnpm package-quality:report` |
| `@croco/warehouse-postgres` | `packages/warehouse-postgres/dist/chunk-*.mjs` | 21.2 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/warehouse-postgres build && pnpm package-quality:report` |
| `@croco/warehouse-postgres` | `packages/warehouse-postgres/dist/facts.d.ts` | 6.2 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/warehouse-postgres build && pnpm package-quality:report` |
| `@croco/warehouse-postgres` | `packages/warehouse-postgres/dist/facts.js` | 46.4 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/warehouse-postgres build && pnpm package-quality:report` |
| `@croco/warehouse-postgres` | `packages/warehouse-postgres/dist/facts.mjs` | 22.8 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/warehouse-postgres build && pnpm package-quality:report` |
| `@croco/warehouse-postgres` | `packages/warehouse-postgres/dist/index.d.ts` | 13 B | missing | - | - | missing-baseline | `pnpm --filter @croco/warehouse-postgres build && pnpm package-quality:report` |
| `@croco/warehouse-postgres` | `packages/warehouse-postgres/dist/index.js` | 397 B | missing | - | - | missing-baseline | `pnpm --filter @croco/warehouse-postgres build && pnpm package-quality:report` |
| `@croco/warehouse-postgres` | `packages/warehouse-postgres/dist/index.mjs` | 0 B | missing | - | - | missing-baseline | `pnpm --filter @croco/warehouse-postgres build && pnpm package-quality:report` |
| `@croco/warehouse-postgres` | `packages/warehouse-postgres/dist/metrics.d.ts` | 2.9 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/warehouse-postgres build && pnpm package-quality:report` |
| `@croco/warehouse-postgres` | `packages/warehouse-postgres/dist/metrics.js` | 10.9 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/warehouse-postgres build && pnpm package-quality:report` |
| `@croco/warehouse-postgres` | `packages/warehouse-postgres/dist/metrics.mjs` | 10.2 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/warehouse-postgres build && pnpm package-quality:report` |
| `@croco/warehouse-postgres` | `packages/warehouse-postgres/dist/pipeline.d.ts` | 860 B | missing | - | - | missing-baseline | `pnpm --filter @croco/warehouse-postgres build && pnpm package-quality:report` |
| `@croco/warehouse-postgres` | `packages/warehouse-postgres/dist/pipeline.js` | 20.6 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/warehouse-postgres build && pnpm package-quality:report` |
| `@croco/warehouse-postgres` | `packages/warehouse-postgres/dist/pipeline.mjs` | 3.1 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/warehouse-postgres build && pnpm package-quality:report` |
| `@croco/warehouse-tooling` | `packages/warehouse-tooling/dist/index.d.ts` | 4.5 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/warehouse-tooling build && pnpm package-quality:report` |
| `@croco/warehouse-tooling` | `packages/warehouse-tooling/dist/index.js` | 249.7 KiB | missing | - | - | missing-baseline | `pnpm --filter @croco/warehouse-tooling build && pnpm package-quality:report` |
| `@croco/webhooks-core` | `packages/webhooks-core/dist/index.d.ts` | 31.1 KiB | 12.2 KiB | `@croco/webhooks-core:packages/webhooks-core/dist/index.d.ts` | +18.9 KiB (+155.1%) | over-baseline | `pnpm --filter @croco/webhooks-core build && pnpm package-quality:report` |
| `@croco/webhooks-core` | `packages/webhooks-core/dist/index.js` | 61.0 KiB | 16.1 KiB | `@croco/webhooks-core:packages/webhooks-core/dist/index.js` | +44.9 KiB (+278.3%) | over-baseline | `pnpm --filter @croco/webhooks-core build && pnpm package-quality:report` |
| `@croco/webhooks-core` | `packages/webhooks-core/dist/index.mjs` | 59.0 KiB | 15.0 KiB | `@croco/webhooks-core:packages/webhooks-core/dist/index.mjs` | +44.0 KiB (+293.6%) | over-baseline | `pnpm --filter @croco/webhooks-core build && pnpm package-quality:report` |
| `@croco/workflow-core` | `packages/workflow-core/dist/index.d.ts` | 21.6 KiB | 15.4 KiB | `@croco/workflow-core:packages/workflow-core/dist/index.d.ts` | +6.2 KiB (+40.5%) | over-baseline | `pnpm --filter @croco/workflow-core build && pnpm package-quality:report` |
| `@croco/workflow-core` | `packages/workflow-core/dist/index.js` | 36.4 KiB | 22.0 KiB | `@croco/workflow-core:packages/workflow-core/dist/index.js` | +14.4 KiB (+65.3%) | over-baseline | `pnpm --filter @croco/workflow-core build && pnpm package-quality:report` |
| `@croco/workflow-core` | `packages/workflow-core/dist/index.mjs` | 35.0 KiB | 21.0 KiB | `@croco/workflow-core:packages/workflow-core/dist/index.mjs` | +14.0 KiB (+66.6%) | over-baseline | `pnpm --filter @croco/workflow-core build && pnpm package-quality:report` |
| `create-croco-app` | `packages/create-croco-app/dist/bin.d.ts` | 13 B | missing | - | - | missing-baseline | `pnpm --filter create-croco-app build && pnpm package-quality:report` |
| `create-croco-app` | `packages/create-croco-app/dist/bin.js` | 306 B | missing | - | - | missing-baseline | `pnpm --filter create-croco-app build && pnpm package-quality:report` |
| `create-croco-app` | `packages/create-croco-app/dist/chunk-*.js` | 189.7 KiB | 39.7 KiB | `create-croco-app:packages/create-croco-app/dist/chunk-*.js` | +150.0 KiB (+377.9%) | over-baseline | `pnpm --filter create-croco-app build && pnpm package-quality:report` |
| `create-croco-app` | `packages/create-croco-app/dist/generator-C40LYnb1.d.ts` | 7.4 KiB | missing | - | - | missing-baseline | `pnpm --filter create-croco-app build && pnpm package-quality:report` |
| `create-croco-app` | `packages/create-croco-app/dist/generator.d.ts` | 291 B | missing | - | - | missing-baseline | `pnpm --filter create-croco-app build && pnpm package-quality:report` |
| `create-croco-app` | `packages/create-croco-app/dist/generator.js` | 123 B | missing | - | - | missing-baseline | `pnpm --filter create-croco-app build && pnpm package-quality:report` |
| `create-croco-app` | `packages/create-croco-app/dist/index.d.ts` | 326 B | 13 B | `create-croco-app:packages/create-croco-app/dist/index.d.ts` | +313 B (+2407.7%) | over-baseline | `pnpm --filter create-croco-app build && pnpm package-quality:report` |
| `create-croco-app` | `packages/create-croco-app/dist/index.js` | 355 B | 6.9 KiB | `create-croco-app:packages/create-croco-app/dist/index.js` | -6.5 KiB (-95.0%) | within-baseline | `pnpm --filter create-croco-app build && pnpm package-quality:report` |
| `create-croco-app` | `packages/create-croco-app/dist/options-*.js` | 581 B | 21.2 KiB | `create-croco-app:packages/create-croco-app/dist/options-*.js` | -20.6 KiB (-97.3%) | within-baseline | `pnpm --filter create-croco-app build && pnpm package-quality:report` |
| `create-croco-app` | `packages/create-croco-app/dist/options-BfvYfI62.d.ts` | 902 B | missing | - | - | missing-baseline | `pnpm --filter create-croco-app build && pnpm package-quality:report` |
| `create-croco-app` | `packages/create-croco-app/dist/programmatic.d.ts` | 459 B | missing | - | - | missing-baseline | `pnpm --filter create-croco-app build && pnpm package-quality:report` |
| `create-croco-app` | `packages/create-croco-app/dist/programmatic.js` | 355 B | missing | - | - | missing-baseline | `pnpm --filter create-croco-app build && pnpm package-quality:report` |
| `create-croco-app` | `packages/create-croco-app/dist/prompts-*.js` | 13.4 KiB | 11.1 KiB | `create-croco-app:packages/create-croco-app/dist/prompts-*.js` | +2.2 KiB (+20.0%) | over-baseline | `pnpm --filter create-croco-app build && pnpm package-quality:report` |
| `create-croco-app` | `packages/create-croco-app/dist/verification.d.ts` | 635 B | missing | - | - | missing-baseline | `pnpm --filter create-croco-app build && pnpm package-quality:report` |
| `create-croco-app` | `packages/create-croco-app/dist/verification.js` | 663 B | missing | - | - | missing-baseline | `pnpm --filter create-croco-app build && pnpm package-quality:report` |

## Unmatched baselines
Baseline keys listed here did not match any measured artifact and may be stale or duplicated.

| Baseline key |
| --- |
| `@croco/cli:packages/cli/dist/migrate-*.js` |
| `@croco/meta-vite:packages/meta-vite/dist/types-B_N33Yhk.d.ts` |
| `@croco/search-core:packages/search-core/dist/textTransforms-Lw3RjwZ_.d.ts` |
| `create-croco-app:packages/create-croco-app/dist/generator-*.js` |

## Promotion criteria
1. Commit `ci-reports/bundle-size/baseline.json` from a green protected-branch build or another reproducible protected-branch source.
2. Every measured artifact must resolve to exactly one package and artifact row with a local recovery command.
3. New publishable build packages must either produce measured `dist` artifacts or carry an explicit exemption before enforcement.
4. Keep this report warning-only until multiple PRs show stable package ownership, no missing baselines, and no unmatched baselines.
