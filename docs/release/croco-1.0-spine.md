# Croco 1.0 Spine

The Croco 1.0 spine is the release-critical package set whose public API, diagnostics, generated
artifacts, runtime contracts, and release evidence define the 1.0 compatibility surface.

The machine-readable source of truth is `docs/package-catalog.json` `spine.packages`.

Current 1.0 spine status: 18 spine packages; 10 production-ready, 8 beta, 0 alpha/WIP, 0 deprecated; 8 beta promotion records.

## Package Set

| Package                     | Gate role                                                         |
| --------------------------- | ----------------------------------------------------------------- |
| `@croco/framework-context`  | Context, DI, decorator metadata, and framework bootstrap root     |
| `@croco/problems-core`      | Public failure model and Problem compatibility                    |
| `@croco/protocols-core`     | Shared route contract graph and protocol diagnostics              |
| `@croco/protocols-rest`     | REST decorator contract and generated route metadata              |
| `@croco/openapi-spec`       | OpenAPI generation from accepted contracts                        |
| `@croco/rpc-codegen`        | Generated RPC/client contract from accepted routes                |
| `@croco/transports-http`    | Hono HTTP and Lambda runtime execution path                       |
| `@croco/telemetry-api`      | Application tracing API and trace context contract                |
| `@croco/telemetry-sdk-node` | Node/Lambda telemetry runtime initialization and flush            |
| `@croco/tx-core`            | Transaction boundary abstraction                                  |
| `@croco/tx-drizzle`         | Drizzle-backed transaction implementation used by the golden path |
| `@croco/events-core`        | Domain event contract                                             |
| `@croco/events-tx`          | Transaction-aware event dispatch path                             |
| `@croco/retry-core`         | Retry, backoff, and reliability primitive                         |
| `@croco/idempotency-core`   | Idempotency contract for retries and generated operations         |
| `@croco/testing`            | Test harnesses and conformance utilities for release evidence     |
| `create-croco-app`          | Generated app first-success and smoke entrypoint                  |
| `@croco/cli`                | Operator/developer command surface                                |

## 0.x-to-1.0 Migration Matrix

This matrix is the RC and `latest` release-note source for 0.x-to-1.0 spine compatibility. RC
release notes must link this section and name any row whose package entrypoints, generated app
templates, manifests, ContractGraph, Problem codes, or runtime capability behavior changed since the
previous prerelease.

Use this verification path for every 0.x-to-1.0 migration review:

1. Run `pnpm package-manifests:check`, `pnpm package-entrypoints:smoke`,
   `pnpm strict-contract-typecheck`, `pnpm create-croco-app:smoke`, and `pnpm release-docs:check`.
2. Run `croco doctor` in migrated generated apps or consumer fixtures that declare contract,
   manifest, ProblemRegistry, runtime capability, repository, telemetry, or provider-profile gates.
3. Run `croco upgrade --dry-run` before rewriting legacy generated app templates or Problem code
   matchers; use `croco upgrade --write` only after reviewing manual confirmations.

| Package                     | 1.0 compatibility surface                                                                                              | 0.x migration / renamed-deprecated-removed artifacts                                                                                                                                                                                                                       | Practical diagnostics and recovery                                                                                                                |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@croco/framework-context`  | Public context, DI, decorator metadata, runtime policy, runtime capability, inspector, middleware, and shutdown groups | Public exports are governed by compatibility groups in `public-api-surface.snapshot.json`. Treat renamed or removed DI/context/runtime-policy/runtime-capability exports as release-note breaking changes; regenerate manifests instead of hand-editing runtime artifacts. | `pnpm public-api:check`, `croco doctor` DI diagnostics, and `croco runtime-policy check` surface drift before release.                            |
| `@croco/problems-core`      | RFC 7807 Problem classes, stable Problem codes, registry entries, and generated Problem unions                         | General `Error`-style failure matching is not a 1.0 contract. Move consumer matchers to stable Problem codes and keep legacy code matching only as temporary compatibility evidence.                                                                                       | `pnpm problem-registry:check`, `croco doctor` ProblemRegistry checks, and `croco upgrade --dry-run` for known legacy HTTP security code matchers. |
| `@croco/protocols-core`     | ContractGraph v1 schema, route contracts, schema diagnostics, and snapshot drift                                       | Regenerate `contract-graph.snapshot.json` from accepted controllers. Removed routes, HTTP method/path changes, removed operation ids, and incompatible request/response schemas are breaking unless documented.                                                            | `pnpm contract:check`, `pnpm contract:verify`, `pnpm strict-contract-typecheck`, and `croco doctor` ContractGraph artifact checks.                |
| `@croco/protocols-rest`     | REST decorators, `defineRouteContract`, `defineRouteProblem`, and generated route metadata                             | Schema-less generated routes are legacy migration cases. 1.0 generated app routes must declare request, response, and Problem contracts before OpenAPI/RPC output is written.                                                                                              | Generated app `contract:verify` and strict ContractGraph diagnostics block missing schema or Problem contracts.                                   |
| `@croco/openapi-spec`       | OpenAPI output generated from accepted ContractGraph data                                                              | `--compatibility-schemas` is a legacy opt-out only; it must not appear in generated app CI or 1.0 release evidence. Hand-edited generated OpenAPI is not authoritative.                                                                                                    | `croco-openapi-spec --fail-on-diagnostics`, `pnpm strict-contract-typecheck`, and generated app contract smoke.                                   |
| `@croco/rpc-codegen`        | Typed RPC clients, JSON-safe response types, query keys, and generated Problem rejections                              | `--compatibility-schemas` and `--compatibility-problems` are legacy opt-outs only. Missing generated-client Problem unions must be fixed at the route contract instead of hidden in 1.0 generated clients.                                                                 | `croco-rpc-codegen --fail-on-diagnostics`, generated app contract smoke, and strict contract typecheck.                                           |
| `@croco/transports-http`    | Hono HTTP/Lambda runtime path, security middleware validation, runtime Problem codes, and operational endpoints        | Rename legacy `transports-http/security-middleware-validation` matchers to `CROCO_HTTP_SECURITY_001`; use `extensions.legacyCode` only during rollout. `unsafeSkipSecurityValidation` and `securityValidation: "off"` are explicit migration/test escape hatches.          | `croco upgrade --dry-run` reports `CROCO_CLI_UPGRADE_003`/`005`; `croco doctor` reports disabled security validation where practical.             |
| `@croco/telemetry-api`      | `@Trace`, `withSpan`, active trace info, events, and error recording                                                   | Keep application code on the public tracing API instead of depending on SDK internals. Public API snapshot drift is the compatibility signal for renamed or removed tracing helpers.                                                                                       | Package tests, public API snapshot checks, and generated app build/typecheck cover consumer-facing tracing usage.                                 |
| `@croco/telemetry-sdk-node` | Node/Lambda telemetry runtime initialization, OTLP exporter setup, sampling, shutdown, and force flush                 | Croco does not use `AWS_LAMBDA_EXEC_WRAPPER`; initialize `TelemetryRuntime` in application scope and call `forceFlush()` before Lambda return. X-Ray requires an ADOT Collector bridge, not a direct SDK switch.                                                           | `croco doctor` Lambda telemetry flush checks and generated app smoke keep flush boundaries visible.                                               |
| `@croco/tx-core`            | Transaction boundary abstractions and request transaction context                                                      | Keep repository and event code on the `@croco/tx-core` interfaces. Drizzle-specific public types are not part of this package's 1.0 surface.                                                                                                                               | Typecheck, package tests, and repository boundary diagnostics catch implementation leakage.                                                       |
| `@croco/tx-drizzle`         | Drizzle-backed transaction implementation and adapter registration                                                     | Drizzle runtime specifics live here, not in `@croco/repository-core` or `@croco/tx-core` contracts. Treat cross-package Drizzle imports as boundary regressions.                                                                                                           | Package tests and `croco doctor` repository-core Drizzle boundary checks.                                                                         |
| `@croco/events-core`        | Domain event contract, publisher/subscriber types, and event metadata                                                  | Preserve event envelope shape and public type exports. Consumer-visible event field removals need migration notes before 1.0.                                                                                                                                              | Package tests, public API snapshot checks, and generated app smoke for event usage.                                                               |
| `@croco/events-tx`          | Transaction-aware event dispatch and outbox/retry integration                                                          | Migrate ad hoc dispatch that bypasses transaction context to the transaction-aware event path when the app needs post-commit behavior.                                                                                                                                     | Package tests and spine promotion evidence track transactional dispatch recovery work.                                                            |
| `@croco/retry-core`         | Retry, backoff, timeout, and reliability primitives                                                                    | Keep failure handling explicit; do not replace retryable Problems with catch-all `Error` fallbacks. Renamed or removed retry option fields require a release-note migration.                                                                                               | Package tests and public API snapshot checks cover public retry options.                                                                          |
| `@croco/idempotency-core`   | Idempotency key contract used by retries and generated operations                                                      | Migrate operation paths that depend on retry safety to explicit idempotency keys instead of implicit retry side effects.                                                                                                                                                   | Package tests and spine promotion evidence cover idempotency/retry interaction.                                                                   |
| `@croco/testing`            | Test harnesses and conformance utilities used by package and generated app evidence                                    | Treat harness API removals as release-significant because they affect consumer and adapter conformance suites.                                                                                                                                                             | Package tests, generated app smoke, and production-ready evidence cover harness behavior.                                                         |
| `create-croco-app`          | Generated app templates, package manifests, runtime manifests, contract scripts, smoke scripts, and first success      | Generated SPA `routeConfig` files migrate to `@croco/meta-vite` `defineRoute` output when they match the known template. Generated apps now write `croco-runtime-capability.manifest.json`; legacy `croco-runtime-policy.manifest.json` is compatibility input only.       | `pnpm create-croco-app:smoke`, `croco doctor`, `croco runtime-policy check`, and `croco upgrade --dry-run` cover known old generated artifacts.   |
| `@croco/cli`                | `croco doctor`, `croco upgrade`, contracts, project-map, runtime-policy, and JSON diagnostic reports                   | `croco.doctor.v1` report shape and stable diagnostic codes are compatibility contracts. Breaking JSON report changes require schema versioning or release notes with a migration path.                                                                                     | CLI tests, doctor JSON snapshots, upgrade reports, and `pnpm release-docs:check` gate the operator-facing migration surface.                      |

### Renamed, Deprecated, and Removed 0.x Artifacts

- `croco-runtime-policy.manifest.json` remains accepted for older generated apps, but the 1.0
  generated manifest is `croco-runtime-capability.manifest.json`. Regenerate the runtime capability
  manifest and keep runtime-policy checks only as compatibility evidence.
- Generated SPA `routeConfig` exports are legacy template artifacts. `croco upgrade --dry-run`
  reports known template matches with a manual `@croco/meta-vite` `defineRoute` migration.
- `transports-http/security-middleware-validation` is the legacy HTTP security Problem code. New
  runtime failures use `CROCO_HTTP_SECURITY_001` and may expose the old value as
  `extensions.legacyCode` during rollout.
- `unsafeSkipSecurityValidation: true` and `securityValidation: "off"` are compatibility escape
  hatches for local migration or tests; generated app CI and release evidence must remove them
  unless a fixture intentionally exercises the failure.
- `croco-openapi-spec --compatibility-schemas`, `croco-rpc-codegen --compatibility-schemas`, and
  `croco-rpc-codegen --compatibility-problems` are deprecated for 1.0 generated app evidence. They
  remain legacy migration opt-outs only.
- Root package entrypoints for importable spine packages are normalized through source-root
  `main`/`types` and npm-facing `publishConfig` dist entrypoints. Direct `./dist` root entrypoints
  must stay limited to checked package-manifest exceptions.

## Framework Context Sub-Surfaces

`@croco/framework-context` is intentionally a single import root for generated apps and framework
packages, but its 1.0 compatibility review is grouped by sub-surface in
`public-api-surface.snapshot.json`.

`pnpm public-api:check` enforces the `compatibilityGroups` table and per-export
`compatibilityGroup` tags for `@croco/framework-context`. A new public export must be explicitly
assigned to exactly one group by source and export name, and moving an export between groups is
reported as public API drift with the group owner, breaking-change policy, and generated app/doctor
coverage.

| Group                                          | Owner                                   | Breaking-change policy                                                                                                                                                 | Generated app / doctor coverage                                                 |
| ---------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| DI and dependency graph (`di`)                 | Framework Context DI owner              | Renames, removals, scope semantics, diagnostic-code changes, or graph manifest changes are breaking for DI consumers and generated apps.                               | create-croco-app generator imports DI primitives; `croco doctor` DI diagnostics |
| Request and runtime context (`context`)        | Framework Context request-context owner | `RequestContext`, `RuntimeContext`, transaction-context, and lifecycle field removals or semantic changes require a migration note and versioned compatibility review. | Generated app request context imports; doctor/project-map runtime context reads |
| Runtime policy (`runtime-policy`)              | Runtime policy owner                    | Policy table shape, policy kind/target constants, capability diagnostics, and execution-plan semantics are release-blocking compatibility changes.                     | `croco runtime-policy check`; `croco project-map` policy validation             |
| Runtime capability (`runtime-capability`)      | Runtime capability owner                | Capability names, platform names, manifest versions, diagnostic codes, and support matrix semantics are breaking unless versioned or explicitly migrated.              | `croco runtime-policy check`; generated app smoke workspace build               |
| Runtime inspector (`runtime-inspector`)        | Runtime inspector owner                 | Inspector record/timeline/event shape changes must preserve additive compatibility or document a versioned diagnostic migration.                                       | Generated app smoke workspace build; doctor/project-map runtime diagnostics     |
| Middleware and request pipeline (`middleware`) | Middleware pipeline owner               | Middleware callable shape, pipeline graph node/phase constants, and failure propagation changes require a documented migration path.                                   | Generated app request pipeline usage                                            |
| Shutdown lifecycle (`shutdown`)                | Shutdown lifecycle owner                | Shutdown hook signatures, timeout/configuration problem behavior, and signal listener semantics are breaking without migration guidance.                               | Generated app smoke workspace build                                             |

## Scope Definitions

`spine` is the 1.0 release-blocking compatibility scope. A spine package can be beta while stricter
1.0 gates are still being hardened.

`production-ready` is package maturity evidence from `maturity.production.packages`; it requires
README, generated API docs, package tests, Turbo task evidence, public API snapshot participation,
and applicable maturity evidence.

`beta` means the package has meaningful contract or runtime evidence but still lacks at least one
production-ready requirement.

`alpha` means the package can remain outside the 1.0 blocker set unless a generated-app golden path
or certified adapter path depends on it.

`certified adapter` is adapter/runtime/contract-specific evidence. Certification is separate from
both spine membership and production-ready maturity.

## Gate Mapping

| Gate                     | Current selector                                                                                    | Spine expectation                                                                                                                                                                                                                                                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Package manifest policy  | `pnpm package-manifests:check` validates package catalog and manifests                              | Importable spine packages use source-root `main`/`types` plus dist-only `publishConfig`, unless a checked direct-dist exception applies.                                                                                                                                                                                               |
| Public API snapshot      | `pnpm public-api:check` scans publishable package entrypoints                                       | Every spine package with `src/index.ts` participates in the snapshot or has an explicit package-level exemption. `@croco/framework-context` additionally reports grouped sub-surface drift.                                                                                                                                            |
| Package entrypoint smoke | `pnpm package-entrypoints:smoke` scans public package publish contracts                             | Every importable spine package must resolve ESM/CJS/types after build.                                                                                                                                                                                                                                                                 |
| First-success contract   | `pnpm first-success:verify`, `pnpm quick-start-lambda:smoke`, `pnpm saas-billing-golden-path:smoke` | Root README, getting-started docs, release spine docs, scaffold commands, and checked examples must point to the same first-success commands.                                                                                                                                                                                          |
| Contract tests           | `pnpm strict-contract-typecheck`, package tests, and generated contract smoke                       | Strict-contract mode derives the full spine from `docs/package-catalog.json`, requires every spine package to be enrolled or explicitly exempted, and reports added/removed/unchanged diagnostics. Protocol/OpenAPI/RPC/transport spine changes must keep contract graph, generated OpenAPI, RPC client, and diagnostics checks green. |
| Generated app smoke      | `pnpm create-croco-app:smoke`                                                                       | The golden generated app paths must exercise spine protocol, transport, CLI, and codegen packages without live third-party credentials.                                                                                                                                                                                                |
| Doctor JSON contract     | `@croco/cli` doctor snapshots plus `pnpm release-docs:check`                                        | `croco.doctor.v1` must keep healthy/failing JSON report snapshots stable; breaking doctor JSON changes require versioning or release notes.                                                                                                                                                                                            |
| Spine promotion check    | `pnpm spine-promotion:check`                                                                        | Beta spine packages must name an owner, target evidence, and recovery action before publish-sensitive dashboard steps.                                                                                                                                                                                                                 |
| Coverage policy          | `pnpm test:coverage:core:warning`                                                                   | `spine.packages` is a deterministic selection signal; missing spine packages are reported until included or temporarily justified.                                                                                                                                                                                                     |
| Bundle-size enforcement  | `pnpm package-quality:report -- --enforce-spine-bundle-size`                                        | Spine package generated artifacts may not grow over the committed bundle baseline; non-spine package bundle-size findings stay advisory.                                                                                                                                                                                               |

Non-spine beta or alpha packages do not block 1.0 by default. They become blocking only when a
golden generated app path, production-ready promotion, or certified adapter contract explicitly
depends on them.

## Strict Contract Release Debt

`tsconfig/contract-strict.baseline.json` is the strict-contract baseline and release debt manifest
for the spine. Its `packages` array lists enrolled spine packages, and `exemptions` lists any
intentionally excluded spine packages with an owner, reason, and expiry or target milestone. The two
lists must partition the package names derived from `docs/package-catalog.json`.

Diagnostic `deferrals` distinguish staged rollout debt from accepted 1.0 release debt:

- `staged-rollout` keeps the normal trunk gate stable while package owners burn down strict
  diagnostics before RC.
- `accepted-release-debt` is the only diagnostic debt class allowed in RC mode.

Run `pnpm strict-contract-typecheck --rc` or set `CROCO_STRICT_CONTRACT_RC=1` for the RC contract.
RC mode rejects added or removed diagnostics and rejects unchanged diagnostics unless their package
deferral is marked `accepted-release-debt`.

## Package Entrypoint Policy

Spine package root entrypoints follow the package entrypoint contract in
[Package Entrypoint Contract](package-entrypoint-contract.md). The default importable spine pattern
keeps root `main` and `types` on `./src/index.ts` for workspace tooling and keeps npm-facing
entrypoints under `publishConfig` on `./dist`. Any spine package that exposes `./dist` directly from
the root manifest must be listed as a rationale-bearing direct-dist exception in
`scripts/package-manifest-contracts.mjs`, and both `package-manifests:check` and
`package-entrypoints:smoke` check that the root face stays aligned with `publishConfig`.

## Follow-Up Issues

- [#1080](https://github.com/croco-dev/framework/issues/1080) tracks first alpha release, clean install smoke, and provenance evidence for the spine set.
- [#1082](https://github.com/croco-dev/framework/issues/1082) tracks the minimum `croco doctor` spine-readiness command.
- [#1083](https://github.com/croco-dev/framework/issues/1083) tracks the generated app smoke matrix baseline.
- [#1084](https://github.com/croco-dev/framework/issues/1084) tracks `ContractGraph v1` schema and snapshot format.
- [#1085](https://github.com/croco-dev/framework/issues/1085) and [#1086](https://github.com/croco-dev/framework/issues/1086) track ProblemRegistry manifests and drift gates.
- [#1087](https://github.com/croco-dev/framework/issues/1087) tracks `RuntimeCapabilityManifest v1`.
- [#1088](https://github.com/croco-dev/framework/issues/1088) tracks the `.croco/manifest` bundle.
- [#1089](https://github.com/croco-dev/framework/issues/1089) and [#1090](https://github.com/croco-dev/framework/issues/1090) track adapter certification records and validation.
- [#1093](https://github.com/croco-dev/framework/issues/1093) tracks the final 1.0 RC checklist that separates spine requirements from non-spine maturity.
