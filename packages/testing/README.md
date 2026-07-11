# @croco/testing

First-class test harness utilities for Croco applications.

```typescript
import { createTestingApp } from "@croco/testing";

const app = createTestingApp({ controllers: [UserController] });
const response = await app.get("/users");
```

## API

| Helper                                                | Purpose                                                                                                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `createTestingApp(config)`                            | Creates an isolated `CrocoApp` with seeded test defaults and HTTP request helpers.                                                         |
| `createTestingHarness(app)`                           | Wraps an existing `CrocoApp` with the same request and contract helpers.                                                                   |
| `createEventTestingHarness(config)`                   | Creates an isolated in-memory event bus and dispatches decorated handlers.                                                                 |
| `createTestingRequestContext(config)`                 | Builds a deterministic request/runtime context for service tests.                                                                          |
| `runWithTestingContext(fn, config)`                   | Runs code inside Croco `Context` and clears AsyncLocalStorage state when execution completes.                                              |
| `createTestingTransactionContext(config)`             | Provides explicit in-transaction and after-commit hook behavior for tests.                                                                 |
| `resetCrocoTestingContext()`                          | Resets the Croco DI container and seeds test logger/error/health defaults.                                                                 |
| `installTestingTelemetryCapture()`                    | Captures spans in memory without starting an SDK exporter.                                                                                 |
| `createFailureDrillCatalog()`                         | Builds deterministic no-credential failure drills for provider timeout, duplicate delivery, outbox, telemetry, tenant, and quota failures. |
| `runFailureDrills(cases)`                             | Executes failure drills and rejects runs that lack the expected Problem code, recovery action, telemetry evidence, or audit evidence.      |
| `createOperationalFailureDrillMatrix(cases)`          | Validates the exact ordered operational incident matrix without changing the generic six-scenario catalog.                                 |
| `runOperationalFailureDrills(cases)`                  | Executes operational fixtures and verifies their Problem or diagnostic outcome, recovery action, and real-boundary provenance.             |
| `assertProblemResponse(response, expected)`           | Verifies an RFC 7807 Problem Details response without depending on a test runner.                                                          |
| `assertOpenAPIRoute(controllersOrSpec, expected)`     | Verifies generated OpenAPI route metadata and response contracts.                                                                          |
| `createRpcTestFetch(app)`                             | Returns a fetch-compatible function that routes generated RPC clients into the in-memory app.                                              |
| `createAuthProviderConformanceSuite(config)`          | Reusable auth provider cases for token/session auth, webhooks, tenant mapping, readiness, and live-smoke gating.                           |
| `createStorageProviderConformanceSuite(config)`       | Reusable storage provider contract cases for default no-credential CI.                                                                     |
| `createProviderConformanceMatrixSuite(config)`        | Validates provider profile manifests for required capabilities, optional unsupported reasons, and method evidence.                         |
| `createLlmProviderConformanceSuite(config)`           | Reusable LLM provider contract cases for mocked or live provider fixtures.                                                                 |
| `createBillingProviderConformanceSuite(config)`       | Builds runner-neutral billing gateway and webhook conformance cases for provider packages.                                                 |
| `createUpstashRedisMeteringConformanceSuite(config)`  | Reusable Upstash Redis metering cases for config, usage storage, idempotency, upstream errors, and live-smoke gating.                      |
| `createUpstashRedisRateLimitConformanceSuite(config)` | Reusable Upstash Redis rate-limit cases for config, errors, refund idempotency, and live-smoke gating.                                     |
| `createQStashTaskConformanceSuite(config)`            | Reusable QStash task publish cases for config, validation, idempotency, upstream errors, and live-smoke gating.                            |
| `createQStashBatchConformanceSuite(config)`           | Reusable QStash batch chunk cases for terminal chunks, continuation envelopes, upstream errors, and live-smoke gating.                     |
| `createQStashTriggerConformanceSuite(config)`         | Reusable QStash trigger cases for schedule sync, webhook verification, dispatch, upstream diagnostics, and live-smoke gating.              |
| `createDrizzleProviderConformanceSuite(config)`       | Builds reusable Drizzle provider cases for schema, transaction, tenant, and error contracts.                                               |
| `assertDrizzleProblem(operation, expected)`           | Verifies Drizzle provider failures surface stable Croco Problem codes, categories, or status.                                              |

## Isolation Contract

`createTestingApp`, `createEventTestingHarness`, and `resetCrocoTestingContext` reset the Croco DI
container, install a silent logger, replace the health/error defaults, and seed an inactive
`TestingTransactionContext` unless `transactionContext: false` is passed. Request helpers execute
through the real HTTP route registrar and `Context.run`, so request-scoped dependencies and
AsyncLocalStorage cleanup match the runtime path.

The harness intentionally does not start a Node server, Lambda adapter, Cloudflare execution
context, OpenTelemetry SDK exporter, real database transaction, or external event broker. Use
`createTestingRequestContext` to model runtime capabilities explicitly, `TestingTransactionContext`
to flush after-commit hooks, and `installTestingTelemetryCapture` to assert span names, attributes,
events, status, and recorded exceptions in memory.

`installTestingTelemetryCapture` installs an OpenTelemetry tracer provider for the current process.
Call it before initializing a real telemetry SDK in the same test process. Repeated calls are
supported for isolated captures, including overlapping `capture.run()` blocks, but OpenTelemetry
does not expose a safe provider reset API after a different provider has already been installed.

## Failure Drills

`createFailureDrillCatalog()` returns deterministic, zero-credential drills for provider timeout,
webhook duplicate delivery, outbox relay crash, telemetry exporter failure, missing tenant context,
and quota exhaustion. `runFailureDrills()` executes those scenarios and fails the test run unless
each drill returns:

- the expected RFC 7807 Problem code/status/title;
- the expected recovery action;
- telemetry evidence for the failed path;
- audit evidence for the failed path.

Generated apps can override individual catalog entries with app-backed scenarios while keeping the
same evidence contract. This keeps failure injection in smoke/test code instead of adding production
fallback branches.

### Operational failure evidence

`createOperationalFailureDrillMatrix()` is the additive contract for generated-app and release
evidence. It requires all eight operational incidents in this order: missing provider environment,
unavailable telemetry exporter, missing DI provider, DI scope mismatch, route validation failure,
rate-limit exhaustion, unavailable auth verifier, and invalid webhook signature. The provider
environment incident remains a diagnostic; the other incidents preserve their owning Problem
contracts. A diagnostic-only boundary is never relabeled as a Problem.

Each scenario declares its expected stable code and may declare status, title, type, structured
extensions, and related diagnostics. `runOperationalFailureDrills()` also requires an exact recovery
action and fixture provenance naming the real boundary under test. It emits the deterministic,
timestamp-free `croco.operational-failure-drills/v1` report with top-level ordered `scenarioIds` and
`outcomeKinds`. Use `serializeOperationalFailureDrillReport()` and
`renderOperationalFailureDrillMarkdown()` to retain matching JSON and Markdown evidence.

## Event Handlers

```typescript
import { createEventTestingHarness } from "@croco/testing";
import { DomainEvent, RegisterEventHandler, type EventHandler } from "@croco/events-core";

class UserCreatedEvent extends DomainEvent {
  static eventName = "user.created";
}

@RegisterEventHandler(UserCreatedEvent)
class UserCreatedHandler implements EventHandler<UserCreatedEvent> {
  handle(event: UserCreatedEvent) {
    // Assert side effects against in-memory collaborators.
  }
}

const events = await createEventTestingHarness({ handlers: [UserCreatedHandler] });
await events.dispatch(new UserCreatedEvent());
```

## Provider Conformance

Provider conformance helpers return named cases so packages can wire them into their own test
runners with `it.each(...)`. Default cases use mocks or package-local fixtures and must not require
provider credentials. Optional live-smoke cases are represented by an explicit environment gate, so
CI skips them unless the provider package intentionally enables real backend credentials.

`createProviderConformanceMatrixSuite()` gives provider packages a shared profile manifest shape for
auth, billing, metering, storage, cache, tasks, search, telemetry, and adjacent provider categories.
Supported required capabilities must name the reusable suite plus the public contract methods under
test. Unsupported optional capabilities are passing documentation cases only when they include a
reason in the manifest. Unsupported required capabilities fail with a package/category/capability
message that includes the affected methods.

### Conformance Compatibility Contract

The conformance helpers are a public package contract for downstream provider packages. The root
`@croco/testing` entrypoint exports every conformance helper, and `@croco/testing/drizzle` exports
the Drizzle-specific helper pair for packages that only need Drizzle contracts.

Downstream packages may depend on:

- helper export names listed in the API table;
- `suite.cases[].name` values for runner wiring, snapshots, and generated provider reports;
- required provider matrix manifest fields `name`, `required`, `supported`, and `methods`, plus
  optional fields `suite`, `reason`, and `evidence` when emitted;
- auth tenant evidence field `externalOrgId`;
- failure-drill evidence fields `kind` and `name`;
- optional QStash publish and schedule evidence fields when emitted, plus required trigger sync
  evidence fields `action` and `applied`.

Removing or renaming a helper, removing an entrypoint, changing a case name, or changing a required
evidence/manifest field is a breaking change. Removing or renaming a documented optional evidence
field is also breaking when that field is emitted. Additive optional evidence and new optional cases
are allowed when they remain documented and keep live smoke paths explicitly environment-gated.

The billing provider helper currently covers:

- `createBillingProviderConformanceSuite()` for `@croco/billing-core` providers: checkout
  creation, customer portal access, subscription cancel/resume lifecycle behavior, optional
  provider failure scenarios, signed webhook handling, webhook idempotency, and invalid webhook
  rejection as Croco `Problem` instances.

The auth provider helper currently covers:

- `createAuthProviderConformanceSuite()` for `@croco/auth-core` providers: valid auth, missing and
  invalid credentials, malformed provider payloads, redacted upstream auth failures, signed webhook
  success/failure, malformed webhook payloads, provider organization to Croco tenant evidence,
  missing/ready diagnostics output, and explicit no-credential live-smoke gates.

The serverless provider helpers currently cover:

- `createUpstashRedisMeteringConformanceSuite()` for Upstash Redis-backed metering clients:
  missing config, usage storage command adaptation, idempotency no-ops, redacted retryable and
  terminal upstream failures, and no-credential live-smoke gates.
- `createUpstashRedisRateLimitConformanceSuite()` for Upstash Redis-backed rate-limit stores:
  missing config, unsupported policy, allow/deny stats, refund idempotency, redacted retryable and
  terminal upstream failures, and no-credential live-smoke gates.
- `createQStashTaskConformanceSuite()` for QStash task publishers: missing config, task envelope
  shape, delay/header/deduplication evidence, invalid task input, redacted retryable and terminal
  upstream failures, and no-credential live-smoke gates.
- `createQStashBatchConformanceSuite()` for QStash-backed batch continuations: terminal chunks,
  continuation envelopes, execution failure evidence, redacted retryable and terminal upstream
  failures, and no-credential live-smoke gates.
- `createQStashTriggerConformanceSuite()` for QStash-backed trigger schedules: schedule sync
  evidence, webhook signature rejection, verified dispatch, redacted retryable and terminal
  schedule diagnostics, and no-credential live-smoke gates.

## Drizzle Provider Conformance

`createDrizzleProviderConformanceSuite` keeps Drizzle-backed SaaS provider tests on one evidence
shape without forcing every provider into one repository interface. Each consumer supplies the
provider-specific operations for:

- local schema or migration assumptions;
- diagnostics/readiness output that redacts database connection details;
- transaction participation and rollback behavior;
- tenant-aware data isolation;
- not-found, validation, duplicate, conflict, and retryable failure semantics.

Unsupported capabilities are explicit test cases with a required reason. That keeps alpha-provider
blockers visible in CI instead of silently skipping them.
