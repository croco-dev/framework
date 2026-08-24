# @croco/testing

First-class test harness utilities for Croco applications.

```typescript
import { createTestingApp } from "@croco/testing";

const app = createTestingApp({ controllers: [UserController] });
const response = await app.get("/users");
```

Production-parity tests pass the same bootstrap export used by the deployed application:

```typescript
import { createTestKernel, fixedClock, seededIds } from "@croco/testing";
import { createCrocoApp } from "../app";

await using test = await createTestKernel({
  bootstrap: createCrocoApp,
  fidelity: "application",
});

const response = await test.http.get("/health");
expect(test.fidelity).toEqual({
  boot: "application",
  runtime: "node",
  validation: "production",
});
```

Deterministic scenarios opt into kernel-owned controls instead of patching process globals:

```typescript
await using test = await createTestKernel({
  bootstrap: createCrocoApp,
  clock: fixedClock("2026-01-01T00:00:00Z"),
  fidelity: "application",
  ids: seededIds("invitation-retry"),
  network: "deny",
  scenarioId: "invitation-retry",
});

await test.clock.advanceBy("30s");
test.expectClean();
```

## API

| Helper                                                | Purpose                                                                                                                                      |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `createTestingApp(config)`                            | Creates an isolated `CrocoApp` with seeded test defaults and HTTP request helpers.                                                           |
| `createTestKernel(config)`                            | Boots the real application bootstrap inside an isolated runtime scope and reports application or adapter fidelity as structured evidence.    |
| `fixedClock(initial)` / `seededIds(seed)`             | Creates virtual time and deterministic IDs/random values for TestKernel-controlled retry, timeout, rate-limit, task, and provider fixtures.  |
| `createTestingHarness(app)`                           | Wraps an existing `CrocoApp` with the same request and contract helpers.                                                                     |
| `createEventTestingHarness(config)`                   | Creates an isolated in-memory event bus and dispatches decorated handlers.                                                                   |
| `createTestingRequestContext(config)`                 | Builds a deterministic request/runtime context for service tests.                                                                            |
| `runWithTestingContext(fn, config)`                   | Runs code inside Croco `Context` and clears AsyncLocalStorage state when execution completes.                                                |
| `createTestingTransactionContext(config)`             | Provides explicit in-transaction and after-commit hook behavior for tests.                                                                   |
| `resetCrocoTestingContext()`                          | Resets the Croco DI container and seeds test logger/error/health defaults.                                                                   |
| `installTestingTelemetryCapture()`                    | Captures spans in memory without starting an SDK exporter.                                                                                   |
| `createFailureDrillCatalog()`                         | Builds deterministic no-credential failure drills for provider timeout, duplicate delivery, outbox, telemetry, tenant, and quota failures.   |
| `runFailureDrills(cases)`                             | Executes failure drills and rejects runs that lack the expected Problem code, recovery action, telemetry evidence, or audit evidence.        |
| `createOperationalFailureDrillMatrix(cases)`          | Validates the exact ordered operational incident matrix without changing the generic six-scenario catalog.                                   |
| `runOperationalFailureDrills(cases)`                  | Executes operational fixtures and verifies their Problem or diagnostic outcome, recovery action, and real-boundary provenance.               |
| `assertProblemResponse(response, expected)`           | Verifies an RFC 7807 Problem Details response without depending on a test runner.                                                            |
| `assertOpenAPIRoute(controllersOrSpec, expected)`     | Verifies generated OpenAPI route metadata and response contracts.                                                                            |
| `createRpcTestFetch(app)`                             | Returns a fetch-compatible function that routes generated RPC clients into the in-memory app.                                                |
| `createAuthProviderConformanceSuite(config)`          | Reusable auth provider cases for token/session auth, webhooks, tenant mapping, readiness, and live-smoke gating.                             |
| `createStorageProviderConformanceSuite(config)`       | Reusable storage provider contract cases for default no-credential CI.                                                                       |
| `createProviderConformanceMatrixSuite(config)`        | Validates provider profile manifests for required capabilities, optional unsupported reasons, and method evidence.                           |
| `createLlmProviderConformanceSuite(config)`           | Reusable LLM provider contract cases for mocked or live provider fixtures.                                                                   |
| `createBillingProviderConformanceSuite(config)`       | Builds runner-neutral billing gateway and webhook conformance cases for provider packages.                                                   |
| `createNotificationProviderConformanceSuite(config)`  | Verifies explicit notification provider capability profiles through `@croco/testing/notifications`.                                          |
| `createUpstashRedisMeteringConformanceSuite(config)`  | Reusable Upstash Redis metering cases for config, usage storage, idempotency, upstream errors, and live-smoke gating.                        |
| `createUpstashRedisRateLimitConformanceSuite(config)` | Reusable Upstash Redis rate-limit cases for config, errors, refund idempotency, and live-smoke gating.                                       |
| `createQStashTaskConformanceSuite(config)`            | Reusable QStash task publish cases for config, validation, idempotency, upstream errors, and live-smoke gating.                              |
| `createQStashBatchConformanceSuite(config)`           | Reusable QStash batch chunk cases for terminal chunks, continuation envelopes, upstream errors, and live-smoke gating.                       |
| `createQStashTriggerConformanceSuite(config)`         | Reusable QStash trigger cases for schedule sync, webhook verification, dispatch, upstream diagnostics, and live-smoke gating.                |
| `createDrizzleProviderConformanceSuite(config)`       | Builds reusable Drizzle provider cases for schema, transaction, tenant, and error contracts.                                                 |
| `assertDrizzleProblem(operation, expected)`           | Verifies Drizzle provider failures surface stable Croco Problem codes, categories, or status.                                                |
| `createTestEvidenceRecord(input)`                     | Builds validated `croco.test-evidence/v1` records and derives flaky outcomes from retained attempts.                                         |
| `createTestEvidenceBundle(records, artifactExists)`   | Deterministically aggregates runner-neutral evidence and reports every missing required attachment.                                          |
| `createChangedTestPlan(input)`                        | Derives an explainable changed-test plan from assurance graph diffs, evidence, changed paths, and conservative fallbacks.                    |
| `updateChangedTestSelectionBaseline(plan, evidence)`  | Records shadow-run coverage and selection misses across a bounded observation window.                                                        |
| `assertChangedTestSelectionBaseline(value)`           | Validates restored changed-test baseline artifacts before they influence shadow or enforcement decisions.                                    |
| `assertChangedTestPlanEnforceable(baseline)`          | Rejects enforcement until the configured complete observation window and miss threshold are satisfied.                                       |
| `createContractCaseArbitrary(route)`                  | Builds a bounded fast-check arbitrary from a supported ContractGraph route and its Zod v3 input schemas.                                     |
| `createFileContractFailureSink(directory)`            | Persists shrunk contract-fuzz failures as JSON artifacts in a deterministic local directory.                                                 |
| `runContractFuzz(options)`                            | Runs a bounded deterministic fast-check profile against ContractGraph request and response/Problem schemas and persists replayable failures. |
| `runContractRuntimeDifferential(options)`             | Compares one scenario across Node, Lambda, and Cloudflare observations, allowing lifecycle differences only through capability declarations. |
| `CrocoVitestEvidenceReporter`                         | Adapts Vitest results and retries into the common evidence model without replacing Vitest.                                                   |
| `CrocoPlaywrightEvidenceReporter`                     | Adapts Playwright attempts, traces, screenshots, and reports without replacing Playwright.                                                   |

## Isolation Contract

`createTestingApp()` is the compatibility harness for explicitly isolated controller/provider
graphs. Its structured fidelity is always
`{ boot: "isolated", runtime: "node", validation: "isolated" }`; its results must not be presented
as production-parity evidence.

`createTestKernel()` is runner-neutral and calls the supplied production bootstrap function exactly
once inside a scoped runtime. Application fidelity requires the effective DI and security validation
policies to both be `enforce`. A lower policy must be stated through `validation`, and the resulting
fidelity is marked `overridden`. Adapter fidelity supports Node and Lambda request lifecycles without
opening a public network port. Each kernel owns its DI values, component registrations, event
configuration, request execution, and evidence buffer. Its `transactionContext` is isolated test
evidence and is not registered under the production transaction token; production bootstrap remains
responsible for registering its real transaction provider. `dispose()` and `Symbol.asyncDispose` run
cleanup once; cleanup failures reject with `TestKernelDisposalProblem`. A bootstrap that acquires
resources before it can return an app can call `context.onCleanup()` so failure-path cleanup is also
guaranteed.

## Deterministic Runtime Controls

Each `TestKernel` owns a `clock`, `ids`, `random`, `environment`, `network`, and `replay` record.
The bootstrap callback receives the same controls, so production code can consume existing explicit
dependency seams instead of requiring a test-only branch. For example, pass `context.retry` to
retry backoff dependencies, `() => context.clock.now` to an
`InMemoryIdempotencyStore`, and `() => context.clock.now.getTime()` plus `context.random.next` to
an in-memory rate-limit store. Task timeout runners accept the same clock through
`now: () => context.clock.now.getTime()` and schedule timeouts with
`(callback, delayMs) => context.clock.schedule(callback, delayMs, "task-timeout")`.
`TestClock.schedule()` is for Croco-owned scheduler boundaries; `advanceBy()` and `drain()` run
only that queued work deterministically.

Environment overrides are immutable per-kernel snapshots. They do not mutate `process.env`, which
makes concurrent kernels safe and leaves the ambient environment unchanged. `network: "deny"` is
the default and rejects calls made through `context.network.fetch()` with a stable host and recovery
diagnostic. It intentionally does not intercept arbitrary `globalThis.fetch` calls. Use explicit
runtime dependencies for provider calls rather than global monkey patches.

`test.expectClean()` reports pending virtual scheduled work, explicit `test.track()` operations, and
pending after-commit hooks with category and source evidence. Use `test.waitUntil()`,
`test.trackEventHandler()`, `test.trackSpan()`, or `test.trackResource()` at the matching adapter
boundary so those outstanding operations are included too. `test.replay` records the scenario ID,
seed, and virtual time needed to reproduce a failing deterministic scenario. User-owned timers,
promises, and network calls outside these explicit boundaries remain outside the virtual scheduler.
Fast-check-driven contract failures may also store a replay `path`, `runtime`, and JSON-safe
`counterexample` so the shrunk case can be replayed without reconstructing the original test input.

## Contract-guided fuzzing and runtime differential

`runContractFuzz()` consumes a `ContractGraphRoute` and a caller-supplied runtime executor. The
default `pr` profile runs 32 cases with a stable seed; `nightly` runs 512 and `manual` runs 2,048.
`numRuns`, `seed`, and fast-check replay `path` remain explicit overrides, so CI budgets cannot
silently expand. Generated cases include both schema-valid and schema-invalid transport inputs. A
schema-valid request may return either the declared success schema or any declared Problem union;
the runner does not assume that every valid request is a business success.

The built-in generator supports Zod v3 strings with `min`/`max`, numbers with `min`/`max`/`int`,
booleans, JSON-safe literals, enums and native enums, objects, arrays, tuples, unions,
discriminated unions, optional/nullable/default wrappers. Refinements, transforms, records, maps,
sets, promises, lazy schemas, `any`, `unknown`, and other generation shapes fail with
`testing/contract-generation-unsupported`. Supply an explicit fast-check arbitrary when domain
generation requires one of those shapes; Croco does not guess domain-valid state.

Every failure is shrunk and written to `.croco/contract-failures` by default. The versioned artifact
retains the runtime, seed, counterexample path, minimal input, stable diagnostic, and replay command.
Replay commands scope the seed and shrink path to the matching route and runtime, so other contract
suites in the same test command keep their configured profiles. Set `replayCommand` when the owning
suite has a narrower test command than `pnpm test`.
Use `createFileContractFailureSink(directory)` to choose another location or provide a
`ContractFailureSink` for an existing artifact store. Each generated request carries an
`x-croco-fuzz-canary` value. Executors should merge `input.transportHeaders` after the
schema-owned `input.headers`, then return captured response, log, span, and serialized observations
so reflection is checked across every surface without invalidating strict header schemas.

`runContractRuntimeDifferential()` executes the same generated case through supplied Node, Lambda,
and Cloudflare Workers executors. Status, success-versus-Problem schema, Problem code, stable
headers, and trace propagation must match. Streaming, deadline, abort signal, `waitUntil`, flush,
and shutdown observations must be reported for every runtime and must agree with that runtime's
capability manifest. A behavioral difference is allowed only where the compared manifests declare
different support; an undeclared difference fails with `testing/contract-runtime-mismatch`.

`createTestingApp`, `createEventTestingHarness`, and `resetCrocoTestingContext` reset the root Croco DI
container, install a silent logger, replace the health/error defaults, and seed an inactive
`TestingTransactionContext` unless `transactionContext: false` is passed. Request helpers execute
through the real HTTP route registrar and `Context.run`, so request-scoped dependencies and
AsyncLocalStorage cleanup match the runtime path.

The compatibility harness intentionally does not start a Node server, Lambda adapter, Cloudflare execution
context, OpenTelemetry SDK exporter, real database transaction, or external event broker. Use
`createTestingRequestContext` to model runtime capabilities explicitly, `TestingTransactionContext`
to flush after-commit hooks, and `installTestingTelemetryCapture` to assert span names, attributes,
events, status, and recorded exceptions in memory.

`installTestingTelemetryCapture` installs an OpenTelemetry tracer provider for the current process.
Call it before initializing a real telemetry SDK in the same test process. Repeated calls are
supported for isolated captures, including overlapping `capture.run()` blocks, but OpenTelemetry
does not expose a safe provider reset API after a different provider has already been installed.

## Executable Test Evidence

`croco.test-evidence/v1` is the stable, runner-neutral envelope for Vitest, Playwright, generated-app,
provider-conformance, failure-drill, resource, and runtime-smoke results. The record schema is available from
`@croco/testing/schemas/test-evidence-v1.json`, the aggregate schema from
`@croco/testing/schemas/test-evidence-bundle-v1.json`, and the root entrypoint exports the matching TypeScript
types and validation helpers.

Every record keeps declared `intent.contractIds` separate from runtime `observed.contractIds`, route IDs,
Problem codes, and event IDs. Declaring a contract never marks it observed. `attempts` is the source of truth
for outcome classification: a failed attempt followed by a pass is always `flaky`, and the bundle is not
successful until that flakiness is addressed. Seed, virtual time, and a replay command remain explicit.

Fidelity records boot boundary, dependency fidelity, runtime, isolation, and validation independently.
`assertTestEvidenceFidelity()` compares actual evidence with a required profile and rejects relabeling, so an
isolated fake or rollback run cannot satisfy application, local-real, or commit evidence. Existing versioned
provider and failure-drill reports remain intact as attachments with their original `schemaVersion` instead of
being flattened into a lossy replacement format.

Both reporter adapters accept optional context mappers for runtime observations, diagnostics, resources, and
replay metadata. Vitest evidence takes `packageName` from reporter options or the current Vitest project name;
it never reuses a package name read from the process working directory for every project. Import the directly
loadable defaults from `@croco/testing/vitest-reporter` and
`@croco/testing/playwright-reporter`. A custom `write(record)` callback may select another artifact layout;
without one, reporters write deterministic JSON fragments to `ci-reports/test-evidence/records` (or the
configured `outputDirectory`). `pnpm test-evidence:bundle --input <report.json>` consumes already-executed
unified records or Croco verification reports, writes
`ci-reports/test-evidence/bundle.json` and `summary.md`, and fails with explicit missing-artifact evidence.
Verification profiles can pass that exact-head bundle back through `--test-evidence <bundle.json>`; only passed
`croco-verification` records are reused only when the bundle is passed and complete, the record is passed, its
observed contract ID matches the check ID, `metadata.commitSha` matches the exact current head,
`metadata.profile` matches the selected verification profile, `replay.command` exactly matches the command,
and every required artifact is both attached to the record and still present. Stale, flaky, declared-only,
unrelated, command-mismatched, wrong-profile, or incomplete records cause the command to execute normally.
Sensitive keys used by the logger security policy (`authorization`, cookies, credentials, passwords, secrets,
and tokens) and secret-like values are redacted before records are emitted; `assertNoTestEvidenceSecrets()`
supports policy-owned secret samples for validation.

## Executable Assurance Graph

`createExecutableAssuranceGraph()` compiles existing Contract Graph, Problem registry, framework manifest,
task metadata, runtime capability, provider conformance, public API, RPC, and selected journey artifacts into
stable behavior nodes and executable evidence obligations. It does not introduce another manually maintained
contract catalog. Route and Problem sources remain linked to their generated artifact locations, and every
missing obligation includes a replay command and test template.

`evaluateExecutableAssuranceGraph()` requires declared intent, runtime observation, a passing non-flaky
outcome, and the obligation's minimum fidelity to agree. Reports separate satisfied, missing, stale, and
contradictory evidence. Removed or renamed `route:`, `rpc:`, `problem:`, `event:`, `task:`, `provider:`, and
`journey:` IDs remain visible as stale evidence instead of disappearing. Runtime observations have dedicated
route, Problem, event, task, span, and provider fields, while arbitrary unit tests remain outside assurance
unless their behavior is present in the compiled graph.

Evaluation is advisory by default. Pass `{ mode: "enforce" }` and call
`assertExecutableAssuranceSatisfied()` only after the report's false-positive rate is acceptable. The initial
blocking obligations are limited to public route/RPC success and Problem behavior, declared public Problems,
domain events/tasks, required supported provider capabilities, and explicitly selected critical journeys.
`pnpm assurance:report --graph <graph.json> --evidence <bundle.json>` writes deterministic `report.json` and
`summary.md`; add `--enforce` to make blocking findings exit non-zero.

Assurance nodes also carry deterministic SHA-256 fingerprints of their source artifact rows. Schema, Problem,
event, task, runtime capability, provider profile, generated/public API, and journey content changes therefore
remain visible even when their stable behavior IDs do not change.

`createChangedTestPlan()` compares base/head assurance graphs and runner-neutral evidence to produce
`croco.changed-test-plan/v1`. Every selected test has a machine-readable reason; selected package/full suites,
excluded evidence, fallback paths, replay commands, and source locations remain explicit. Unsupported changes and testing, codegen,
TypeScript/build, verification-policy, or shared-runtime changes widen execution conservatively. Advisory time
budgets report overflow as incomplete without removing required evidence.

`updateChangedTestSelectionBaseline()` compares the plan with full-suite evidence and records every omitted
failure in `croco.changed-test-selection-baseline/v1`. `assertChangedTestPlanEnforceable()` rejects optimization
until the documented observation window and miss threshold are satisfied, keeping product PRs advisory during
shadow mode while planner contract tests remain blocking.

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

`createScenarioRuntime()` composes application-specific timelines around named Croco transaction,
event, task, trigger, provider, retry, and telemetry boundaries. Failure steps are ordered and can
inject duplicate delivery, response loss, virtual-time timeout, retryable or terminal failure,
process interruption, and exporter failure. Fluent expectations verify Problem codes, recovery,
diagnostic, audit, event, task, and telemetry multiplicity. Each successful run returns a stable
`croco.scenario-report/v1` artifact whose scenario ID, seed, initial virtual time, and serialized
failure timeline can be passed to `replayScenarioRuntime()`.

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
`@croco/testing` entrypoint exports general conformance helpers, `@croco/testing/drizzle` exports
the Drizzle-specific helper pair, and `@croco/testing/notifications` exports notification capability
conformance without loading unrelated provider contracts.

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
  rejection as Croco `Problem` instances. Its optional `capabilities` contract inspects the provider
  profile and can require `checkout` or `usage` independently, including verification of the
  capability-specific public methods.

The auth provider helper currently covers:

- `createAuthProviderConformanceSuite()` for `@croco/auth-core` providers: valid auth, missing and
  invalid credentials, malformed provider payloads, redacted upstream auth failures, signed webhook
  success/failure, malformed webhook payloads, provider organization to Croco tenant evidence,
  missing/ready diagnostics output, and explicit no-credential live-smoke gates.

The notification provider helper currently covers:

- `createNotificationProviderConformanceSuite()` for providers implementing
  `@croco/notifications-core/NotificationProvider`: explicit complete capability profiles,
  provider-name and channel consistency, and stable profile reads for diagnostics and certification.

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
  dual-interface idempotent writer context, token-bearing continuation envelopes, execution failure
  evidence, redacted retryable and terminal upstream failures, and no-credential live-smoke gates.
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
