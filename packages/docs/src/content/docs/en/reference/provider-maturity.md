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

| Package                     | Harness evidence                                                                                                                                                                                                                                                                                | Promotion result                                                                                                                                                         |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@croco/storage-r2`         | Uses the storage conformance suite with a stateful mocked S3/R2 backend, requires content type plus custom metadata preservation, exposes safe diagnostics/readiness, and documents an env-gated live R2 smoke.                                                                                 | Remains beta. It passes default conformance and diagnostics locally, but production-ready still requires recorded optional live R2 smoke evidence with real credentials. |
| `@croco/storage-cloudflare` | Uses the storage conformance suite with an in-memory Cloudflare Images fetch backend, exposes safe diagnostics/readiness, and includes an opt-in live-smoke gate. Metadata preservation is marked unsupported because the current provider metadata contract returns size and upload time only. | Remains alpha. It has shared contract coverage and readiness diagnostics, but Cloudflare Images metadata limits still block beta/production promotion.                   |
| `@croco/storage-cloudinary` | Uses the storage conformance suite with a mocked Cloudinary SDK/fetch backend, preserves custom metadata, reports content type as Cloudinary format metadata, exposes safe diagnostics/readiness, and includes an opt-in live-smoke gate.                                                       | Promoted to beta. It has default conformance and diagnostics evidence, but production-ready still requires recorded real-backend live Cloudinary smoke evidence.         |

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

`@croco/testing` exports serverless provider suites for the first Upstash/QStash promotion wave:

- `createUpstashRedisMeteringConformanceSuite()` for Upstash Redis-backed metering stores. It checks
  missing configuration, Redis usage write/read behavior, duplicate idempotency, redacted retryable
  upstream failures, redacted terminal upstream failures, and no-credential live-smoke gates.
- `createUpstashRedisRateLimitConformanceSuite()` for Upstash Redis-backed rate-limit stores. It
  checks missing configuration, unsupported policies, allow/deny stats, refund idempotency,
  redacted retryable upstream failures, redacted terminal upstream failures, and no-credential
  live-smoke gates.
- `createQStashBatchConformanceSuite()` for QStash batch chunk executors. It checks terminal chunk
  completion, next-chunk publish envelopes, idempotency key evidence, execution failure
  retryability preservation, redacted retryable and terminal upstream failures, and no-credential
  live-smoke gates.
- `createQStashTaskConformanceSuite()` for QStash task publishers. It checks missing
  configuration, task envelope shape, delay/header/deduplication evidence, invalid task input,
  redacted retryable upstream failures, redacted terminal upstream failures, and no-credential
  live-smoke gates.
- `createQStashTriggerConformanceSuite()` for QStash schedule and webhook handlers. It checks
  schedule sync payload evidence, invalid signature pre-dispatch behavior, verified webhook
  dispatch behavior, redacted schedule failure diagnostics, and no-credential live-smoke gates.

The first consumers are:

| Package                    | Harness evidence                                                                                                                                   | Promotion result                                                                                                                                         |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@croco/metering-upstash`  | Runs the Upstash Redis metering conformance suite with mocked usage and idempotency behavior plus an opt-in real-backend live-smoke gate.          | Remains alpha. Conformance now covers the metering domain, but diagnostics/readiness and broader real Upstash backend smoke remain promotion blockers.   |
| `@croco/ratelimit-upstash` | Runs the Upstash Redis rate-limit conformance suite with a mocked Redis/Lua fixture and an opt-in real-backend live-smoke gate.                    | Remains alpha. Conformance now covers the rate-limit domain, but diagnostics/readiness and broader real Upstash backend smoke remain promotion blockers. |
| `@croco/batch-qstash`      | Runs the QStash batch conformance suite with a mocked publish client, execution failure evidence, and an opt-in real-backend live-smoke gate.      | Remains alpha. Conformance now covers chunk publish and failure classification, but diagnostics/readiness and broader real QStash smoke remain blockers. |
| `@croco/tasks-qstash`      | Runs the QStash task conformance suite with a mocked QStash client, deduplication evidence, and an opt-in real-backend live-smoke gate.            | Remains alpha. Conformance now covers task publishing, but webhook/schedule verification and diagnostics/readiness remain blockers.                      |
| `@croco/triggers-qstash`   | Runs the QStash trigger conformance suite with mocked schedule sync, signature verification, dispatch, and an opt-in real-backend live-smoke gate. | Remains alpha. Conformance now covers schedule/webhook behavior, but diagnostics/readiness and broader real QStash Worker smoke remain blockers.         |

Remaining Upstash/QStash blockers before beta or production promotion:

- All five providers still need safe diagnostics/readiness evidence through
  `@croco/diagnostics-core` or a documented readiness hook.
- Cloudflare Worker readiness claims still need generated Worker smoke evidence.
- Broader real-backend smoke evidence must be recorded before any maturity promotion.
- QStash trigger webhook response codes are response diagnostics unless they originate from a thrown
  Croco `Problem`; only thrown Problems are expected in the generated Problem registry.

### Drizzle provider conformance

`@croco/testing` exports `createDrizzleProviderConformanceSuite()` for Drizzle-backed provider
packages. The suite does not force one repository interface across domains. Instead, each provider
supplies domain-specific checks under shared gates for:

- local schema and migration assumptions;
- diagnostics and readiness output that redacts database connection details;
- transaction participation and rollback behavior;
- tenant isolation where the domain contract requires it;
- deterministic not-found, validation, duplicate, conflict, and retryable failure semantics.

Unsupported gates are represented as passing documentation cases with a required reason. A provider
therefore cannot silently skip a missing maturity dimension.

The current consumers are:

| Package                          | Harness evidence                                                                                                                                                                                                                               | Remaining blockers                                                                                                                                               |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@croco/access-drizzle`          | Uses the shared suite to check relation schema, redacted readiness failures, tenant-scoped permission checks, missing relation denies, duplicate grant idempotency, and documented unsupported mutable conflict/retryable gates.               | Transaction participation and rollback are owned by caller-provided Drizzle boundaries.                                                                          |
| `@croco/audit-drizzle`           | Uses the shared suite to check audit schema, redacted readiness failures, tenant-scoped audit lookup, empty missing-tenant results, and documented unsupported transaction, validation, conflict, and retryable gates.                         | Async transaction and rollback evidence cannot be proven with the Better SQLite default fixture; broader migration evidence and real database smoke remain open. |
| `@croco/auth-drizzle`            | Uses the shared suite to check API key and role schemas, redacted readiness failures, tenant-scoped API key lookup, missing key results, invalid key Problem mapping, role duplicate idempotency, and unsupported conflict/retryable gates.    | Full session and tenant-mapping contracts still need domain-specific conformance beyond this first API key/role evidence.                                        |
| `@croco/customer-health-drizzle` | Uses the shared suite to check health score schema, redacted readiness failures, latest-score lookup, missing-score results, and documented append-only duplicate/conflict limits.                                                             | Transaction, tenant isolation, validation, and retryable failure gates remain owned outside the current store contract.                                          |
| `@croco/entitlements-drizzle`    | Uses the shared suite to check entitlement schema, redacted readiness failures, missing-rule results, read-only duplicate/conflict limits, and public registry row mapping.                                                                    | Tenant isolation is not part of the plan-scoped registry contract; write-path conformance remains outside this adapter.                                          |
| `@croco/execution-drizzle`       | Uses the shared suite to check execution schema columns, redacted readiness failures, and deterministic `execution/not-found` plus `execution/conflict` Problem codes for missing rows and unresolved races.                                   | Store-level transaction participation, rollback, tenant isolation, validation, and retryable failure gates remain unsupported by the current contract.           |
| `@croco/invitation-drizzle`      | Uses the shared suite to check invitation and domain-policy schemas, redacted readiness failures, transaction participation, tenant listing, missing invitation/policy results, duplicate upsert semantics, and stale-status conflict results. | Rollback and retryable failure gates remain owned by the caller's transaction and health-check boundaries.                                                       |
| `@croco/membership-drizzle`      | Uses the shared suite to check membership schema, redacted readiness failures, transaction participation, tenant/user lookup, missing membership results, and duplicate upsert semantics.                                                      | Rollback and retryable failure gates remain owned by the caller's transaction and health-check boundaries.                                                       |
| `@croco/metering-drizzle`        | Uses an in-memory SQLite Drizzle fixture to check meter/usage schema, redacted readiness failures, usage idempotency index, transaction commit/rollback, tenant isolation, missing-meter Problem codes, and usage-record duplicate semantics.  | Validation and retryable failure semantics live outside the repository fixture; broader migration evidence remains open.                                         |
| `@croco/onboarding-drizzle`      | Uses the shared suite to check onboarding state schema, redacted readiness failures, transaction participation, composite tenant/user lookup, missing-state results, and duplicate upsert semantics.                                           | Rollback and retryable failure gates remain owned by the caller's transaction and health-check boundaries.                                                       |
| `@croco/search-drizzle`          | Uses the shared suite to check caller-owned table requirements, redacted readiness failures, tenant propagation into search strategies, missing-tenant Problem mapping, unavailable capability errors, and strategy-unavailable errors.        | PostgreSQL-specific live search behavior and migration evidence remain opt-in rather than default CI evidence.                                                   |

### Search provider conformance

`@croco/search-meilisearch` currently uses a package-level conformance suite for the
`@croco/search-core` engine contract because a reusable search-provider harness is not yet shared
from `@croco/testing`.

| Package                     | Harness evidence                                                                                                                                                                                                                                                                                                        | Promotion result                                                                                                                                                        |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@croco/search-meilisearch` | Package tests cover index lifecycle, task waiting, document upsert/delete, query filters, pagination, sort, tenant isolation, tenant-token filters, missing config, invalid inputs, index-not-found, retryable upstream failures, terminal upstream failures, safe diagnostics, and env-gated live smoke skip behavior. | Promoted to beta. It has default contract and diagnostics evidence, but production-ready still requires recorded live Meilisearch smoke evidence with real credentials. |

## First Promotion Wave

No provider is promoted to production-ready by intent alone.

| Candidate                   | Current maturity | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Gate result                                                                                                                                                                                                                          |
| --------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@croco/storage-r2`         | Beta             | README, package tests, generated catalog entry, reusable storage conformance coverage with mocked R2 behavior, safe diagnostics/readiness, and env-gated optional live smoke.                                                                                                                                                                                                                                                                                  | Production gate still fails until optional live R2 smoke evidence with real credentials is recorded and reviewed.                                                                                                                    |
| `@croco/billing-polar`      | Beta             | README, package tests, generated catalog entry, reusable billing conformance coverage with mocked Polar behavior, stable Problem mapping, and safe diagnostics/readiness.                                                                                                                                                                                                                                                                                      | Production gate still fails until optional live Polar smoke evidence with real credentials is recorded and reviewed.                                                                                                                 |
| `@croco/search-meilisearch` | Beta             | README, generated API docs, generated catalog entry, package-level search conformance, tenant-token tests, deterministic Meilisearch Problem normalization, safe diagnostics/readiness, and env-gated optional live smoke.                                                                                                                                                                                                                                     | Production gate still fails until optional live Meilisearch smoke evidence with real credentials is recorded and reviewed.                                                                                                           |
| Upstash/QStash providers    | Alpha            | Shared conformance now covers `@croco/metering-upstash`, `@croco/ratelimit-upstash`, `@croco/batch-qstash`, `@croco/tasks-qstash`, and `@croco/triggers-qstash`.                                                                                                                                                                                                                                                                                               | Beta gate fails until all providers expose diagnostics/readiness and recorded real-backend plus Worker smoke evidence.                                                                                                               |
| Drizzle SaaS providers      | Beta             | Package tests, generated API entrypoints, catalog entries, redacted Drizzle readiness evidence, and shared conformance consumers now cover `@croco/access-drizzle`, `@croco/audit-drizzle`, `@croco/auth-drizzle`, `@croco/customer-health-drizzle`, `@croco/entitlements-drizzle`, `@croco/execution-drizzle`, `@croco/invitation-drizzle`, `@croco/membership-drizzle`, `@croco/metering-drizzle`, `@croco/onboarding-drizzle`, and `@croco/search-drizzle`. | Production gate still fails until the documented unsupported transaction, rollback, tenant, validation, duplicate, conflict, retryable, migration, and live-backend smoke gates are closed or recorded as permanent contract limits. |

This page should be updated whenever a provider changes maturity in `docs/package-catalog.json`.
