import { planVersionRef } from "@croco/billing-core";
import { describe, expect, it } from "vitest";
import {
  InMemoryLifecycleActionSink,
  InMemoryLifecycleDryRunStore,
  InMemoryLifecycleRunStore,
  InMemoryMonetizationConditionStore,
  InMemoryMonetizationThresholdStore,
  LifecycleDiagnosticsProvider,
  LifecycleRuleEvaluator,
  LifecycleRuleRegistry,
  MonetizationRecipeCapabilityProblem,
  MonetizationThresholdClaimProblem,
  MonetizationThresholdTracker,
  MonetizationSubscriptionConditionTracker,
  createCreditBalanceLowSignal,
  createCreditExhaustedSignal,
  createDeliveryBacklogEscalationRecipe,
  createLifecycleContext,
  createMonetizationLifecycleArtifact,
  createMonetizationReferenceRecipes,
  createPastDueGraceFollowUpRecipe,
  createSeatQuantityDriftedSignal,
  createSubscriptionPastDueSignal,
  createSubscriptionRecoveredSignal,
  createTrialEndingReminderRecipe,
  createTrialEndingSignal,
  createUsageDeliveryLaggingSignal,
  createUsageSyncDriftedSignal,
  createUsageThresholdCrossedSignal,
  installMonetizationRecipe,
} from "../index";
import type {
  MonetizationLifecycleSignal,
  MonetizationRecipeCapabilities,
  UsageThresholdCrossedSignalInput,
} from "../index";

const PLAN_V1 = planVersionRef("team@2026-01");
const PLAN_V2 = planVersionRef("team@2026-07");
const PERIOD_START = new Date("2026-07-01T00:00:00.000Z");
const PERIOD_END = new Date("2026-08-01T00:00:00.000Z");
const EFFECTIVE_AT = new Date("2026-07-20T00:00:00.000Z");
const SOURCE_AT = new Date("2026-07-20T00:00:01.000Z");

function thresholdInput(
  consumed: number,
  overrides: Partial<Omit<UsageThresholdCrossedSignalInput, "threshold">> = {},
) {
  return {
    tenantId: "tenant-1",
    meterKey: "ai.tokens",
    planVersionRef: PLAN_V1,
    consumed,
    limit: 1_000,
    periodStartsAt: PERIOD_START,
    periodEndsAt: PERIOD_END,
    effectiveAt: EFFECTIVE_AT,
    sourceAt: SOURCE_AT,
    ...overrides,
  };
}

function allCapabilities(): MonetizationRecipeCapabilities {
  const recipes = createMonetizationReferenceRecipes();
  return {
    signalSources: [
      ...new Set(recipes.flatMap((recipe) => recipe.descriptor.requiredSignalSources)),
    ],
    actionTypes: [...new Set(recipes.flatMap((recipe) => recipe.descriptor.requiredActionTypes))],
  };
}

describe("Monetization lifecycle signals", () => {
  it("creates all provider-neutral descriptors with deterministic identities and safe evidence", () => {
    const signals: readonly MonetizationLifecycleSignal[] = [
      createTrialEndingSignal({
        tenantId: "tenant-1",
        planVersionRef: PLAN_V1,
        trialEndsAt: PERIOD_END,
        daysRemaining: 12,
        effectiveAt: EFFECTIVE_AT,
        sourceAt: SOURCE_AT,
      }),
      createSubscriptionPastDueSignal({
        tenantId: "tenant-1",
        planVersionRef: PLAN_V1,
        conditionId: "delinquency-1",
        reason: "payment_failed",
        attemptCount: 1,
        effectiveAt: EFFECTIVE_AT,
        sourceAt: SOURCE_AT,
      }),
      createSubscriptionRecoveredSignal({
        tenantId: "tenant-1",
        planVersionRef: PLAN_V1,
        conditionId: "recovery-1",
        recoveredConditionId: "delinquency-1",
        effectiveAt: EFFECTIVE_AT,
        sourceAt: SOURCE_AT,
      }),
      createCreditBalanceLowSignal({
        tenantId: "tenant-1",
        planVersionRef: PLAN_V1,
        conditionId: "credit-1",
        balance: 100,
        threshold: 200,
        unit: "credits",
        effectiveAt: EFFECTIVE_AT,
        sourceAt: SOURCE_AT,
      }),
      createCreditExhaustedSignal({
        tenantId: "tenant-1",
        conditionId: "credit-1",
        balance: 0,
        unit: "credits",
        effectiveAt: EFFECTIVE_AT,
        sourceAt: SOURCE_AT,
      }),
      createUsageDeliveryLaggingSignal({
        tenantId: "tenant-1",
        planVersionRef: PLAN_V1,
        conditionId: "delivery-1",
        meterKey: "ai.tokens",
        pendingRecordCount: 4,
        oldestPendingAt: new Date("2026-07-19T00:00:00.000Z"),
        periodEndsAt: PERIOD_END,
        effectiveAt: EFFECTIVE_AT,
        sourceAt: SOURCE_AT,
      }),
      createUsageSyncDriftedSignal({
        tenantId: "tenant-1",
        planVersionRef: PLAN_V1,
        conditionId: "usage-drift-1",
        meterKey: "ai.tokens",
        localRecorded: 900,
        upstreamObserved: 850,
        tolerance: 10,
        periodStartsAt: PERIOD_START,
        periodEndsAt: PERIOD_END,
        effectiveAt: EFFECTIVE_AT,
        sourceAt: SOURCE_AT,
      }),
      createSeatQuantityDriftedSignal({
        tenantId: "tenant-1",
        planVersionRef: PLAN_V1,
        conditionId: "seat-drift-1",
        expectedQuantity: 10,
        observedQuantity: 8,
        effectiveAt: EFFECTIVE_AT,
        sourceAt: SOURCE_AT,
      }),
    ];

    expect(new Set(signals.map((signal) => signal.type)).size).toBe(8);
    for (const signal of signals) {
      expect(signal.id).toBeTruthy();
      expect(signal.source).toBe("monetization");
      expect(signal.data.effectiveAt).toBe(EFFECTIVE_AT.toISOString());
      expect(signal.data.sourceAt).toBe(SOURCE_AT.toISOString());
      expect(JSON.stringify(signal)).not.toMatch(/providerId|customerEmail|paymentMethod/);
    }
    expect(
      createSubscriptionPastDueSignal({
        tenantId: "tenant-1",
        planVersionRef: PLAN_V1,
        conditionId: "delinquency-1",
        reason: "payment_failed",
        attemptCount: 1,
        effectiveAt: EFFECTIVE_AT,
        sourceAt: SOURCE_AT,
      }).id,
    ).toBe(signals[1]?.id);
    expect(signals[2]?.data.recoveryOf).toBe("delinquency-1");

    const nextReminder = createTrialEndingSignal({
      tenantId: "tenant-1",
      planVersionRef: PLAN_V1,
      trialEndsAt: PERIOD_END,
      daysRemaining: 3,
      effectiveAt: EFFECTIVE_AT,
      sourceAt: SOURCE_AT,
    });
    expect(nextReminder.id).not.toBe(signals[0]?.id);
    expect(
      createTrialEndingSignal({
        tenantId: "tenant-1",
        planVersionRef: PLAN_V1,
        trialEndsAt: PERIOD_END,
        daysRemaining: 3,
        effectiveAt: EFFECTIVE_AT,
        sourceAt: SOURCE_AT,
      }).id,
    ).toBe(nextReminder.id);
  });

  it("narrows metadata and evidence from the default signal union", () => {
    const signal = createUsageThresholdCrossedSignal({
      ...thresholdInput(850),
      threshold: 0.8,
    });

    expect(signal.type).toBe("billing.usage.threshold_crossed");
    expect(signal.data.reason).toBe("usage_threshold_crossed");
    expect(signal.data.status).toBe("crossed");
    expect(signal.data.evidence.threshold).toBe(0.8);
  });
});

describe("MonetizationThresholdTracker", () => {
  it("emits each ordered threshold once and suppresses repeated records above it", async () => {
    const store = new InMemoryMonetizationThresholdStore();
    const tracker = new MonetizationThresholdTracker(store);

    const first = await tracker.evaluate({
      ...thresholdInput(850),
      thresholds: [1, 0.8, 0.5],
    });
    const duplicate = await tracker.evaluate({
      ...thresholdInput(900, { sourceAt: new Date("2026-07-20T00:00:02.000Z") }),
      thresholds: [0.5, 0.8, 1],
    });
    const higher = await tracker.evaluate({
      ...thresholdInput(1_100, { sourceAt: new Date("2026-07-20T00:00:03.000Z") }),
      thresholds: [0.5, 0.8, 1],
    });
    await tracker.acknowledge(first);
    await tracker.acknowledge(higher);

    expect(first.signals.map((signal) => signal.data.evidence.threshold)).toEqual([0.5, 0.8]);
    expect(duplicate.signals).toHaveLength(0);
    expect(duplicate.suppressedDuplicateCount).toBe(2);
    expect(higher.signals.map((signal) => signal.data.evidence.threshold)).toEqual([1]);
    expect(await store.getDiagnostics()).toMatchObject({
      scopeCount: 1,
      emittedCrossingCount: 3,
      suppressedDuplicateCount: 4,
    });
  });

  it("resets only for a billing-period or plan-version transition", async () => {
    const tracker = new MonetizationThresholdTracker(new InMemoryMonetizationThresholdStore());
    await tracker.evaluate({ ...thresholdInput(800), thresholds: [0.8] });

    const nextPeriod = await tracker.evaluate({
      ...thresholdInput(800, {
        periodStartsAt: PERIOD_END,
        periodEndsAt: new Date("2026-09-01T00:00:00.000Z"),
      }),
      thresholds: [0.8],
    });
    const nextPlan = await tracker.evaluate({
      ...thresholdInput(800, { planVersionRef: PLAN_V2 }),
      thresholds: [0.8],
    });

    expect(nextPeriod.signals).toHaveLength(1);
    expect(nextPlan.signals).toHaveLength(1);
  });

  it("suppresses out-of-order observations before they can create a new crossing", async () => {
    const tracker = new MonetizationThresholdTracker(new InMemoryMonetizationThresholdStore());
    const current = await tracker.evaluate({
      ...thresholdInput(600, { sourceAt: new Date("2026-07-20T00:00:05.000Z") }),
      thresholds: [0.5, 0.8],
    });
    await tracker.acknowledge(current);

    const stale = await tracker.evaluate({
      ...thresholdInput(900, { sourceAt: new Date("2026-07-20T00:00:04.000Z") }),
      thresholds: [0.5, 0.8],
    });

    expect(stale).toMatchObject({ signals: [], outOfOrder: true });
  });

  it("claims a threshold atomically under concurrent observations", async () => {
    const tracker = new MonetizationThresholdTracker(new InMemoryMonetizationThresholdStore());
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        tracker.evaluate({
          ...thresholdInput(850, {
            sourceAt: new Date(SOURCE_AT.getTime() + index),
          }),
          thresholds: [0.8],
        }),
      ),
    );

    expect(results.flatMap((result) => result.signals)).toHaveLength(1);
  });

  it("releases or expires an unacknowledged claim so delivery can be retried", async () => {
    let now = new Date("2026-07-20T00:00:00.000Z");
    const store = new InMemoryMonetizationThresholdStore({
      claimLeaseDurationMs: 1_000,
      now: () => now,
    });
    const tracker = new MonetizationThresholdTracker(store);
    const abandoned = await tracker.evaluate({ ...thresholdInput(850), thresholds: [0.8] });
    const lowerObservation = await tracker.evaluate({
      ...thresholdInput(100, { sourceAt: new Date("2026-07-20T00:00:02.000Z") }),
      thresholds: [0.8],
    });

    expect(abandoned.signals).toHaveLength(1);
    expect(lowerObservation.signals).toHaveLength(0);
    now = new Date("2026-07-20T00:00:02.000Z");
    await expect(tracker.acknowledge(abandoned)).rejects.toThrow(MonetizationThresholdClaimProblem);
    await expect(tracker.acknowledge(abandoned)).rejects.toMatchObject({
      extensions: { retryable: false },
    });
    const retry = await tracker.evaluate({ ...thresholdInput(850), thresholds: [0.8] });
    await tracker.acknowledge(retry);
    const stale = await tracker.evaluate({
      ...thresholdInput(1_100, { sourceAt: new Date("2026-07-20T00:00:01.500Z") }),
      thresholds: [0.8, 1],
    });

    expect(retry.signals).toHaveLength(1);
    expect(stale).toMatchObject({ signals: [], outOfOrder: true });
    expect(await store.getDiagnostics()).toMatchObject({
      emittedCrossingCount: 1,
      pendingCrossingCount: 0,
      expiredClaimCount: 1,
    });
    await expect(
      new LifecycleDiagnosticsProvider(new InMemoryLifecycleRunStore(), {
        monetizationThresholdStore: store,
      }).getHealth(),
    ).resolves.toMatchObject({
      details: { expiredMonetizationThresholdClaimCount: 1 },
    });
  });

  it("keeps an older expired claim retryable after a newer claim is acknowledged", async () => {
    let now = new Date("2026-07-20T00:00:00.000Z");
    const store = new InMemoryMonetizationThresholdStore({
      claimLeaseDurationMs: 1_000,
      now: () => now,
    });
    const tracker = new MonetizationThresholdTracker(store);
    const older = await tracker.evaluate({
      ...thresholdInput(600, { sourceAt: new Date("2026-07-20T00:00:01.000Z") }),
      thresholds: [0.5, 0.8],
    });
    const newer = await tracker.evaluate({
      ...thresholdInput(900, { sourceAt: new Date("2026-07-20T00:00:02.000Z") }),
      thresholds: [0.5, 0.8],
    });

    await tracker.acknowledge(newer);
    now = new Date("2026-07-20T00:00:02.000Z");
    await expect(tracker.acknowledge(older)).rejects.toThrow(MonetizationThresholdClaimProblem);
    const retry = await tracker.evaluate({
      ...thresholdInput(600, { sourceAt: new Date("2026-07-20T00:00:01.000Z") }),
      thresholds: [0.5, 0.8],
    });
    await tracker.acknowledge(retry);

    expect(older.signals.map((signal) => signal.data.evidence.threshold)).toEqual([0.5]);
    expect(newer.signals.map((signal) => signal.data.evidence.threshold)).toEqual([0.8]);
    expect(retry).toMatchObject({ outOfOrder: false });
    expect(retry.signals.map((signal) => signal.data.evidence.threshold)).toEqual([0.5]);
  });

  it("retires a released claim barrier when a newer claim acknowledges the same threshold", async () => {
    const tracker = new MonetizationThresholdTracker(new InMemoryMonetizationThresholdStore());
    const released = await tracker.evaluate({
      ...thresholdInput(600, { sourceAt: new Date("2026-07-20T00:00:01.000Z") }),
      thresholds: [0.5, 0.8, 1],
    });
    await tracker.release(released);
    const replacement = await tracker.evaluate({
      ...thresholdInput(900, { sourceAt: new Date("2026-07-20T00:00:02.000Z") }),
      thresholds: [0.5, 0.8, 1],
    });
    await tracker.acknowledge(replacement);

    const stale = await tracker.evaluate({
      ...thresholdInput(1_100, { sourceAt: new Date("2026-07-20T00:00:01.500Z") }),
      thresholds: [0.5, 0.8, 1],
    });

    expect(replacement.signals.map((signal) => signal.data.evidence.threshold)).toEqual([0.5, 0.8]);
    expect(stale).toMatchObject({ signals: [], outOfOrder: true });
  });
});

describe("Monetization reference recipes", () => {
  it("publishes deterministic signal and recipe artifacts with explicit capability diagnostics", () => {
    const recipes = createMonetizationReferenceRecipes();
    const artifact = createMonetizationLifecycleArtifact(recipes, {
      signalSources: [],
      actionTypes: [],
    });

    expect(artifact.schemaVersion).toBe("croco.lifecycle.monetization/v1");
    expect(artifact.signals).toHaveLength(9);
    expect(artifact.recipes).toHaveLength(8);
    expect(artifact.recipes.map((recipe) => recipe.id)).toEqual(
      artifact.recipes.map((recipe) => recipe.id).sort(),
    );
    expect(artifact.diagnostics.length).toBe(8);
    expect(createMonetizationLifecycleArtifact(recipes, allCapabilities()).diagnostics).toEqual([]);
  });

  it("fails explicitly when an individually installed recipe lacks a source or action", async () => {
    const recipe = createDeliveryBacklogEscalationRecipe();

    const installation = installMonetizationRecipe(
      new LifecycleRuleRegistry(),
      recipe,
      { signalSources: [], actionTypes: [] },
      { activate: true },
    );
    await expect(installation).rejects.toThrow(MonetizationRecipeCapabilityProblem);
    await expect(installation).rejects.toMatchObject({
      code: "lifecycle-core/monetization-recipe-capability-missing",
      extensions: {
        recipeId: "monetization.delivery-backlog-escalation",
      },
    } satisfies Partial<MonetizationRecipeCapabilityProblem>);
  });

  it("supports versioned activation and dry-run without dispatching an action", async () => {
    const registry = new LifecycleRuleRegistry();
    const recipe = createPastDueGraceFollowUpRecipe();
    const dryRunStore = new InMemoryLifecycleDryRunStore();
    const sink = new InMemoryLifecycleActionSink();
    const evaluator = new LifecycleRuleEvaluator({
      registry,
      runStore: new InMemoryLifecycleRunStore(),
      dryRunStore,
      actionAdapter: sink,
    });
    const registration = await installMonetizationRecipe(registry, recipe, allCapabilities(), {
      activate: true,
      registeredAt: EFFECTIVE_AT,
    });
    const context = createLifecycleContext({
      now: EFFECTIVE_AT,
      signal: createSubscriptionPastDueSignal({
        tenantId: "tenant-1",
        planVersionRef: PLAN_V1,
        conditionId: "delinquency-1",
        reason: "payment_failed",
        effectiveAt: EFFECTIVE_AT,
        sourceAt: SOURCE_AT,
      }),
    });

    const preview = await evaluator.dryRun({
      ruleId: recipe.descriptor.id,
      version: recipe.descriptor.version,
      context,
    });

    expect(registration.descriptor).toMatchObject({
      ruleId: recipe.descriptor.id,
      contextRequirements: recipe.descriptor.contextRequirements,
    });
    expect(preview).toMatchObject({
      matched: true,
      state: "active",
      proposedActions: [{ id: "past-due-notification" }, { id: "past-due-cs-follow-up" }],
    });
    expect(sink.getEmissions()).toHaveLength(0);
    expect(await dryRunStore.list()).toHaveLength(1);
  });

  it("correlates recovery and does not replay completed delinquency actions", async () => {
    const registry = new LifecycleRuleRegistry();
    const store = new InMemoryLifecycleRunStore();
    const sink = new InMemoryLifecycleActionSink();
    const evaluator = new LifecycleRuleEvaluator({
      registry,
      runStore: store,
      actionAdapter: sink,
    });
    await installMonetizationRecipe(
      registry,
      createPastDueGraceFollowUpRecipe(),
      allCapabilities(),
      { activate: true },
    );
    const pastDue = createSubscriptionPastDueSignal({
      tenantId: "tenant-1",
      planVersionRef: PLAN_V1,
      conditionId: "delinquency-1",
      reason: "payment_failed",
      effectiveAt: EFFECTIVE_AT,
      sourceAt: SOURCE_AT,
    });
    const recovered = createSubscriptionRecoveredSignal({
      tenantId: "tenant-1",
      planVersionRef: PLAN_V1,
      conditionId: "recovery-1",
      recoveredConditionId: "delinquency-1",
      effectiveAt: new Date("2026-07-21T00:00:00.000Z"),
      sourceAt: new Date("2026-07-21T00:00:01.000Z"),
    });

    await evaluator.evaluate(createLifecycleContext({ signal: pastDue, now: EFFECTIVE_AT }));
    await evaluator.evaluate(
      createLifecycleContext({
        signal: recovered,
        now: new Date("2026-07-21T00:00:00.000Z"),
      }),
    );
    await evaluator.evaluate(
      createLifecycleContext({
        signal: recovered,
        now: new Date("2026-07-21T00:00:00.000Z"),
      }),
    );

    expect(sink.getEmissions().map((emission) => emission.action.id)).toEqual([
      "past-due-notification",
      "past-due-cs-follow-up",
      "billing-recovery-closed",
    ]);
    expect(sink.getEmissions()[2]?.action.payload).toMatchObject({
      recoveryOf: "delinquency-1",
    });
    const diagnostics = await new LifecycleDiagnosticsProvider(store).getHealth();
    expect(diagnostics.details).toMatchObject({
      monetizationSignalsByType: {
        "billing.subscription.past_due": 1,
        "billing.subscription.recovered": 1,
      },
    });
  });

  it("suppresses a delayed past-due transition after its correlated recovery", async () => {
    const tracker = new MonetizationSubscriptionConditionTracker(
      new InMemoryMonetizationConditionStore(),
    );
    const recovered = await tracker.observeRecovered({
      tenantId: "tenant-1",
      planVersionRef: PLAN_V1,
      conditionId: "recovery-1",
      recoveredConditionId: "delinquency-1",
      effectiveAt: EFFECTIVE_AT,
      sourceAt: SOURCE_AT,
    });
    const delayedPastDue = await tracker.observePastDue({
      tenantId: "tenant-1",
      planVersionRef: PLAN_V1,
      conditionId: "delinquency-1",
      reason: "payment_failed",
      effectiveAt: new Date("2026-07-19T00:00:00.000Z"),
      sourceAt: new Date("2026-07-19T00:00:01.000Z"),
    });

    expect(recovered.signal?.data.recoveryOf).toBe("delinquency-1");
    expect(delayedPastDue).toMatchObject({ signal: null, outOfOrder: true });
  });

  it("returns deterministic duplicate transitions so lifecycle delivery can be retried", async () => {
    const tracker = new MonetizationSubscriptionConditionTracker(
      new InMemoryMonetizationConditionStore(),
    );
    const input = {
      tenantId: "tenant-1",
      planVersionRef: PLAN_V1,
      conditionId: "delinquency-1",
      reason: "payment_failed" as const,
      effectiveAt: EFFECTIVE_AT,
      sourceAt: SOURCE_AT,
    };

    const first = await tracker.observePastDue(input);
    const replay = await tracker.observePastDue(input);

    expect(first.signal?.id).toBeTruthy();
    expect(replay).toMatchObject({
      signal: { id: first.signal?.id },
      duplicate: true,
      outOfOrder: false,
    });
  });

  it("does not suppress credit exhaustion after a low-balance warning", async () => {
    const registry = new LifecycleRuleRegistry();
    const sink = new InMemoryLifecycleActionSink();
    const evaluator = new LifecycleRuleEvaluator({
      registry,
      runStore: new InMemoryLifecycleRunStore(),
      actionAdapter: sink,
    });
    const recipe = createMonetizationReferenceRecipes().find(
      (candidate) => candidate.descriptor.id === "monetization.low-credit-warning",
    );
    expect(recipe).toBeDefined();
    if (!recipe) {
      return;
    }
    await installMonetizationRecipe(registry, recipe, allCapabilities(), { activate: true });
    await evaluator.evaluate(
      createLifecycleContext({
        signal: createCreditBalanceLowSignal({
          tenantId: "tenant-1",
          conditionId: "credit-1",
          balance: 10,
          threshold: 20,
          unit: "credits",
          effectiveAt: EFFECTIVE_AT,
          sourceAt: SOURCE_AT,
        }),
        now: EFFECTIVE_AT,
      }),
    );
    await evaluator.evaluate(
      createLifecycleContext({
        signal: createCreditBalanceLowSignal({
          tenantId: "tenant-1",
          conditionId: "credit-1",
          balance: 9,
          threshold: 20,
          unit: "credits",
          effectiveAt: new Date("2026-07-20T00:30:00.000Z"),
          sourceAt: new Date("2026-07-20T00:30:01.000Z"),
        }),
        now: new Date("2026-07-20T00:30:00.000Z"),
      }),
    );
    await evaluator.evaluate(
      createLifecycleContext({
        signal: createCreditExhaustedSignal({
          tenantId: "tenant-1",
          conditionId: "credit-1",
          balance: 0,
          unit: "credits",
          effectiveAt: new Date("2026-07-20T01:00:00.000Z"),
          sourceAt: new Date("2026-07-20T01:00:01.000Z"),
        }),
        now: new Date("2026-07-20T01:00:00.000Z"),
      }),
    );

    expect(sink.getEmissions()).toHaveLength(2);
  });

  it("uses lifecycle cooldown semantics to suppress repeated reminder actions", async () => {
    const registry = new LifecycleRuleRegistry();
    const runStore = new InMemoryLifecycleRunStore();
    const sink = new InMemoryLifecycleActionSink();
    const evaluator = new LifecycleRuleEvaluator({
      registry,
      runStore,
      actionAdapter: sink,
    });
    const recipe = createTrialEndingReminderRecipe();
    await installMonetizationRecipe(registry, recipe, allCapabilities(), { activate: true });

    const first = createTrialEndingSignal({
      tenantId: "tenant-1",
      planVersionRef: PLAN_V1,
      trialEndsAt: PERIOD_END,
      daysRemaining: 12,
      effectiveAt: EFFECTIVE_AT,
      sourceAt: SOURCE_AT,
    });
    const repeated = createTrialEndingSignal({
      tenantId: "tenant-1",
      planVersionRef: PLAN_V1,
      trialEndsAt: new Date("2026-08-02T00:00:00.000Z"),
      daysRemaining: 13,
      effectiveAt: new Date("2026-07-20T01:00:00.000Z"),
      sourceAt: new Date("2026-07-20T01:00:01.000Z"),
    });

    await evaluator.evaluate(createLifecycleContext({ signal: first, now: EFFECTIVE_AT }));
    const result = await evaluator.evaluate(
      createLifecycleContext({
        signal: repeated,
        now: new Date("2026-07-20T01:00:00.000Z"),
      }),
    );

    expect(result.runs).toEqual([
      expect.objectContaining({ status: "skipped", skipReason: "cooldown_active" }),
    ]);
    expect(sink.getEmissions()).toHaveLength(1);
  });

  it("reports signal counts, duplicate crossings, failed actions, and latest recovery state", async () => {
    const registry = new LifecycleRuleRegistry();
    const runStore = new InMemoryLifecycleRunStore();
    const thresholdStore = new InMemoryMonetizationThresholdStore();
    const tracker = new MonetizationThresholdTracker(thresholdStore);
    const sink = new InMemoryLifecycleActionSink({
      failActionIds: ["billing-recovery-closed"],
    });
    const evaluator = new LifecycleRuleEvaluator({
      registry,
      runStore,
      actionAdapter: sink,
    });
    await installMonetizationRecipe(
      registry,
      createPastDueGraceFollowUpRecipe(),
      allCapabilities(),
      { activate: true },
    );
    const recovered = createSubscriptionRecoveredSignal({
      tenantId: "tenant-1",
      planVersionRef: PLAN_V1,
      conditionId: "recovery-1",
      recoveredConditionId: "delinquency-1",
      effectiveAt: EFFECTIVE_AT,
      sourceAt: SOURCE_AT,
    });
    await evaluator.evaluate(createLifecycleContext({ signal: recovered, now: EFFECTIVE_AT }));
    const firstCrossing = await tracker.evaluate({
      ...thresholdInput(900),
      thresholds: [0.8],
    });
    await tracker.acknowledge(firstCrossing);
    await tracker.evaluate({
      ...thresholdInput(950, { sourceAt: new Date("2026-07-20T00:00:02.000Z") }),
      thresholds: [0.8],
    });

    const diagnostics = await new LifecycleDiagnosticsProvider(runStore, {
      registry,
      monetizationThresholdStore: thresholdStore,
    }).getHealth();

    expect(diagnostics.details).toMatchObject({
      failedActionCount: 1,
      monetizationSignalsByType: {
        "billing.subscription.recovered": 1,
      },
      suppressedMonetizationCrossingCount: 1,
      latestMonetizationRecovery: {
        signalId: recovered.id,
        status: "failed",
      },
    });
  });

  it("reports live capability drift for enabled recipe contracts", async () => {
    const recipe = createDeliveryBacklogEscalationRecipe();
    const diagnostics = await new LifecycleDiagnosticsProvider(new InMemoryLifecycleRunStore(), {
      monetizationRecipes: [recipe],
      monetizationCapabilitySource: {
        getCapabilities: () => ({ signalSources: [], actionTypes: [] }),
      },
    }).getHealth();

    expect(diagnostics).toMatchObject({
      status: "degraded",
      details: {
        monetizationCapabilityDiagnostics: [
          {
            recipeId: "monetization.delivery-backlog-escalation",
            code: "lifecycle-core/monetization-recipe-capability-missing",
          },
        ],
      },
    });
  });

  it("degrades with traceable diagnostics when monetization dependencies fail or are absent", async () => {
    const recipe = createDeliveryBacklogEscalationRecipe();
    const failed = await new LifecycleDiagnosticsProvider(new InMemoryLifecycleRunStore(), {
      monetizationThresholdStore: {
        claimCrossings: async () => ({
          crossedThresholds: [],
          suppressedDuplicateCount: 0,
          outOfOrder: false,
        }),
        acknowledgeCrossings: async () => undefined,
        releaseCrossings: async () => undefined,
        getDiagnostics: async () => {
          throw new Error("threshold store unavailable");
        },
      },
      monetizationRecipes: [recipe],
    }).getHealth();

    expect(failed).toMatchObject({
      status: "degraded",
      details: {
        monetizationOperationalDiagnostics: [
          {
            code: "lifecycle-core/monetization-threshold-diagnostics-failed",
            cause: "threshold store unavailable",
          },
          { code: "lifecycle-core/monetization-capability-source-missing" },
        ],
      },
    });
  });

  it("bounds live capability discovery with a diagnostics deadline", async () => {
    const diagnostics = await new LifecycleDiagnosticsProvider(new InMemoryLifecycleRunStore(), {
      monetizationRecipes: [createDeliveryBacklogEscalationRecipe()],
      monetizationCapabilitySource: {
        getCapabilities: () => new Promise(() => undefined),
      },
      monetizationDiagnosticsTimeoutMs: 1,
    }).getHealth();

    expect(diagnostics).toMatchObject({
      status: "degraded",
      details: {
        monetizationOperationalDiagnostics: [
          { code: "lifecycle-core/monetization-capability-source-timeout" },
        ],
      },
    });
  });

  it("rejects facts that do not satisfy the signal they claim to represent", () => {
    expect(() =>
      createUsageThresholdCrossedSignal({
        ...thresholdInput(100),
        threshold: 0.8,
      }),
    ).toThrow("consumed-to-limit ratio must meet or exceed threshold");
    expect(() =>
      createCreditBalanceLowSignal({
        tenantId: "tenant-1",
        conditionId: "credit-1",
        balance: 100,
        threshold: 10,
        unit: "credits",
        effectiveAt: EFFECTIVE_AT,
        sourceAt: SOURCE_AT,
      }),
    ).toThrow("balance must be less than or equal to threshold");
    expect(() =>
      createCreditExhaustedSignal({
        tenantId: "tenant-1",
        conditionId: "credit-1",
        balance: 1,
        unit: "credits",
        effectiveAt: EFFECTIVE_AT,
        sourceAt: SOURCE_AT,
      }),
    ).toThrow("balance must be zero");
    expect(() =>
      createSeatQuantityDriftedSignal({
        tenantId: "tenant-1",
        planVersionRef: PLAN_V1,
        conditionId: "seat-drift-1",
        expectedQuantity: 10,
        observedQuantity: 10,
        effectiveAt: EFFECTIVE_AT,
        sourceAt: SOURCE_AT,
      }),
    ).toThrow("expectedQuantity and observedQuantity must differ");
    expect(() =>
      createUsageSyncDriftedSignal({
        tenantId: "tenant-1",
        planVersionRef: PLAN_V1,
        conditionId: "usage-drift-1",
        meterKey: "ai.tokens",
        localRecorded: 100,
        upstreamObserved: 100,
        tolerance: 1,
        periodStartsAt: PERIOD_START,
        periodEndsAt: PERIOD_END,
        effectiveAt: EFFECTIVE_AT,
        sourceAt: SOURCE_AT,
      }),
    ).toThrow("absolute usage difference must exceed tolerance");
    expect(() =>
      createUsageDeliveryLaggingSignal({
        tenantId: "tenant-1",
        planVersionRef: PLAN_V1,
        conditionId: "delivery-1",
        meterKey: "ai.tokens",
        pendingRecordCount: 0,
        oldestPendingAt: PERIOD_START,
        periodEndsAt: PERIOD_END,
        effectiveAt: EFFECTIVE_AT,
        sourceAt: SOURCE_AT,
      }),
    ).toThrow("pendingRecordCount must be a finite number");
    expect(() =>
      createTrialEndingSignal({
        tenantId: "tenant-1",
        planVersionRef: PLAN_V1,
        trialEndsAt: PERIOD_END,
        daysRemaining: 1,
        effectiveAt: new Date("invalid"),
        sourceAt: SOURCE_AT,
      }),
    ).toThrow("effectiveAt must be a valid date");
  });
});
