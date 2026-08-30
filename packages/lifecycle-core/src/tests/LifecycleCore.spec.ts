import { describe, expect, it, vi } from "vitest";
import {
  InMemoryLifecycleActionSink,
  InMemoryLifecycleRunStore,
  LifecycleDiagnosticsProvider,
  LifecycleRunEvidenceProblem,
  LifecycleRuleEvaluator,
  LifecycleRuleRegistry,
  createBillingSubscriptionSignal,
  createHealthStatusChangedSignal,
  createLifecycleContext,
  createMeteringQuotaExceededSignal,
  createScheduledLifecycleSignal,
} from "../index";
import type { LifecycleFinalizedRun, LifecycleIndeterminateRun, LifecycleRunClaim } from "../index";

function createIndeterminateRun(
  id: string,
  idempotencyKey: string,
  completedAt = new Date("2026-01-01T00:00:00.000Z"),
): LifecycleIndeterminateRun {
  return {
    id,
    ruleId: "retention-rule",
    ruleVersion: "1.0.0",
    ruleFingerprint: "retention-rule-v1",
    tenantId: "tenant-1",
    signalType: "scheduled.reevaluation",
    signalId: `${id}-signal`,
    severity: "medium",
    status: "indeterminate",
    idempotencyKey,
    actionResults: [],
    startedAt: new Date(completedAt),
    completedAt,
  };
}

function createClaim(
  runId: string,
  idempotencyKey: string,
  claimedAt = new Date("2026-01-01T00:00:00.000Z"),
): LifecycleRunClaim {
  return {
    runId,
    idempotencyKey,
    tenantId: "tenant-1",
    ruleId: "retention-rule",
    claimedAt,
  };
}

describe("InMemoryLifecycleRunStore snapshot ownership", () => {
  it("isolates claim and dispatch inputs before cooldown and abort decisions", async () => {
    const store = new InMemoryLifecycleRunStore();
    const claim = createClaim("run-1", "claim-1");
    const dispatchingRun = createIndeterminateRun("run-1", "claim-1");

    await expect(store.claim(claim, dispatchingRun)).resolves.toEqual({ claimed: true });

    Object.assign(claim, {
      runId: "mutated-run",
      idempotencyKey: "mutated-claim",
      tenantId: "mutated-tenant",
      ruleId: "mutated-rule",
    });
    claim.claimedAt.setTime(new Date("2025-01-01T00:00:00.000Z").getTime());
    Object.assign(dispatchingRun, {
      id: "mutated-run",
      idempotencyKey: "mutated-claim",
      tenantId: "mutated-tenant",
      ruleId: "mutated-rule",
      status: "succeeded",
      actionResults: [{ actionId: "forged", type: "forged", status: "success" }],
    });
    dispatchingRun.completedAt.setTime(new Date("2030-01-01T00:00:00.000Z").getTime());

    const competingClaim = {
      ...createClaim("run-2", "claim-2", new Date("2026-01-01T00:10:00.000Z")),
      cooldownSince: new Date("2026-01-01T00:00:00.000Z"),
    };
    await expect(
      store.claim(
        competingClaim,
        createIndeterminateRun("run-2", "claim-2", new Date("2026-01-01T00:10:00.000Z")),
      ),
    ).resolves.toEqual({ claimed: false, reason: "cooldown_active" });
    await expect(store.list()).resolves.toMatchObject([
      {
        id: "run-1",
        idempotencyKey: "claim-1",
        tenantId: "tenant-1",
        ruleId: "retention-rule",
        status: "indeterminate",
        actionResults: [],
        completedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);

    await store.abortClaim("run-1", "claim-1");

    await expect(store.list()).resolves.toEqual([]);
  });

  it("isolates read results and finalized evidence from later mutation", async () => {
    const store = new InMemoryLifecycleRunStore();
    const dispatchingRun = createIndeterminateRun("run-1", "claim-1");
    await store.claim(createClaim("run-1", "claim-1"), dispatchingRun);

    const dispatchSnapshot = await store.findByIdempotencyKey("claim-1");
    if (!dispatchSnapshot) {
      throw new Error("expected dispatch snapshot");
    }
    Object.assign(dispatchSnapshot, {
      id: "mutated-run",
      idempotencyKey: "mutated-claim",
      status: "succeeded",
    });
    dispatchSnapshot.completedAt.setTime(new Date("2030-01-01T00:00:00.000Z").getTime());

    const actionMetadata = {
      attempt: {
        at: new Date("2026-01-01T00:01:00.000Z"),
        labels: ["primary"],
      },
    };
    const actionError = { code: "provider/unavailable", message: "provider unavailable" };
    const runError = { code: "lifecycle/action-failed", message: "action failed" };
    const finalizedRun: LifecycleFinalizedRun = {
      ...dispatchingRun,
      status: "failed",
      actionResults: [
        {
          actionId: "notify-owner",
          type: "notification.send",
          status: "failure",
          error: actionError,
          metadata: actionMetadata,
        },
      ],
      error: runError,
      completedAt: new Date("2026-01-01T00:01:00.000Z"),
    };

    await expect(store.finalizeDispatch(finalizedRun)).resolves.toEqual({ finalized: true });

    Object.assign(finalizedRun, { status: "succeeded", idempotencyKey: "mutated-claim" });
    Object.assign(actionError, { code: "mutated", message: "mutated" });
    Object.assign(runError, { code: "mutated", message: "mutated" });
    actionMetadata.attempt.at.setTime(new Date("2030-01-01T00:00:00.000Z").getTime());
    actionMetadata.attempt.labels.push("mutated");
    finalizedRun.completedAt.setTime(new Date("2030-01-01T00:00:00.000Z").getTime());

    const firstRead = await store.findLatestForRule("tenant-1", "retention-rule");
    if (!firstRead) {
      throw new Error("expected finalized snapshot");
    }
    Object.assign(firstRead, { status: "succeeded", idempotencyKey: "mutated-read" });
    Object.assign(firstRead.error ?? {}, { code: "mutated", message: "mutated" });
    Object.assign(firstRead.actionResults[0]?.error ?? {}, {
      code: "mutated",
      message: "mutated",
    });
    const firstMetadata = firstRead.actionResults[0]?.metadata;
    if (firstMetadata) {
      firstMetadata.attempt = { at: new Date("2030-01-01T00:00:00.000Z"), labels: [] };
    }
    firstRead.completedAt.setTime(new Date("2030-01-01T00:00:00.000Z").getTime());

    const secondRead = await store.findByIdempotencyKey("claim-1");

    expect(secondRead).toMatchObject({
      id: "run-1",
      idempotencyKey: "claim-1",
      status: "failed",
      error: { code: "lifecycle/action-failed", message: "action failed" },
      actionResults: [
        {
          status: "failure",
          error: { code: "provider/unavailable", message: "provider unavailable" },
          metadata: {
            attempt: {
              at: new Date("2026-01-01T00:01:00.000Z"),
              labels: ["primary"],
            },
          },
        },
      ],
      completedAt: new Date("2026-01-01T00:01:00.000Z"),
    });
    expect(secondRead).not.toBe(firstRead);
  });

  it("preserves saved-run ordering after input and list-result mutation", async () => {
    const store = new InMemoryLifecycleRunStore();
    const earlier = {
      ...createIndeterminateRun("run-1", "claim-1"),
      status: "succeeded",
    } satisfies LifecycleFinalizedRun;
    const later = {
      ...createIndeterminateRun("run-2", "claim-2", new Date("2026-01-01T00:02:00.000Z")),
      status: "succeeded",
    } satisfies LifecycleFinalizedRun;

    await store.save(earlier);
    await store.save(later);
    later.completedAt.setTime(new Date("2025-01-01T00:00:00.000Z").getTime());

    const firstList = await store.list();
    firstList[0]?.completedAt.setTime(new Date("2024-01-01T00:00:00.000Z").getTime());
    Object.assign(firstList[0] ?? {}, { id: "mutated-run" });

    await expect(store.list()).resolves.toMatchObject([{ id: "run-2" }, { id: "run-1" }]);
  });

  it("rejects unsupported metadata without retaining a partial claim", async () => {
    const store = new InMemoryLifecycleRunStore();
    const dispatchingRun = createIndeterminateRun("run-1", "claim-1");
    Object.assign(dispatchingRun, {
      actionResults: [
        {
          actionId: "notify-owner",
          type: "notification.send",
          status: "success",
          metadata: { unsupported: () => "not cloneable" },
        },
      ],
    });

    await expect(store.claim(createClaim("run-1", "claim-1"), dispatchingRun)).rejects.toThrow(
      LifecycleRunEvidenceProblem,
    );
    await expect(store.list()).resolves.toEqual([]);

    await expect(
      store.claim(createClaim("run-1", "claim-1"), createIndeterminateRun("run-1", "claim-1")),
    ).resolves.toEqual({ claimed: true });
  });

  it("preserves rejection outcomes before cloning unsupported metadata", async () => {
    const store = new InMemoryLifecycleRunStore();
    const dispatchingRun = createIndeterminateRun("run-1", "claim-1");
    await store.claim(createClaim("run-1", "claim-1"), dispatchingRun);
    const withUnsupportedMetadata = <T extends LifecycleIndeterminateRun | LifecycleFinalizedRun>(
      run: T,
    ): T => {
      Object.assign(run, {
        actionResults: [
          {
            actionId: "notify-owner",
            type: "notification.send",
            status: "success",
            metadata: { unsupported: () => "not cloneable" },
          },
        ],
      });
      return run;
    };

    await expect(
      store.claim(
        createClaim("duplicate-run", "claim-1"),
        withUnsupportedMetadata(createIndeterminateRun("duplicate-run", "claim-1")),
      ),
    ).resolves.toEqual({ claimed: false, reason: "idempotency_key_reused" });
    await expect(
      store.claim(
        {
          ...createClaim("cooldown-run", "cooldown-claim"),
          cooldownSince: new Date("2026-01-01T00:00:00.000Z"),
        },
        withUnsupportedMetadata(createIndeterminateRun("cooldown-run", "cooldown-claim")),
      ),
    ).resolves.toEqual({ claimed: false, reason: "cooldown_active" });
    await expect(
      store.finalizeDispatch(
        withUnsupportedMetadata({
          ...createIndeterminateRun("missing-run", "missing-claim"),
          status: "succeeded",
        }),
      ),
    ).resolves.toEqual({ finalized: false, reason: "dispatch_not_found" });
    await expect(
      store.finalizeDispatch(
        withUnsupportedMetadata({
          ...dispatchingRun,
          status: "succeeded",
          idempotencyKey: "stale-claim",
        }),
      ),
    ).resolves.toEqual({ finalized: false, reason: "dispatch_fence_mismatch" });
  });

  it("rechecks idempotency after metadata access reenters claim", async () => {
    const store = new InMemoryLifecycleRunStore();
    const nestedRun = createIndeterminateRun("nested-run", "shared-claim");
    let nestedClaim: ReturnType<InMemoryLifecycleRunStore["claim"]> | undefined;
    const metadata = Object.defineProperty({}, "reenter", {
      enumerable: true,
      get: () => {
        nestedClaim = store.claim(createClaim("nested-run", "shared-claim"), nestedRun);
        return "claimed";
      },
    });
    const outerRun = createIndeterminateRun("outer-run", "shared-claim");
    Object.assign(outerRun, {
      actionResults: [
        {
          actionId: "notify-owner",
          type: "notification.send",
          status: "success",
          metadata,
        },
      ],
    });

    await expect(store.claim(createClaim("outer-run", "shared-claim"), outerRun)).resolves.toEqual({
      claimed: false,
      reason: "idempotency_key_reused",
    });
    await expect(nestedClaim).resolves.toEqual({ claimed: true });
    await expect(store.list()).resolves.toMatchObject([{ id: "nested-run" }]);
  });

  it("rechecks the finalization fence after metadata access reenters abort", async () => {
    const store = new InMemoryLifecycleRunStore();
    const dispatchingRun = createIndeterminateRun("run-1", "claim-1");
    await store.claim(createClaim("run-1", "claim-1"), dispatchingRun);
    const metadata = Object.defineProperty({}, "reenter", {
      enumerable: true,
      get: () => {
        void store.abortClaim("run-1", "claim-1");
        return "aborted";
      },
    });
    const finalizedRun = {
      ...dispatchingRun,
      status: "succeeded",
      actionResults: [
        {
          actionId: "notify-owner",
          type: "notification.send",
          status: "success",
          metadata,
        },
      ],
    } satisfies LifecycleFinalizedRun;

    await expect(store.finalizeDispatch(finalizedRun)).resolves.toEqual({
      finalized: false,
      reason: "dispatch_not_found",
    });
    await expect(store.list()).resolves.toEqual([]);
  });

  it("uses one snapshotted run identity for validation and abort fencing", async () => {
    const store = new InMemoryLifecycleRunStore();
    let identityReadCount = 0;
    const dispatchingRun = Object.defineProperty(
      createIndeterminateRun("placeholder", "claim-1"),
      "id",
      {
        enumerable: true,
        get: () => {
          identityReadCount += 1;
          return identityReadCount === 1 ? "run-1" : "mutated-run";
        },
      },
    );

    await expect(store.claim(createClaim("run-1", "claim-1"), dispatchingRun)).resolves.toEqual({
      claimed: true,
    });
    await store.abortClaim("run-1", "claim-1");

    expect(identityReadCount).toBe(1);
    await expect(store.list()).resolves.toEqual([]);
  });
});

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
});
