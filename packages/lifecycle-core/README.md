# @croco/lifecycle-core

Lifecycle rules turn SaaS signals into observable retention actions.

The package is framework-neutral: applications normalize health, onboarding, billing, usage, or scheduled events into `LifecycleSignal` values, register rules, and execute those rules through an action adapter. The default in-memory store and action sink work without Slack, email, task-provider, or webhook credentials.

```ts
import {
  InMemoryLifecycleActionSink,
  InMemoryLifecycleRunStore,
  LifecycleRuleEvaluator,
  LifecycleRuleRegistry,
  createHealthStatusChangedSignal,
  createLifecycleContext,
} from "@croco/lifecycle-core";

const registry = new LifecycleRuleRegistry();
registry.register({
  id: "retention-risk-follow-up",
  description: "Create a CS follow-up when a tenant becomes at risk during onboarding.",
  severity: "high",
  triggers: [{ type: "health.status.changed" }],
  cooldown: { durationMs: 24 * 60 * 60 * 1000 },
  when: (context) =>
    context.health?.status === "at_risk" && context.onboarding?.isCompleted !== true,
  actions: [
    {
      id: "create-cs-follow-up",
      type: "cs.follow_up",
      title: "Contact at-risk tenant",
    },
  ],
});

const evaluator = new LifecycleRuleEvaluator({
  registry,
  runStore: new InMemoryLifecycleRunStore(),
  actionAdapter: new InMemoryLifecycleActionSink(),
});

await evaluator.evaluate(
  createLifecycleContext({
    signal: createHealthStatusChangedSignal({
      tenantId: "tenant_123",
      oldStatus: "healthy",
      newStatus: "at_risk",
      score: 61,
    }),
    health: { status: "at_risk", score: 61 },
    onboarding: { status: "in_progress", isCompleted: false },
  }),
);
```

Use `LifecycleDiagnosticsProvider` with `@croco/diagnostics-core` to expose recent run counts, failed actions, and latest lifecycle runs.

`WebhookLifecycleActionAdapter` bounds every outbound request to 30 seconds by default. Configure a shorter or longer
integer timeout when constructing the adapter; invalid values fail during setup. Timeout failures retain
`lifecycle-core/webhook-request-error` and use an explicit `Webhook request timed out` message, while non-timeout network
errors keep their original message.

```ts
const webhookAdapter = new WebhookLifecycleActionAdapter(fetch, { timeoutMs: 10_000 });
```

## Versioned production rules

Use `registerVersion()` for production rules that operators must review, activate, pause, resume, or inspect. The stable `rule.id` identifies the rule across deployments. `version` is immutable, and `executableRegistrationId` identifies the code-owned predicate and action mapping. The registry fingerprints those values together with triggers, declared context requirements, severity, cooldown, and safe action descriptors.

```ts
const registration = await registry.registerVersion({
  rule: {
    id: "retention-risk-follow-up",
    description: "Create a CS follow-up for an at-risk tenant.",
    severity: "high",
    triggers: [{ type: "health.status.changed" }],
    cooldown: { durationMs: 24 * 60 * 60 * 1000 },
    when: (context) => context.health?.status === "at_risk",
    conditionEvidence: (context) => ({
      atRisk: context.health?.status === "at_risk",
    }),
    actions: [
      {
        id: "create-cs-follow-up",
        type: "cs.follow_up",
        title: "Contact at-risk tenant",
      },
    ],
  },
  version: "2026-07-26",
  executableRegistrationId: "retention-risk-follow-up:v2",
  executableFingerprint: process.env.RULE_BUNDLE_SHA256 ?? "",
  contextRequirements: ["health.status"],
});

await registry.activate({
  commandId: "activate-retention-risk-2026-07-26",
  ruleId: registration.descriptor.ruleId,
  version: registration.descriptor.version,
  expectedRevision: 0,
  actor: "operator_123",
  reason: "Reviewed retention policy rollout",
});
```

Registering another version never replaces the active version. It remains `inactive` until an explicit `activate()` command supersedes the current version. `pause()`, `resume()`, and `supersede()` use the same command shape. `expectedRevision` provides optimistic concurrency, while `commandId` makes an identical retry idempotent and rejects conflicting reuse.

`executableFingerprint` is an explicit build artifact contract, not a runtime hash of JavaScript source. Generate it from the deployed rule bundle together with captured/declarative configuration, and change it whenever `when`, evidence, idempotency, or dynamic action behavior changes. Reattaching a persisted version with a different executable fingerprint fails registration.

`LifecycleRuleStateStore` accepts synchronous or asynchronous persistence implementations. A durable implementation must commit `applyCommand()` as one atomic compare-and-swap transaction that also records command idempotency and activation history. It must also make `claimExecution()` atomic with the active-version check and prevent a command from completing while a claimed dispatch is starting. Execution claims use globally unique ownership tokens, reject duplicate tokens, and carry an expiry so an abandoned process cannot block transitions forever; waiting commands must be notified or retry when that expiry arrives. The registry releases the lease after every adapter call has begun, before awaiting adapter completion; this keeps pause as a reliable dispatch boundary without deadlocking an adapter that pauses its own rule. Await version registration, transitions, and registry inspection when using either kind of store.

Production runs and action emissions record both `ruleVersion` and `ruleFingerprint`. A paused rule still records a skipped run with `skipReason: "rule_paused"`, but it does not dispatch actions. Resuming does not replay signals.

`LifecycleRunStore.claim()` atomically reserves the idempotency key and optional cooldown window together with an `indeterminate` dispatch boundary before any action adapter starts. Distributed adapters must commit the claim and boundary in shared durable storage; separate read-then-save checks are not sufficient under concurrent evaluation or process termination. The durable run means dispatch may have occurred and blocks automatic replay until an operator or provider-specific reconciler supplies action evidence through `finalizeDispatch()`. Finalization must compare-and-set the same run ID and idempotency key. `abortClaim()` may remove the boundary only when dispatch is proven not to have started; finalization failure must retain the claim and indeterminate run. Diagnostics report indeterminate runs as degraded health without exposing action payloads.

## Dry-run evaluation

`dryRun()` evaluates an explicit `LifecycleContext` snapshot without saving a production run, dispatching actions, or consuming cooldown:

```ts
const preview = await evaluator.dryRun({
  ruleId: "retention-risk-follow-up",
  version: "2026-07-26",
  context,
});
```

The result includes the exact rule version and fingerprint, matched state, boolean `conditionEvidence`, payload-free proposed action descriptors, suppression/cooldown decisions, and redacted Problem summaries. Context and action payload values are not returned by default. Keep `when`, `conditionEvidence`, and dynamic action mapping free of side effects because dry-run executes that code.

Pass an `InMemoryLifecycleDryRunStore` (or another `LifecycleDryRunStore`) to the evaluator when recent dry-run audit evidence should be available to `LifecycleDiagnosticsProvider`. Diagnostics can also receive the registry to report active versions, paused rules, unavailable executable registrations, and run fingerprint mismatches.

## Compatibility

`register(rule)` remains source-compatible and automatically activates a deterministic `legacy-*` version. This path is intended for simple existing registrations and marks its executable fingerprint as `legacy-unversioned`; it does not claim immutable executable identity. Migrate production rules to `registerVersion()`, provide a build-generated `executableFingerprint`, and provide `actionDescriptors` when `actions` is a function so version review and fingerprint evidence are complete.

The synchronous `get()`, `getAll()`, and `match()` methods are a local compatibility view for `register(rule)`. They can be stale when another process changes a shared store, so do not use them for authoritative version state or dispatch decisions. Versioned execution uses `matchRegistrations()` internally; operational callers should await `inspect()` and `getIdentityState()` against the durable store.

Custom `LifecycleActionAdapter` implementations must accept `ruleVersion` and `ruleFingerprint` in the run reference. Custom `LifecycleRunStore` implementations must atomically persist the claim and supplied dispatch boundary in `claim()`, fence `finalizeDispatch()`, and restrict `abortClaim()` to proven pre-dispatch failures while persisting the required version fields. Custom `LifecycleRuleStateStore` implementations must implement expiring, uniquely owned execution leases through `claimExecution()` and `releaseExecution()`. These contracts keep concurrent dispatch attributable, suppress duplicate actions, preserve ambiguous external outcomes for reconciliation, and make pause a reliable dispatch boundary.

## Monetization signals and recipes

The monetization vocabulary normalizes billing, metering, credit, delivery, and seat read models without exposing provider webhook payloads or making lifecycle rules responsible for collection, entitlement enforcement, or reconciliation. Every factory records tenant identity, effective and source timestamps, a deterministic signal ID, a provider-neutral reason/status, and whitelisted diagnostic evidence. Signals tied to subscription governance also require the immutable `PlanVersionRef` from `@croco/billing-core`. Credit signals require a stable `conditionId`: balance changes within the same low-credit condition keep the low-balance signal idempotent, while the distinct exhausted signal still advances the lifecycle.

```ts
import { planVersionRef } from "@croco/billing-core";
import {
  InMemoryMonetizationThresholdStore,
  MonetizationThresholdTracker,
  createLifecycleContext,
} from "@croco/lifecycle-core";

const tracker = new MonetizationThresholdTracker(new InMemoryMonetizationThresholdStore());

const crossing = await tracker.evaluate({
  tenantId,
  meterKey: "ai.tokens",
  planVersionRef: planVersionRef("pro@2026-07"),
  thresholds: [0.5, 0.8, 1, 1.25],
  consumed: 800_000,
  limit: 1_000_000,
  periodStartsAt,
  periodEndsAt,
  effectiveAt,
  sourceAt,
});

for (const signal of crossing.signals) {
  await evaluator.evaluate(createLifecycleContext({ signal }));
}
await tracker.acknowledge(crossing);
```

`MonetizationThresholdStore.claimCrossings()` is the atomic boundary for one-shot crossings. A claim remains leased until `tracker.acknowledge()` confirms that every returned signal was durably handed to lifecycle evaluation; call `tracker.release()` when delivery fails. Expired in-memory claims can be retried, so a process crash between claim and dispatch does not consume the crossing forever. The in-memory implementation is suitable for tests and single-process applications; distributed implementations must durably lease and acknowledge each `(tenant, meter, plan version, billing period, threshold)` tuple. Repeated observations above a pending or acknowledged level are suppressed, a newly reached higher level emits once, stale source observations cannot create crossings, and a new period or plan version naturally creates a new scope. Thresholds above `1` represent configured overage bands. Hard quota enforcement remains an `entitlements-core` responsibility.

Normalize delinquency ordering with `MonetizationSubscriptionConditionTracker` before evaluation. Its store atomically orders `past_due` and `recovered` transitions by tenant, plan version, correlated condition, and source timestamp, preventing a delayed provider event from reopening a condition that has already recovered. Exact duplicate transitions return the same deterministic signal so a crash before lifecycle delivery can be retried; the lifecycle run store remains the durable delivery idempotency boundary. Distributed applications should provide a durable `MonetizationConditionStore`.

Nine signal descriptors are published through `MONETIZATION_SIGNAL_DESCRIPTORS`:

- `billing.trial.ending`
- `billing.subscription.past_due`
- `billing.subscription.recovered`
- `billing.usage.threshold_crossed`
- `billing.credit.balance_low`
- `billing.credit.exhausted`
- `billing.usage.delivery_lagging`
- `billing.usage.sync_drifted`
- `billing.seat.quantity_drifted`

Use `createMonetizationReferenceRecipes()` for the eight opt-in reference recipes. Install only reviewed recipes and declare the signal sources and action adapters available in the composition root:

```ts
const [trialReminder] = createMonetizationReferenceRecipes();

await installMonetizationRecipe(
  registry,
  trialReminder,
  {
    signalSources: ["billing.trial.ending"],
    actionTypes: ["customer.notify"],
  },
  { activate: true },
);
```

Installation fails with `MonetizationRecipeCapabilityProblem` when a required source or action adapter is absent. `createMonetizationLifecycleArtifact()` exposes the same missing-capability diagnostics together with deterministic signal and recipe descriptors for build artifacts and contract inspection. Pass the enabled recipes and a live `MonetizationCapabilitySource` to `LifecycleDiagnosticsProvider` to detect an adapter removed after installation. Installed recipes use immutable version `1.0.0`, with fingerprints covering the descriptor, execution model version, action descriptors, signal-specific action IDs, cooldown, and threshold range. The past-due recipe correlates `billing.subscription.recovered` through `recoveryOf` and gives the recovery action its own deterministic signal identity, so replay does not repeat completed delinquency actions.

Default evidence never accepts arbitrary provider metadata. It contains only the factory's documented numeric, timestamp, status, meter, unit, period, and correlation fields. Keep customer contact data, payment instruments, provider customer/subscription IDs, and raw webhook bodies outside signal evidence and action predicates.

Pass the threshold store to `LifecycleDiagnosticsProvider` to report suppressed duplicate crossings. Diagnostics also report monetization run counts by signal type, failed actions, and the latest subscription recovery result without returning signal or action payloads.
