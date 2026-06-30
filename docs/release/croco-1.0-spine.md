# Croco 1.0 Spine

The Croco 1.0 spine is the release-critical package set whose public API, diagnostics, generated
artifacts, runtime contracts, and release evidence define the 1.0 compatibility surface.

The machine-readable source of truth is `docs/package-catalog.json` `spine.packages`.

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

| Gate                     | Current selector                                                              | Spine expectation                                                                                                                       |
| ------------------------ | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Public API snapshot      | `pnpm public-api:check` scans publishable package entrypoints                 | Every spine package with `src/index.ts` participates in the snapshot or has an explicit package-level exemption.                        |
| Package entrypoint smoke | `pnpm package-entrypoints:smoke` scans public package publish contracts       | Every importable spine package must resolve ESM/CJS/types after build.                                                                  |
| Contract tests           | `pnpm strict-contract-typecheck`, package tests, and generated contract smoke | Protocol/OpenAPI/RPC/transport spine changes must keep contract graph, generated OpenAPI, RPC client, and diagnostics checks green.     |
| Generated app smoke      | `pnpm create-croco-app:smoke`                                                 | The golden generated app paths must exercise spine protocol, transport, CLI, and codegen packages without live third-party credentials. |
| Coverage policy          | `pnpm test:coverage:core:warning`                                             | `spine.packages` is a deterministic selection signal; missing spine packages are reported until included or temporarily justified.      |

Non-spine beta or alpha packages do not block 1.0 by default. They become blocking only when a
golden generated app path, production-ready promotion, or certified adapter contract explicitly
depends on them.

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
