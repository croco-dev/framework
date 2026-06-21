---
title: Provider Maturity Gates
description: Release criteria for promoting Croco provider packages from alpha to beta and production-ready.
---

# Provider Maturity Gates

Provider maturity is a release signal. A provider can have package tests and still remain alpha when the tests only prove smoke behavior. Promotion requires evidence across documentation, contract behavior, operational readiness, and release hygiene.

## Rubric

| Dimension                    | Required evidence                                                                                                                                                 |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Package README               | Installation, configuration, runtime support, failure modes, and a minimal usage example are documented in `packages/<name>/README.md`.                           |
| Generated API docs           | Public exports are represented under `packages/docs/src/content/docs/api/<name>/` or the package has a tracked temporary exception.                               |
| Conformance tests            | The provider runs a reusable domain conformance harness for its public provider contract. Local mocks are acceptable for default CI; live tests must be optional. |
| Boundary validation          | Invalid keys, malformed requests, missing configuration, and unsupported options fail with deterministic Croco `Problem` types.                                   |
| Deterministic errors         | Provider-specific upstream errors are normalized so callers can distinguish not-found, validation, retryable, and terminal failures.                              |
| Diagnostics provider         | Promoted providers expose safe configuration and dependency readiness through `@croco/diagnostics-core` or a documented health/readiness hook.                    |
| Operational smoke            | A default no-credential smoke runs in CI. Real-backend smoke may run only when documented environment variables are present and must skip otherwise.              |
| Dependency/env documentation | Required secrets, optional settings, peer dependencies, migrations, and runtime assumptions are listed without leaking secret values.                             |
| Release notes                | Behavior changes include a changeset when a publishable package changes.                                                                                          |

## Maturity Levels

| Level            | Criteria                                                                                                                                                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Alpha            | The provider can be useful, but one or more rubric dimensions are missing or only package-local smoke tests exist. External services must not be required for default test runs.                                                                             |
| Beta             | The provider has README and API docs coverage, deterministic local tests for the main contract, documented env/dependencies, and no known contract-breaking gaps. It may still lack live-backend CI, diagnostics, or full operational evidence.              |
| Production-ready | The provider passes every rubric dimension, has reusable conformance coverage for its provider domain, exposes safe diagnostics/readiness, documents optional live smoke env vars, and has explicit evidence that no silent fallback hides upstream failure. |

## Current Harnesses

### Provider conformance matrix

`@croco/testing` exports `createProviderConformanceMatrixSuite()` for provider profile manifests.
The matrix is the shared inventory layer above category-specific suites:

- required capabilities must be marked supported and name the reusable conformance suite plus the
  public contract methods under test;
- optional unsupported capabilities must remain visible with a manifest reason instead of being
  skipped silently;
- failures include the package, category, capability, and method list so contract drift points to a
  concrete provider surface;
- supported categories currently include auth, billing, metering, storage, cache, tasks, search,
  telemetry, rate-limit, batch, triggers, Drizzle-backed providers, and LLM providers.

### Storage provider conformance

`@croco/testing` exports `createStorageProviderConformanceSuite()` for `@croco/storage-core` providers. The suite checks:

- buffer `put()` / `get()` round trips,
- readable stream upload and `getStream()` round trips,
- `delete()` and `exists()` behavior,
- deterministic not-found behavior for `get()`, `getStream()`, and `getMetadata()`,
- invalid key rejection across storage methods,
- public and signed URL generation without object-content leakage,
- required or optional metadata preservation, configured per provider.

The current `@croco/storage-core` `StorageProvider` contract does not expose `list()`. List behavior remains a future conformance gate if the storage contract adds it.

The first consumers are:

| Package                     | Harness evidence                                                                                                                                                                                                    | Promotion result                                                                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@croco/storage-r2`         | Uses the storage conformance suite with a stateful mocked S3/R2 backend, requires content type plus custom metadata preservation, exposes safe diagnostics/readiness, and documents an env-gated live R2 smoke.     | Remains beta. It passes default conformance and diagnostics locally, but production-ready still requires recorded optional live R2 smoke evidence with real credentials. |
| `@croco/storage-cloudflare` | Uses the storage conformance suite with an in-memory Cloudflare Images fetch backend. Metadata preservation is marked unsupported because the current provider metadata contract returns size and upload time only. | Remains alpha. It has shared contract coverage, but metadata limits, diagnostics, and live smoke documentation still block beta/production promotion.                    |

### Billing provider conformance

`@croco/testing` exports `createBillingProviderConformanceSuite()` for `@croco/billing-core`
providers. The suite checks:

- checkout creation with stable checkout IDs and HTTP(S) checkout URLs,
- customer ensure plus customer portal URL behavior,
- deferred cancel, resume, and immediate cancel subscription lifecycle calls,
- provider-specific failure scenarios surfacing Croco `Problem` instances,
- signed subscription and order webhook handling with stable event IDs,
- duplicate webhook delivery idempotency,
- invalid webhook signatures and structurally invalid payloads failing as Croco `Problem` instances.

The first consumer is:

| Package                | Harness evidence                                                                                                                                                                                   | Promotion result                                                                                                                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@croco/billing-polar` | Uses the billing conformance suite with deterministic mocked Polar gateway and webhook behavior, normalizes Polar SDK failures, exposes safe diagnostics, and documents optional live Polar smoke. | Remains beta. It has default conformance and diagnostics evidence, but production-ready still requires recorded env-gated live Polar smoke evidence with real Polar credentials. |

### Upstash and QStash provider conformance

`@croco/testing` exports two serverless provider suites for the first Upstash/QStash promotion
wave:

- `createUpstashRedisRateLimitConformanceSuite()` for Upstash Redis-backed rate-limit stores. It
  checks missing configuration, unsupported policies, allow/deny stats, refund idempotency,
  redacted retryable upstream failures, redacted terminal upstream failures, and no-credential
  live-smoke gates.
- `createQStashTaskConformanceSuite()` for QStash task publishers. It checks missing
  configuration, task envelope shape, delay/header/deduplication evidence, invalid task input,
  redacted retryable upstream failures, redacted terminal upstream failures, and no-credential
  live-smoke gates.

The first consumers are:

| Package                    | Harness evidence                                                                                                                        | Promotion result                                                                                                                                         |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@croco/ratelimit-upstash` | Runs the Upstash Redis rate-limit conformance suite with a mocked Redis/Lua fixture and an opt-in real-backend live-smoke gate.         | Remains alpha. Conformance now covers the rate-limit domain, but diagnostics/readiness and broader real Upstash backend smoke remain promotion blockers. |
| `@croco/tasks-qstash`      | Runs the QStash task conformance suite with a mocked QStash client, deduplication evidence, and an opt-in real-backend live-smoke gate. | Remains alpha. Conformance now covers task publishing, but webhook/schedule verification and diagnostics/readiness remain blockers.                      |

Remaining Upstash/QStash domains before beta promotion:

- `@croco/metering-upstash` needs a Redis usage-storage conformance consumer.
- `@croco/batch-qstash` needs a QStash batch/chunk scheduling conformance consumer.
- `@croco/triggers-qstash` needs QStash schedule and webhook verification conformance.
- All five providers still need safe diagnostics/readiness evidence and documented broader
  real-backend live smoke commands.

### Drizzle provider conformance

`@croco/testing` exports `createDrizzleProviderConformanceSuite()` for Drizzle-backed provider
packages. The suite does not force one repository interface across domains. Instead, each provider
supplies domain-specific checks under shared gates for:

- local schema and migration assumptions;
- transaction participation and rollback behavior;
- tenant isolation where the domain contract requires it;
- deterministic not-found, validation, duplicate, conflict, and retryable failure semantics.

Unsupported gates are represented as passing documentation cases with a required reason. A provider
therefore cannot silently skip a missing maturity dimension.

The current consumers are:

| Package                    | Harness evidence                                                                                                                                                                                                 | Remaining blockers                                                                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@croco/metering-drizzle`  | Uses an in-memory SQLite Drizzle fixture to check meter/usage schema, usage idempotency index, transaction commit/rollback, tenant isolation, missing-meter Problem codes, and usage-record duplicate semantics. | Validation and retryable failure semantics live outside the repository fixture; diagnostics/readiness and broader migration evidence remain open.      |
| `@croco/execution-drizzle` | Uses the shared suite to check execution schema columns plus deterministic `execution/not-found` and `execution/conflict` Problem codes for missing rows and unresolved idempotency races.                       | Store-level transaction participation, rollback, tenant isolation, validation, and retryable failure gates remain unsupported by the current contract. |

## First Promotion Wave

No provider is promoted to production-ready by intent alone.

| Candidate                | Current maturity | Evidence                                                                                                                                                                      | Gate result                                                                                                                                                              |
| ------------------------ | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@croco/storage-r2`      | Beta             | README, package tests, generated catalog entry, reusable storage conformance coverage with mocked R2 behavior, safe diagnostics/readiness, and env-gated optional live smoke. | Production gate still fails until optional live R2 smoke evidence with real credentials is recorded and reviewed.                                                        |
| `@croco/billing-polar`   | Beta             | README, package tests, generated catalog entry, reusable billing conformance coverage with mocked Polar behavior, stable Problem mapping, and safe diagnostics/readiness.     | Production gate still fails until optional live Polar smoke evidence with real credentials is recorded and reviewed.                                                     |
| Upstash/QStash providers | Alpha            | Shared conformance now covers `@croco/ratelimit-upstash` and `@croco/tasks-qstash`; package tests and catalog entries also exist for metering, batch, and triggers providers. | Beta gate fails until metering/batch/triggers consume reusable conformance and all providers expose diagnostics/readiness plus broader real-backend live smoke evidence. |
| Drizzle SaaS providers   | Alpha            | Package tests, catalog entries, and initial shared conformance consumers exist for `@croco/metering-drizzle` and `@croco/execution-drizzle`.                                  | Beta gate fails until the remaining Drizzle providers adopt the shared suite and close their unsupported transaction, tenant, and error-semantic gates.                  |

This page should be updated whenever a provider changes maturity in `docs/package-catalog.json`.
