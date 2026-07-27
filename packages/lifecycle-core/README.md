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

`LifecycleRunStore.claim()` atomically reserves the idempotency key and optional cooldown window before dispatch. Distributed adapters must enforce both constraints in shared durable storage; separate read-then-save checks are not sufficient under concurrent evaluation. `save()` finalizes the claim with the run, while `abortClaim()` idempotently releases only an unfinished claim after infrastructure failure.

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

Custom `LifecycleActionAdapter` implementations must now accept `ruleVersion` and `ruleFingerprint` in the run reference. Custom `LifecycleRunStore` implementations must implement atomic `claim()`/`abortClaim()` and persist those required fields. Custom `LifecycleRuleStateStore` implementations must implement expiring, uniquely owned execution leases through `claimExecution()` and `releaseExecution()`. These contracts keep concurrent dispatch attributable, suppress duplicate actions, recover from infrastructure failure, and make pause a reliable dispatch boundary.
