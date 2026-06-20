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

| Package                     | Harness evidence                                                                                                                                                                                                    | Promotion result                                                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@croco/storage-r2`         | Uses the storage conformance suite with a stateful mocked S3/R2 backend and requires content type plus custom metadata preservation.                                                                                | Remains beta. It passes default conformance locally, but production-ready still requires safe diagnostics/readiness and documented optional live R2 smoke evidence. |
| `@croco/storage-cloudflare` | Uses the storage conformance suite with an in-memory Cloudflare Images fetch backend. Metadata preservation is marked unsupported because the current provider metadata contract returns size and upload time only. | Remains alpha. It has shared contract coverage, but metadata limits, diagnostics, and live smoke documentation still block beta/production promotion.               |

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

## First Promotion Wave

No provider is promoted to production-ready by intent alone.

| Candidate                | Current maturity | Evidence                                                                                                                                                                      | Gate result                                                                                                                                         |
| ------------------------ | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@croco/storage-r2`      | Beta             | README, package tests, generated catalog entry, and reusable storage conformance coverage with mocked R2 behavior.                                                            | Production gate fails until diagnostics/readiness and optional live R2 smoke are documented and passing.                                            |
| `@croco/billing-polar`   | Beta             | README, package tests, generated catalog entry, reusable billing conformance coverage with mocked Polar behavior, stable Problem mapping, and safe diagnostics/readiness.     | Production gate still fails until optional live Polar smoke evidence with real credentials is recorded and reviewed.                                |
| Upstash/QStash providers | Alpha            | Package tests and catalog entries exist for rate limit, metering, batch, tasks, and triggers providers.                                                                       | Beta gate fails until reusable Redis/QStash conformance suites and diagnostics/readiness evidence exist.                                            |
| Drizzle SaaS providers   | Alpha            | Package tests and catalog entries exist for access, audit, auth, customer health, entitlements, execution, invitation, membership, metering, onboarding, and search adapters. | Beta gate fails until a shared Drizzle provider conformance suite covers migration/schema assumptions, transaction behavior, and repository errors. |

This page should be updated whenever a provider changes maturity in `docs/package-catalog.json`.
