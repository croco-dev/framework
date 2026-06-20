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

## First Promotion Wave

No provider is promoted to production-ready by intent alone.

| Candidate                | Current maturity | Evidence                                                                                                                                                                      | Gate result                                                                                                                                                              |
| ------------------------ | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@croco/storage-r2`      | Beta             | README, package tests, generated catalog entry, and reusable storage conformance coverage with mocked R2 behavior.                                                            | Production gate fails until diagnostics/readiness and optional live R2 smoke are documented and passing.                                                                 |
| `@croco/billing-polar`   | Beta             | README, package tests, generated catalog entry, and documented billing features.                                                                                              | Production gate fails until billing gateway conformance, safe diagnostics/readiness, and optional live Polar smoke are documented and passing.                           |
| Upstash/QStash providers | Alpha            | Shared conformance now covers `@croco/ratelimit-upstash` and `@croco/tasks-qstash`; package tests and catalog entries also exist for metering, batch, and triggers providers. | Beta gate fails until metering/batch/triggers consume reusable conformance and all providers expose diagnostics/readiness plus broader real-backend live smoke evidence. |
| Drizzle SaaS providers   | Alpha            | Package tests and catalog entries exist for access, audit, auth, customer health, entitlements, execution, invitation, membership, metering, onboarding, and search adapters. | Beta gate fails until a shared Drizzle provider conformance suite covers migration/schema assumptions, transaction behavior, and repository errors.                      |

This page should be updated whenever a provider changes maturity in `docs/package-catalog.json`.
