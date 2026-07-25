import { describe, expect, it, vi } from "vitest";
import {
  InMemoryLifecycleActionSink,
  InMemoryLifecycleRunStore,
  LifecycleDiagnosticsProvider,
  LifecycleRuleEvaluator,
  LifecycleRuleRegistry,
  WebhookLifecycleActionAdapter,
  createBillingSubscriptionSignal,
  createHealthStatusChangedSignal,
  createLifecycleContext,
  createMeteringQuotaExceededSignal,
  createScheduledLifecycleSignal,
} from "../index";

function createEvaluator(input?: {
  readonly sink?: InMemoryLifecycleActionSink;
  readonly store?: InMemoryLifecycleRunStore;
  readonly registry?: LifecycleRuleRegistry;
}) {
  const registry = input?.registry ?? new LifecycleRuleRegistry();
  const store = input?.store ?? new InMemoryLifecycleRunStore();
  const sink = input?.sink ?? new InMemoryLifecycleActionSink();

  return {
    evaluator: new LifecycleRuleEvaluator({
      registry,
      runStore: store,
      actionAdapter: sink,
    }),
    registry,
    sink,
    store,
  };
}

describe("lifecycle-core", () => {
  it("runs a health-driven retention action exactly once for the same signal", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const { evaluator, registry, sink } = createEvaluator();
    registry.register({
      id: "risk-onboarding-follow-up",
      description: "Create a CS follow-up when health drops during onboarding",
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
    expect(registry.get("risk-onboarding-follow-up")?.id).toBe("risk-onboarding-follow-up");
    expect(registry.getAll()).toHaveLength(1);
    expect(
      registry.match(
        createHealthStatusChangedSignal({
          signalId: "compatibility-contract",
          tenantId: "tenant-1",
          oldStatus: "healthy",
          newStatus: "at_risk",
          score: 62,
          occurredAt: now,
        }),
      ),
    ).toHaveLength(1);
    const context = createLifecycleContext({
      now,
      signal: createHealthStatusChangedSignal({
        signalId: "health-event-1",
        tenantId: "tenant-1",
        oldStatus: "healthy",
        newStatus: "at_risk",
        score: 62,
        occurredAt: now,
      }),
      health: { status: "at_risk", score: 62 },
      onboarding: { status: "in_progress", isCompleted: false },
    });

    const first = await evaluator.evaluate(context);
    const second = await evaluator.evaluate(context);

    expect(first.runs).toMatchObject([
      {
        ruleId: "risk-onboarding-follow-up",
        status: "succeeded",
        actionResults: [{ actionId: "create-cs-follow-up", status: "success" }],
      },
    ]);
    expect(second.runs).toMatchObject([
      {
        ruleId: "risk-onboarding-follow-up",
        status: "skipped",
        skipReason: "idempotency_key_reused",
      },
    ]);
    expect(sink.getEmissions()).toHaveLength(1);
  });

  it("enforces cooldown for a tenant and rule across different signals", async () => {
    const { evaluator, registry } = createEvaluator();
    registry.register({
      id: "usage-drop-follow-up",
      description: "Create a retention action after a usage drop",
      severity: "medium",
      triggers: [{ type: "scheduled.reevaluation" }],
      cooldown: { durationMs: 60 * 60 * 1000 },
      actions: [{ id: "create-retention-follow-up", type: "cs.follow_up" }],
    });

    const first = await evaluator.evaluate(
      createLifecycleContext({
        now: new Date("2026-01-01T00:00:00.000Z"),
        signal: createScheduledLifecycleSignal({
          signalId: "scheduled-1",
          tenantId: "tenant-1",
          reason: "usage-drop",
          occurredAt: new Date("2026-01-01T00:00:00.000Z"),
        }),
      }),
    );
    const second = await evaluator.evaluate(
      createLifecycleContext({
        now: new Date("2026-01-01T00:30:00.000Z"),
        signal: createScheduledLifecycleSignal({
          signalId: "scheduled-2",
          tenantId: "tenant-1",
          reason: "usage-drop",
          occurredAt: new Date("2026-01-01T00:30:00.000Z"),
        }),
      }),
    );

    expect(first.runs[0]).toMatchObject({ status: "succeeded" });
    expect(second.runs[0]).toMatchObject({
      status: "skipped",
      skipReason: "cooldown_active",
    });
  });

  it("keeps failed action evidence instead of treating the run as successful", async () => {
    const sink = new InMemoryLifecycleActionSink({ failActionIds: ["billing-recovery"] });
    const store = new InMemoryLifecycleRunStore();
    const { evaluator, registry } = createEvaluator({ sink, store });
    registry.register({
      id: "billing-past-due-recovery",
      description: "Create a billing recovery action for past-due subscriptions",
      severity: "critical",
      triggers: [{ type: "billing.subscription.updated" }],
      when: (context) => context.billing?.status === "past_due",
      actions: [{ id: "billing-recovery", type: "billing.recovery" }],
    });

    const result = await evaluator.evaluate(
      createLifecycleContext({
        now: new Date("2026-01-01T00:00:00.000Z"),
        signal: createBillingSubscriptionSignal({
          signalId: "billing-1",
          tenantId: "tenant-1",
          subscription: { status: "past_due", planId: "team" },
          previousStatus: "active",
          occurredAt: new Date("2026-01-01T00:00:00.000Z"),
        }),
        billing: { status: "past_due", planId: "team" },
      }),
    );
    const [storedRun] = await store.list();

    expect(result.runs[0]).toMatchObject({
      status: "failed",
      error: {
        code: "lifecycle-core/in-memory-action-failed",
      },
    });
    expect(storedRun.actionResults[0]).toMatchObject({
      status: "failure",
      error: {
        message: "Action 'billing-recovery' failed in the in-memory lifecycle sink",
      },
    });
  });

  it("matches billing, metering, and onboarding context in one lifecycle rule", async () => {
    const { evaluator, registry, sink } = createEvaluator();
    registry.register({
      id: "past-due-usage-onboarding-risk",
      description: "Prioritize billing recovery when usage is blocked during onboarding",
      severity: "critical",
      triggers: [{ type: "metering.quota.exceeded" }],
      when: (context) =>
        context.billing?.status === "past_due" &&
        context.onboarding?.isCompleted !== true &&
        context.usage?.some((usage) => usage.exceeded === true) === true,
      actions: (context) => [
        {
          id: "create-billing-recovery",
          type: "billing.recovery",
          payload: {
            tenantId: context.tenantId,
            planId: context.billing?.planId,
            meterId: context.usage?.[0]?.meterId,
          },
        },
      ],
    });

    const result = await evaluator.evaluate(
      createLifecycleContext({
        now: new Date("2026-01-01T00:00:00.000Z"),
        signal: createMeteringQuotaExceededSignal({
          signalId: "usage-1",
          tenantId: "tenant-1",
          usage: {
            meterId: "api_requests",
            usage: 101,
            quota: 100,
            remaining: 0,
            exceeded: true,
          },
          occurredAt: new Date("2026-01-01T00:00:00.000Z"),
        }),
        billing: { status: "past_due", planId: "team" },
        onboarding: { status: "in_progress", isCompleted: false },
        usage: [
          {
            meterId: "api_requests",
            usage: 101,
            quota: 100,
            remaining: 0,
            exceeded: true,
          },
        ],
      }),
    );

    expect(result.runs[0]).toMatchObject({
      ruleId: "past-due-usage-onboarding-risk",
      status: "succeeded",
    });
    expect(sink.getEmissions()[0].action.payload).toEqual({
      tenantId: "tenant-1",
      planId: "team",
      meterId: "api_requests",
    });
  });

  it("reports failed lifecycle runs through diagnostics", async () => {
    const sink = new InMemoryLifecycleActionSink({ failActionIds: ["billing-recovery"] });
    const store = new InMemoryLifecycleRunStore();
    const { evaluator, registry } = createEvaluator({ sink, store });
    registry.register({
      id: "billing-past-due-recovery",
      description: "Create a billing recovery action for past-due subscriptions",
      severity: "critical",
      triggers: [{ type: "billing.subscription.updated" }],
      actions: [{ id: "billing-recovery", type: "billing.recovery" }],
    });
    await evaluator.evaluate(
      createLifecycleContext({
        now: new Date("2026-01-01T00:00:00.000Z"),
        signal: createBillingSubscriptionSignal({
          signalId: "billing-1",
          tenantId: "tenant-1",
          subscription: { status: "past_due", planId: "team" },
        }),
      }),
    );

    const health = await new LifecycleDiagnosticsProvider(store).getHealth();

    expect(health).toMatchObject({
      status: "degraded",
      component: "lifecycle",
      details: {
        failedRunCount: 1,
        failedActionCount: 1,
      },
    });
  });

  it("returns explicit failure evidence for invalid webhook actions", async () => {
    const adapter = new WebhookLifecycleActionAdapter(vi.fn() as unknown as typeof fetch);
    const result = await adapter.execute(
      {
        id: "notify-webhook",
        type: "webhook",
        payload: {},
      },
      createLifecycleContext({
        signal: createScheduledLifecycleSignal({
          signalId: "scheduled-1",
          tenantId: "tenant-1",
          reason: "test",
        }),
      }),
      {
        id: "run-1",
        ruleId: "webhook-rule",
        ruleVersion: "1.0.0",
        ruleFingerprint: "fingerprint",
        tenantId: "tenant-1",
        idempotencyKey: "webhook-rule:tenant-1",
      },
    );

    expect(result).toMatchObject({
      status: "failure",
      error: {
        code: "lifecycle-core/webhook-url-missing",
      },
    });
  });
});
