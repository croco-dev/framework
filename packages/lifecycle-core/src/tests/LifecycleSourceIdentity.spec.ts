import { beforeEach, describe, expect, it } from "vitest";
import {
  InMemoryLifecycleActionSink,
  InMemoryLifecycleRunStore,
  LifecycleRuleEvaluator,
  LifecycleRuleRegistry,
  buildLegacyLifecycleIdempotencyKey,
  createLifecycleContext,
  createScheduledLifecycleSignal,
  encodeLifecycleCustomKey,
  encodeLifecycleSourceKey,
  ensureDurableLifecycleSignal,
  fingerprintLifecycleSourcePayload,
} from "../index";
import type { LifecycleFinalizedRun, LifecycleRule } from "../index";

const NOW = new Date("2026-09-30T00:00:00.000Z");

function createRule(overrides: Partial<LifecycleRule> = {}): LifecycleRule {
  return {
    id: "source-identity-rule",
    description: "Source identity regression rule",
    triggers: [{ type: "scheduled.reevaluation" }],
    severity: "low",
    ...overrides,
    actions: overrides.actions ?? [{ id: "follow-up", type: "cs.follow_up" }],
  };
}

async function setup(
  options: { readonly receiptTtlMs?: number; readonly rule?: LifecycleRule } = {},
) {
  const registry = new LifecycleRuleRegistry();
  const rule = options.rule ?? createRule();
  registry.register(rule);
  const identity = await registry.getIdentityState(rule.id);
  const ruleVersion = identity?.versions[0]?.descriptor.version;
  if (!ruleVersion) {
    throw new Error("expected source identity registration");
  }
  const store = new InMemoryLifecycleRunStore(
    options.receiptTtlMs === undefined ? {} : { receiptTtlMs: options.receiptTtlMs },
  );
  const sink = new InMemoryLifecycleActionSink();
  const evaluator = new LifecycleRuleEvaluator({ registry, runStore: store, actionAdapter: sink });
  return { evaluator, sink, store, ruleVersion };
}

function contextFor(input: {
  readonly signalId?: string;
  readonly source?: string;
  readonly reason?: string;
  readonly data?: Record<string, unknown>;
  readonly occurredAt?: Date;
  readonly tenantId?: string;
  readonly now?: Date;
}) {
  const occurredAt = input.occurredAt ?? NOW;
  const signal = createScheduledLifecycleSignal({
    ...(input.signalId !== undefined ? { signalId: input.signalId } : {}),
    tenantId: input.tenantId ?? "tenant-1",
    reason: input.reason ?? "same",
    occurredAt,
  });
  return createLifecycleContext({
    now: input.now ?? occurredAt,
    signal: {
      ...signal,
      ...(input.source !== undefined ? { source: input.source } : {}),
      ...(input.data !== undefined ? { data: { ...signal.data, ...input.data } } : {}),
    },
  });
}

describe("LifecycleSourceIdentity", () => {
  let sink!: InMemoryLifecycleActionSink;

  beforeEach(() => {
    sink = new InMemoryLifecycleActionSink();
  });

  it("executes distinct source events that share timestamp and payload", async () => {
    const { evaluator } = await setup();
    const first = await evaluator.evaluate(contextFor({ signalId: "evt-A" }));
    const second = await evaluator.evaluate(contextFor({ signalId: "evt-B" }));

    expect(first.runs[0]?.status).toBe("succeeded");
    expect(second.runs[0]?.status).toBe("succeeded");
    expect(first.runs[0]?.id).not.toBe(second.runs[0]?.id);
    expect(first.runs[0]?.idempotencyKey).not.toBe(second.runs[0]?.idempotencyKey);
  });

  it("keeps the source namespace in the dedupe tuple", async () => {
    const { evaluator } = await setup();
    const first = await evaluator.evaluate(contextFor({ signalId: "evt-1", source: "billing" }));
    const second = await evaluator.evaluate(contextFor({ signalId: "evt-1", source: "metering" }));

    expect(first.runs[0]?.status).toBe("succeeded");
    expect(second.runs[0]?.status).toBe("succeeded");
  });

  it("keeps tenant in the source key tuple", async () => {
    const { evaluator } = await setup();
    const first = await evaluator.evaluate(contextFor({ signalId: "evt-1", tenantId: "tenant-1" }));
    const second = await evaluator.evaluate(
      contextFor({ signalId: "evt-1", tenantId: "tenant-2" }),
    );

    expect(first.runs[0]?.status).toBe("succeeded");
    expect(second.runs[0]?.status).toBe("succeeded");
  });

  it("returns the same logical run for serial and concurrent redelivery", async () => {
    const { evaluator, store } = await setup();
    const first = await evaluator.evaluate(contextFor({ signalId: "evt-1" }));
    const second = await evaluator.evaluate(contextFor({ signalId: "evt-1" }));
    const concurrent = await Promise.all([
      evaluator.evaluate(contextFor({ signalId: "evt-1" })),
      evaluator.evaluate(contextFor({ signalId: "evt-1" })),
    ]);

    expect(first.runs[0]?.status).toBe("succeeded");
    expect(second.runs[0]).toMatchObject({
      status: "skipped",
      skipReason: "idempotency_key_reused",
      id: first.runs[0]?.id,
    });
    for (const result of concurrent) {
      expect(result.runs[0]).toMatchObject({
        status: "skipped",
        skipReason: "idempotency_key_reused",
        id: first.runs[0]?.id,
      });
    }
    const succeeded = (await store.list()).filter((run) => run.status === "succeeded");
    expect(succeeded).toHaveLength(1);
  });

  it("treats redelivery as the same run across evaluator restarts", async () => {
    const registry = new LifecycleRuleRegistry();
    registry.register(createRule());
    const store = new InMemoryLifecycleRunStore();
    const firstEvaluator = new LifecycleRuleEvaluator({
      registry,
      runStore: store,
      actionAdapter: sink,
    });
    const first = await firstEvaluator.evaluate(contextFor({ signalId: "evt-1" }));

    const restartedEvaluator = new LifecycleRuleEvaluator({
      registry,
      runStore: store,
      actionAdapter: new InMemoryLifecycleActionSink(),
    });
    const second = await restartedEvaluator.evaluate(contextFor({ signalId: "evt-1" }));

    expect(first.runs[0]?.status).toBe("succeeded");
    expect(second.runs[0]).toMatchObject({
      status: "skipped",
      skipReason: "idempotency_key_reused",
      id: first.runs[0]?.id,
    });
    const succeeded = (await store.list()).filter((run) => run.status === "succeeded");
    expect(succeeded).toHaveLength(1);
  });

  it("rejects signals without a durable source identity as a typed Problem", async () => {
    const { evaluator } = await setup();
    const result = await evaluator.evaluate(contextFor({}));

    expect(result.runs[0]).toMatchObject({
      status: "failed",
      error: { code: "lifecycle-core/source-identity-missing" },
    });
    expect(sink.getEmissions()).toHaveLength(0);
  });

  it("surfaces a conflict when the same identity carries a different payload", async () => {
    const { evaluator, sink: emissions } = await setup();
    const first = await evaluator.evaluate(contextFor({ signalId: "evt-1", reason: "original" }));
    const second = await evaluator.evaluate(contextFor({ signalId: "evt-1", reason: "tampered" }));

    expect(first.runs[0]?.status).toBe("succeeded");
    expect(second.runs[0]).toMatchObject({
      status: "failed",
      error: { code: "lifecycle-core/source-payload-conflict" },
    });
    expect(second.runs[0]?.error?.message).toContain(first.runs[0]?.id ?? "");
    expect(emissions.getEmissions()).toHaveLength(1);
  });

  it("ignores receiver timestamp and attempt metadata in the conflict fingerprint", async () => {
    const { evaluator } = await setup();
    const first = await evaluator.evaluate(
      contextFor({
        signalId: "evt-1",
        reason: "same",
        data: { semantic: "value", receivedAt: "2026-09-30T00:00:00.000Z", attempt: 1 },
      }),
    );
    const second = await evaluator.evaluate(
      contextFor({
        signalId: "evt-1",
        reason: "same",
        data: { semantic: "value", receivedAt: "2026-09-30T00:05:00.000Z", attempt: 4 },
      }),
    );

    expect(first.runs[0]?.status).toBe("succeeded");
    expect(second.runs[0]).toMatchObject({
      status: "skipped",
      skipReason: "idempotency_key_reused",
      id: first.runs[0]?.id,
    });
  });

  it("treats explicit custom keys as business coalescing across distinct sources", async () => {
    const {
      evaluator,
      ruleVersion,
      sink: emissions,
    } = await setup({
      rule: createRule({ idempotencyKey: ({ context }) => context.signal.tenantId }),
    });
    const first = await evaluator.evaluate(contextFor({ signalId: "evt-A" }));
    const second = await evaluator.evaluate(contextFor({ signalId: "evt-B" }));

    expect(first.runs[0]?.status).toBe("succeeded");
    expect(second.runs[0]).toMatchObject({
      status: "skipped",
      skipReason: "idempotency_key_reused",
      id: first.runs[0]?.id,
    });
    expect(second.runs[0]?.idempotencyKey).toBe(
      encodeLifecycleCustomKey({
        ruleId: "source-identity-rule",
        ruleVersion,
        tenantId: "tenant-1",
        customKey: "tenant-1",
      }),
    );
    expect(emissions.getEmissions()).toHaveLength(1);
  });

  it("aligns receipt retention with the replay horizon", async () => {
    const receiptTtlMs = 60_000;
    const { evaluator } = await setup({ receiptTtlMs });
    const first = await evaluator.evaluate(contextFor({ signalId: "evt-1" }));
    const retained = await evaluator.evaluate(
      contextFor({ signalId: "evt-1", now: new Date(NOW.getTime() + 30_000) }),
    );
    const expired = await evaluator.evaluate(
      contextFor({ signalId: "evt-1", now: new Date(NOW.getTime() + receiptTtlMs + 1) }),
    );

    expect(first.runs[0]?.status).toBe("succeeded");
    expect(retained.runs[0]).toMatchObject({
      status: "skipped",
      skipReason: "idempotency_key_reused",
      id: first.runs[0]?.id,
    });
    expect(expired.runs[0]?.status).toBe("succeeded");
    expect(expired.runs[0]?.id).not.toBe(first.runs[0]?.id);
  });

  it("migrates persisted receipts issued with the legacy default key", async () => {
    const { evaluator, ruleVersion, store } = await setup();
    const at = NOW;
    const legacyKey = buildLegacyLifecycleIdempotencyKey({
      ruleId: "source-identity-rule",
      ruleVersion,
      tenantId: "tenant-1",
      signalType: "scheduled.reevaluation",
      signalId: "evt-legacy",
      occurredAt: at,
    });
    const legacyRun: LifecycleFinalizedRun = {
      id: "legacy-run",
      ruleId: "source-identity-rule",
      ruleVersion,
      ruleFingerprint: "fingerprint",
      tenantId: "tenant-1",
      signalType: "scheduled.reevaluation",
      signalId: "evt-legacy",
      signalSource: "scheduler",
      severity: "low",
      status: "succeeded",
      idempotencyKey: legacyKey,
      actionResults: [],
      startedAt: at,
      completedAt: at,
    };
    await store.save(legacyRun);

    const redelivery = await evaluator.evaluate(
      contextFor({ signalId: "evt-legacy", source: "scheduler" }),
    );
    expect(redelivery.runs[0]).toMatchObject({
      status: "skipped",
      skipReason: "idempotency_key_reused",
      id: "legacy-run",
    });
  });

  it("issues ingress identity once and preserves it on redelivery", () => {
    const signal = createScheduledLifecycleSignal({
      tenantId: "tenant-1",
      reason: "ingress",
      occurredAt: NOW,
    });
    const issued = ensureDurableLifecycleSignal({ signal });
    const redelivered = ensureDurableLifecycleSignal({ signal, sourceEventId: issued.id });

    expect(issued.id).toMatch(/^source_event_/);
    expect(redelivered.id).toBe(issued.id);
  });

  it("derives tuple keys and fingerprints from stable identity, not timestamps", async () => {
    const { ruleVersion } = await setup();
    const identity = {
      ruleId: "source-identity-rule",
      ruleVersion,
      tenantId: "tenant-1",
      signalType: "scheduled.reevaluation",
      sourceNamespace: "scheduler",
      sourceEventId: "evt-1",
    };
    const signal = createScheduledLifecycleSignal({
      signalId: "evt-1",
      tenantId: "tenant-1",
      reason: "same",
      occurredAt: NOW,
    });

    expect(encodeLifecycleSourceKey(identity)).not.toContain(NOW.toISOString());
    expect(fingerprintLifecycleSourcePayload(signal)).toBe(
      fingerprintLifecycleSourcePayload({ ...signal, occurredAt: new Date(NOW.getTime() + 5_000) }),
    );
  });
});
