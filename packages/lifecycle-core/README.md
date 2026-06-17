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
