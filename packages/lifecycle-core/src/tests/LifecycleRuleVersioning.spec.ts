import { describe, expect, it } from "vitest";
import {
  InMemoryLifecycleActionSink,
  InMemoryLifecycleDryRunStore,
  InMemoryLifecycleRuleStateStore,
  InMemoryLifecycleRunStore,
  LifecycleDiagnosticsProvider,
  LifecycleRuleCommandConflictProblem,
  LifecycleRuleEvaluator,
  LifecycleRuleRegistry,
  LifecycleRuleTransitionProblem,
  LifecycleRuleVersionConflictProblem,
  LifecycleRuleVersionDefinitionProblem,
  UnavailableLifecycleRuleVersionProblem,
  createLifecycleContext,
  createScheduledLifecycleSignal,
} from "../index";
import type {
  LifecycleRule,
  LifecycleRuleStateStore,
  LifecycleRuleVersionDescriptor,
  LifecycleRuleVersionRecord,
  LifecycleRun,
  LifecycleRunClaim,
} from "../index";

const NOW = new Date("2026-07-26T00:00:00.000Z");

function createRule(versionLabel = "v1"): LifecycleRule {
  return {
    id: "retention-risk",
    description: `Retention risk ${versionLabel}`,
    triggers: [{ type: "scheduled.reevaluation" }],
    severity: "high",
    cooldown: { durationMs: 60_000 },
    when: (context) => context.metadata?.atRisk === true,
    conditionEvidence: (context) => ({
      atRisk: context.metadata?.atRisk === true,
      onboardingIncomplete: context.onboarding?.isCompleted !== true,
    }),
    actions: [
      {
        id: "create-follow-up",
        type: "cs.follow_up",
        title: "Create follow-up",
        payload: { secret: "must-not-leak" },
      },
    ],
  };
}

function createContext(signalId = "signal-1", now = NOW) {
  return createLifecycleContext({
    now,
    signal: {
      ...createScheduledLifecycleSignal({
        signalId,
        tenantId: "tenant-1",
        reason: "retention-risk",
        occurredAt: now,
      }),
      data: {
        secretSignalValue: "sensitive-signal-value",
      },
    },
    onboarding: { status: "in_progress", isCompleted: false },
    metadata: {
      atRisk: true,
      secretToken: "sensitive-context-value",
    },
  });
}

function registerVersion(
  registry: LifecycleRuleRegistry,
  version: string,
  options: { readonly activate?: boolean; readonly executableRegistrationId?: string } = {},
) {
  return registry.registerVersion({
    rule: createRule(version),
    version,
    executableRegistrationId: options.executableRegistrationId ?? `retention-risk:${version}`,
    executableFingerprint: `retention-risk-bundle:${version}`,
    contextRequirements: ["metadata.atRisk", "onboarding.isCompleted"],
    activate: options.activate,
  });
}

class AsyncLifecycleRuleStateStore implements LifecycleRuleStateStore {
  constructor(private readonly delegate = new InMemoryLifecycleRuleStateStore()) {}

  async get(ruleId: string) {
    await Promise.resolve();
    return this.delegate.get(ruleId);
  }

  async saveRegistration(record: LifecycleRuleVersionRecord) {
    await Promise.resolve();
    return this.delegate.saveRegistration(record);
  }

  async applyCommand(input: Parameters<LifecycleRuleStateStore["applyCommand"]>[0]) {
    await Promise.resolve();
    return this.delegate.applyCommand(input);
  }

  async claimExecution(input: Parameters<LifecycleRuleStateStore["claimExecution"]>[0]) {
    await Promise.resolve();
    return this.delegate.claimExecution(input);
  }

  async releaseExecution(claimId: string) {
    await Promise.resolve();
    return this.delegate.releaseExecution(claimId);
  }

  async list() {
    await Promise.resolve();
    return this.delegate.list();
  }
}

describe("LifecycleRuleRegistry versioning", () => {
  it("creates a deterministic rule fingerprint from declared executable inputs", async () => {
    const registry = new LifecycleRuleRegistry();

    const registration = await registerVersion(registry, "1.0.0", { activate: true });

    expect(registration.descriptor).toMatchObject({
      ruleId: "retention-risk",
      version: "1.0.0",
      executableRegistrationId: "retention-risk:1.0.0",
      contextRequirements: ["metadata.atRisk", "onboarding.isCompleted"],
      actions: [{ id: "create-follow-up", type: "cs.follow_up" }],
    });
    expect(registration.descriptor.fingerprint).toBe(
      "1c4137f6897fdf4b3e14d6731e00246b0c34a6223931adce9eaa322d20d92e39",
    );
  });

  it("keeps a changed registration inactive until an explicit activation supersedes the active version", async () => {
    const registry = new LifecycleRuleRegistry();
    const first = await registerVersion(registry, "1.0.0", { activate: true });
    const second = await registerVersion(registry, "2.0.0");

    expect(await registry.inspect()).toMatchObject([
      { version: "1.0.0", state: "active", revision: 1 },
      { version: "2.0.0", state: "inactive", revision: 1 },
    ]);

    await registry.activate({
      commandId: "activate-v2",
      ruleId: "retention-risk",
      version: "2.0.0",
      expectedRevision: 1,
      actor: "operator-1",
      reason: "reviewed rollout",
      at: NOW,
    });

    expect(await registry.inspect()).toMatchObject([
      {
        version: "1.0.0",
        fingerprint: first.descriptor.fingerprint,
        state: "superseded",
        revision: 2,
      },
      {
        version: "2.0.0",
        fingerprint: second.descriptor.fingerprint,
        state: "active",
        revision: 2,
      },
    ]);
    expect((await registry.getIdentityState("retention-risk"))?.history).toMatchObject([
      { command: "activate", version: "1.0.0", revision: 1 },
      {
        command: "activate",
        version: "2.0.0",
        revision: 2,
        actor: "operator-1",
        reason: "reviewed rollout",
      },
    ]);
  });

  it("rejects immutable version drift and silent replacement during registration", async () => {
    const registry = new LifecycleRuleRegistry();
    await registerVersion(registry, "1.0.0", { activate: true });

    await expect(
      registry.registerVersion({
        rule: { ...createRule("changed"), severity: "critical" },
        version: "1.0.0",
        executableRegistrationId: "retention-risk:1.0.0",
        executableFingerprint: "retention-risk-bundle:1.0.0",
        contextRequirements: ["metadata.atRisk", "onboarding.isCompleted"],
      }),
    ).rejects.toThrow(LifecycleRuleVersionDefinitionProblem);
    await expect(
      registry.registerVersion({
        rule: {
          ...createRule("changed-payload"),
          actions: [
            {
              id: "create-follow-up",
              type: "cs.follow_up",
              title: "Create follow-up",
              payload: { secret: "changed-configuration" },
            },
          ],
        },
        version: "1.0.0",
        executableRegistrationId: "retention-risk:1.0.0",
        executableFingerprint: "retention-risk-bundle:1.0.0",
        contextRequirements: ["metadata.atRisk", "onboarding.isCompleted"],
      }),
    ).rejects.toThrow(LifecycleRuleVersionDefinitionProblem);
    await expect(registerVersion(registry, "2.0.0", { activate: true })).rejects.toThrow(
      LifecycleRuleVersionDefinitionProblem,
    );
  });

  it("uses optimistic concurrency and command idempotency for activation transitions", async () => {
    const registry = new LifecycleRuleRegistry();
    await registerVersion(registry, "1.0.0", { activate: true });
    await registerVersion(registry, "2.0.0");
    await registry.activate({
      commandId: "activate-v2",
      ruleId: "retention-risk",
      version: "2.0.0",
      expectedRevision: 1,
    });

    const pause = {
      commandId: "pause-v2",
      ruleId: "retention-risk",
      version: "2.0.0",
      expectedRevision: 2,
      at: NOW,
    } as const;
    const results = await Promise.allSettled([
      Promise.resolve().then(() => registry.pause(pause)),
      Promise.resolve().then(() =>
        registry.pause({
          ...pause,
          commandId: "concurrent-pause-v2",
        }),
      ),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toMatchObject([
      {
        reason: expect.any(LifecycleRuleVersionConflictProblem),
      },
    ]);
    await expect(registry.pause(pause)).resolves.toMatchObject({
      replayed: true,
      state: { revision: 3 },
    });
    await expect(registry.pause({ ...pause, reason: "different input" })).rejects.toThrow(
      LifecycleRuleCommandConflictProblem,
    );

    await registry.resume({
      commandId: "resume-v2",
      ruleId: "retention-risk",
      version: "2.0.0",
      expectedRevision: 3,
    });
    const idempotentResume = await registry.resume({
      commandId: "resume-v2-again",
      ruleId: "retention-risk",
      version: "2.0.0",
      expectedRevision: 4,
    });

    expect(idempotentResume.state.revision).toBe(4);
    expect((await registry.inspect()).find((rule) => rule.version === "2.0.0")?.state).toBe(
      "active",
    );
    await expect(
      registry.activate({
        commandId: "reactivate-v1",
        ruleId: "retention-risk",
        version: "1.0.0",
        expectedRevision: 4,
      }),
    ).rejects.toThrow(LifecycleRuleTransitionProblem);
  });

  it("supports atomic activation commands through a shared asynchronous durable-store contract", async () => {
    const stateStore = new AsyncLifecycleRuleStateStore();
    const firstRegistry = new LifecycleRuleRegistry({ stateStore });
    const secondRegistry = new LifecycleRuleRegistry({ stateStore });
    await registerVersion(firstRegistry, "1.0.0", { activate: true });
    await registerVersion(secondRegistry, "1.0.0", { activate: true });

    const results = await Promise.allSettled([
      firstRegistry.pause({
        commandId: "first-process-pause",
        ruleId: "retention-risk",
        version: "1.0.0",
        expectedRevision: 1,
      }),
      secondRegistry.pause({
        commandId: "second-process-pause",
        ruleId: "retention-risk",
        version: "1.0.0",
        expectedRevision: 1,
      }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toMatchObject([
      { reason: expect.any(LifecycleRuleVersionConflictProblem) },
    ]);
    expect((await firstRegistry.getIdentityState("retention-risk"))?.history).toHaveLength(2);
  });

  it("fails activation when persisted state has no executable registration", async () => {
    const stateStore = new InMemoryLifecycleRuleStateStore();
    const descriptor: LifecycleRuleVersionDescriptor = {
      ruleId: "retention-risk",
      version: "1.0.0",
      fingerprint: "persisted-fingerprint",
      executableRegistrationId: "retention-risk:1.0.0",
      executableFingerprint: "persisted-executable-fingerprint",
      description: "Persisted rule",
      triggers: [{ type: "scheduled.reevaluation" }],
      contextRequirements: [],
      severity: "high",
      actions: [{ id: "create-follow-up", type: "cs.follow_up" }],
    };
    stateStore.saveRegistration({
      descriptor,
      state: "registered",
      registeredAt: NOW,
      updatedAt: NOW,
    });
    const registry = new LifecycleRuleRegistry({ stateStore });

    await expect(
      registry.activate({
        commandId: "activate-unavailable",
        ruleId: "retention-risk",
        version: "1.0.0",
        expectedRevision: 0,
      }),
    ).rejects.toThrow(UnavailableLifecycleRuleVersionProblem);
    expect(await registry.inspect()).toMatchObject([{ version: "1.0.0", state: "unavailable" }]);
  });

  it("reattaches the same active executable version after a process restart", async () => {
    const stateStore = new InMemoryLifecycleRuleStateStore();
    const firstRegistry = new LifecycleRuleRegistry({ stateStore });
    const first = await registerVersion(firstRegistry, "1.0.0", { activate: true });
    const restartedRegistry = new LifecycleRuleRegistry({ stateStore });

    const restarted = await registerVersion(restartedRegistry, "1.0.0", { activate: true });

    expect(restarted.descriptor).toEqual(first.descriptor);
    expect(await restartedRegistry.inspect()).toMatchObject([
      { version: "1.0.0", state: "active", revision: 1 },
    ]);
    expect((await restartedRegistry.getIdentityState("retention-risk"))?.history).toHaveLength(1);
  });

  it("rejects a changed executable artifact reattaching to a persisted active version", async () => {
    const stateStore = new InMemoryLifecycleRuleStateStore();
    const firstRegistry = new LifecycleRuleRegistry({ stateStore });
    await registerVersion(firstRegistry, "1.0.0", { activate: true });
    const restartedRegistry = new LifecycleRuleRegistry({ stateStore });

    await expect(
      restartedRegistry.registerVersion({
        rule: {
          ...createRule("changed-executable"),
          when: () => false,
        },
        version: "1.0.0",
        executableRegistrationId: "retention-risk:1.0.0",
        executableFingerprint: "changed-retention-risk-bundle:1.0.0",
        contextRequirements: ["metadata.atRisk", "onboarding.isCompleted"],
      }),
    ).rejects.toThrow(LifecycleRuleVersionDefinitionProblem);
  });

  it("activates an already registered immutable version when registration is explicitly reused", async () => {
    const registry = new LifecycleRuleRegistry();
    const registration = await registerVersion(registry, "1.0.0");

    const activated = await registry.registerVersion({
      rule: registration.rule,
      version: registration.descriptor.version,
      executableRegistrationId: registration.descriptor.executableRegistrationId,
      executableFingerprint: registration.descriptor.executableFingerprint,
      contextRequirements: registration.descriptor.contextRequirements,
      activate: true,
    });

    expect(activated).toStrictEqual(registration);
    expect(await registry.getIdentityState("retention-risk")).toMatchObject({
      revision: 1,
      versions: [{ state: "active" }],
      history: [{ command: "activate", version: "1.0.0" }],
    });
  });

  it("expires in-memory command replay entries after the configured retention window", async () => {
    let now = new Date("2026-07-26T00:00:00.000Z");
    const stateStore = new InMemoryLifecycleRuleStateStore({
      commandTtlMs: 1_000,
      now: () => now,
    });
    const registry = new LifecycleRuleRegistry({ stateStore });
    await registerVersion(registry, "1.0.0", { activate: true });
    const command = {
      commandId: "reusable-command",
      ruleId: "retention-risk",
      version: "1.0.0",
      expectedRevision: 1,
    } as const;

    await registry.pause(command);
    await expect(registry.pause({ ...command, reason: "different input" })).rejects.toThrow(
      LifecycleRuleCommandConflictProblem,
    );

    now = new Date(now.getTime() + 1_001);
    await registry.resume({
      commandId: "resume-after-command-expiry",
      ruleId: "retention-risk",
      version: "1.0.0",
      expectedRevision: 2,
    });
    await expect(
      registry.pause({
        ...command,
        expectedRevision: 3,
        reason: "different input",
      }),
    ).resolves.toMatchObject({
      replayed: false,
      state: { revision: 4 },
    });
  });

  it("rejects duplicate execution lease identifiers instead of sharing ownership", async () => {
    const stateStore = new InMemoryLifecycleRuleStateStore();
    const registry = new LifecycleRuleRegistry({ stateStore });
    await registerVersion(registry, "1.0.0", { activate: true });
    const claim = {
      claimId: "duplicate-lease",
      ruleId: "retention-risk",
      version: "1.0.0",
      expiresAt: new Date(Date.now() + 30_000),
    };

    expect(stateStore.claimExecution(claim)).toEqual({ claimed: true });
    expect(stateStore.claimExecution(claim)).toEqual({ claimed: false, state: undefined });

    stateStore.releaseExecution(claim.claimId);
  });

  it("automatically resumes a blocked transition when an abandoned execution lease expires", async () => {
    const stateStore = new InMemoryLifecycleRuleStateStore();
    const registry = new LifecycleRuleRegistry({ stateStore });
    await registerVersion(registry, "1.0.0", { activate: true });
    expect(
      stateStore.claimExecution({
        claimId: "abandoned-lease",
        ruleId: "retention-risk",
        version: "1.0.0",
        expiresAt: new Date(Date.now() + 10),
      }),
    ).toEqual({ claimed: true });

    await expect(
      registry.pause({
        commandId: "pause-after-lease-expiry",
        ruleId: "retention-risk",
        version: "1.0.0",
        expectedRevision: 1,
      }),
    ).resolves.toMatchObject({ state: { revision: 2 } });
    expect(await registry.getRegistrationState("retention-risk", "1.0.0")).toBe("paused");
  });

  it("uses the configured logical scheduler when an execution lease expires", async () => {
    let now = new Date("2026-07-26T00:00:00.000Z");
    const stateStore = new InMemoryLifecycleRuleStateStore({
      now: () => now,
      scheduleExecutionClaimWake: (wake, delayMs) => {
        const timer = setTimeout(() => {
          now = new Date(now.getTime() + delayMs);
          wake();
        }, 0);
        return () => clearTimeout(timer);
      },
    });
    const registry = new LifecycleRuleRegistry({ stateStore });
    await registerVersion(registry, "1.0.0", { activate: true });
    expect(
      stateStore.claimExecution({
        claimId: "logical-clock-lease",
        ruleId: "retention-risk",
        version: "1.0.0",
        expiresAt: new Date(now.getTime() + 1_000),
      }),
    ).toEqual({ claimed: true });

    await expect(
      registry.pause({
        commandId: "pause-after-logical-lease-expiry",
        ruleId: "retention-risk",
        version: "1.0.0",
        expectedRevision: 1,
      }),
    ).resolves.toMatchObject({ state: { revision: 2 } });
    expect(now).toEqual(new Date("2026-07-26T00:00:01.000Z"));
  });
});

describe("LifecycleRuleEvaluator versioned execution", () => {
  it("records the immutable rule version and fingerprint on production runs and emissions", async () => {
    const registry = new LifecycleRuleRegistry();
    const registration = await registerVersion(registry, "1.0.0", { activate: true });
    const runStore = new InMemoryLifecycleRunStore();
    const sink = new InMemoryLifecycleActionSink();
    const evaluator = new LifecycleRuleEvaluator({ registry, runStore, actionAdapter: sink });

    const result = await evaluator.evaluate(createContext());

    expect(result.runs).toMatchObject([
      {
        ruleId: "retention-risk",
        ruleVersion: "1.0.0",
        ruleFingerprint: registration.descriptor.fingerprint,
        status: "succeeded",
      },
    ]);
    expect(sink.getEmissions()).toMatchObject([
      {
        ruleId: "retention-risk",
        ruleVersion: "1.0.0",
        ruleFingerprint: registration.descriptor.fingerprint,
      },
    ]);
  });

  it("records paused signal evidence without dispatching and resume does not replay it", async () => {
    const registry = new LifecycleRuleRegistry();
    await registerVersion(registry, "1.0.0", { activate: true });
    await registry.pause({
      commandId: "pause-v1",
      ruleId: "retention-risk",
      version: "1.0.0",
      expectedRevision: 1,
    });
    const runStore = new InMemoryLifecycleRunStore();
    const sink = new InMemoryLifecycleActionSink();
    const evaluator = new LifecycleRuleEvaluator({ registry, runStore, actionAdapter: sink });

    const paused = await evaluator.evaluate(createContext());
    await registry.resume({
      commandId: "resume-v1",
      ruleId: "retention-risk",
      version: "1.0.0",
      expectedRevision: 2,
    });

    expect(paused.runs).toMatchObject([
      {
        ruleVersion: "1.0.0",
        status: "skipped",
        skipReason: "rule_paused",
      },
    ]);
    expect(await runStore.list()).toHaveLength(1);
    expect(sink.getEmissions()).toHaveLength(0);
  });

  it("rechecks activation state after awaited evaluation work before dispatching", async () => {
    let markLookupStarted: (() => void) | undefined;
    let releaseLookup: (() => void) | undefined;
    const lookupStarted = new Promise<void>((resolve) => {
      markLookupStarted = resolve;
    });
    const lookupGate = new Promise<void>((resolve) => {
      releaseLookup = resolve;
    });
    class BlockingRunStore extends InMemoryLifecycleRunStore {
      override async claim(claim: LifecycleRunClaim) {
        markLookupStarted?.();
        await lookupGate;
        return super.claim(claim);
      }
    }

    const registry = new LifecycleRuleRegistry();
    await registerVersion(registry, "1.0.0", { activate: true });
    const sink = new InMemoryLifecycleActionSink();
    const evaluator = new LifecycleRuleEvaluator({
      registry,
      runStore: new BlockingRunStore(),
      actionAdapter: sink,
    });

    const evaluation = evaluator.evaluate(createContext());
    await lookupStarted;
    await registry.pause({
      commandId: "pause-during-evaluation",
      ruleId: "retention-risk",
      version: "1.0.0",
      expectedRevision: 1,
    });
    releaseLookup?.();
    const result = await evaluation;

    expect(result.runs).toMatchObject([
      {
        status: "skipped",
        skipReason: "rule_paused",
      },
    ]);
    expect(sink.getEmissions()).toHaveLength(0);
  });

  it("does not let pause complete between the active check and action dispatch", async () => {
    let markClaimed: (() => void) | undefined;
    let releaseClaim: (() => void) | undefined;
    const claimed = new Promise<void>((resolve) => {
      markClaimed = resolve;
    });
    const claimGate = new Promise<void>((resolve) => {
      releaseClaim = resolve;
    });
    const delegate = new InMemoryLifecycleRuleStateStore();
    const stateStore: LifecycleRuleStateStore = {
      get: (ruleId) => delegate.get(ruleId),
      saveRegistration: (record) => delegate.saveRegistration(record),
      applyCommand: (input) => delegate.applyCommand(input),
      list: () => delegate.list(),
      releaseExecution: (claimId) => delegate.releaseExecution(claimId),
      claimExecution: async (claim) => {
        const result = delegate.claimExecution(claim);
        markClaimed?.();
        await claimGate;
        return result;
      },
    };
    const registry = new LifecycleRuleRegistry({ stateStore });
    await registerVersion(registry, "1.0.0", { activate: true });
    const sink = new InMemoryLifecycleActionSink();
    const evaluator = new LifecycleRuleEvaluator({
      registry,
      runStore: new InMemoryLifecycleRunStore(),
      actionAdapter: sink,
    });

    const evaluation = evaluator.evaluate(createContext());
    await claimed;
    let pauseCompleted = false;
    const pause = registry
      .pause({
        commandId: "pause-at-dispatch-boundary",
        ruleId: "retention-risk",
        version: "1.0.0",
        expectedRevision: 1,
      })
      .then(() => {
        pauseCompleted = true;
      });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(pauseCompleted).toBe(false);
    releaseClaim?.();
    await evaluation;
    await pause;

    expect(sink.getEmissions()).toHaveLength(1);
    expect(pauseCompleted).toBe(true);
    expect(await registry.getRegistrationState("retention-risk", "1.0.0")).toBe("paused");
  });

  it("aborts a production claim when execution lease acquisition fails", async () => {
    const delegate = new InMemoryLifecycleRuleStateStore();
    let failClaim = true;
    const stateStore: LifecycleRuleStateStore = {
      get: (ruleId) => delegate.get(ruleId),
      saveRegistration: (record) => delegate.saveRegistration(record),
      applyCommand: (input) => delegate.applyCommand(input),
      list: () => delegate.list(),
      releaseExecution: (claimId) => delegate.releaseExecution(claimId),
      claimExecution: (claim) => {
        if (failClaim) {
          failClaim = false;
          throw new Error("temporary state store outage");
        }
        return delegate.claimExecution(claim);
      },
    };
    const registry = new LifecycleRuleRegistry({ stateStore });
    await registerVersion(registry, "1.0.0", { activate: true });
    const runStore = new InMemoryLifecycleRunStore();
    const sink = new InMemoryLifecycleActionSink();
    const evaluator = new LifecycleRuleEvaluator({ registry, runStore, actionAdapter: sink });

    await expect(evaluator.evaluate(createContext("retryable-signal"))).rejects.toThrow(
      "temporary state store outage",
    );
    const retried = await evaluator.evaluate(createContext("retryable-signal"));

    expect(retried.runs).toMatchObject([{ status: "succeeded" }]);
    expect(sink.getEmissions()).toHaveLength(1);
  });

  it("allows an action adapter to pause its rule without waiting on its own dispatch lease", async () => {
    const registry = new LifecycleRuleRegistry();
    await registerVersion(registry, "1.0.0", { activate: true });
    const evaluator = new LifecycleRuleEvaluator({
      registry,
      runStore: new InMemoryLifecycleRunStore(),
      actionAdapter: {
        execute: async (action) => {
          await registry.pause({
            commandId: "pause-from-action-adapter",
            ruleId: "retention-risk",
            version: "1.0.0",
            expectedRevision: 1,
          });
          return {
            actionId: action.id,
            type: action.type,
            status: "success",
          };
        },
      },
    });

    const result = await evaluator.evaluate(createContext("reentrant-pause"));

    expect(result.runs).toMatchObject([{ status: "succeeded" }]);
    expect(await registry.getRegistrationState("retention-risk", "1.0.0")).toBe("paused");
  });

  it("claims production idempotency and cooldown atomically before dispatch", async () => {
    const registry = new LifecycleRuleRegistry();
    await registerVersion(registry, "1.0.0", { activate: true });
    const runStore = new InMemoryLifecycleRunStore();
    const sink = new InMemoryLifecycleActionSink();
    const evaluator = new LifecycleRuleEvaluator({ registry, runStore, actionAdapter: sink });

    const identical = await Promise.all([
      evaluator.evaluate(createContext("same-signal")),
      evaluator.evaluate(createContext("same-signal")),
    ]);

    expect(
      identical
        .flatMap((result) => result.runs)
        .map((run) => run.status)
        .sort(),
    ).toEqual(["skipped", "succeeded"]);
    expect(identical.flatMap((result) => result.runs)).toEqual(
      expect.arrayContaining([expect.objectContaining({ skipReason: "idempotency_key_reused" })]),
    );
    expect(sink.getEmissions()).toHaveLength(1);

    const cooldownRegistry = new LifecycleRuleRegistry();
    await registerVersion(cooldownRegistry, "1.0.0", { activate: true });
    const cooldownSink = new InMemoryLifecycleActionSink();
    const cooldownEvaluator = new LifecycleRuleEvaluator({
      registry: cooldownRegistry,
      runStore: new InMemoryLifecycleRunStore(),
      actionAdapter: cooldownSink,
    });
    const differentSignals = await Promise.all([
      cooldownEvaluator.evaluate(createContext("cooldown-a")),
      cooldownEvaluator.evaluate(createContext("cooldown-b")),
    ]);

    expect(
      differentSignals
        .flatMap((result) => result.runs)
        .map((run) => run.status)
        .sort(),
    ).toEqual(["skipped", "succeeded"]);
    expect(differentSignals.flatMap((result) => result.runs)).toEqual(
      expect.arrayContaining([expect.objectContaining({ skipReason: "cooldown_active" })]),
    );
    expect(cooldownSink.getEmissions()).toHaveLength(1);
  });

  it("keeps registered static action payloads immutable after caller mutation", async () => {
    const registry = new LifecycleRuleRegistry();
    const rule = createRule("immutable");
    await registry.registerVersion({
      rule,
      version: "1.0.0",
      executableRegistrationId: "retention-risk:1.0.0",
      executableFingerprint: "retention-risk-bundle:1.0.0",
      contextRequirements: ["metadata.atRisk", "onboarding.isCompleted"],
      activate: true,
    });
    if (!Array.isArray(rule.actions)) {
      return;
    }
    const payload = rule.actions[0]?.payload as { secret: string };
    payload.secret = "mutated-after-registration";
    const returned = registry.getRegistration("retention-risk", "1.0.0");
    if (returned && Array.isArray(returned.rule.actions)) {
      (returned.rule.actions[0]?.payload as { secret: string }).secret = "mutated-through-read";
    }
    const identity = await registry.getIdentityState("retention-risk");
    const stateAction = (
      identity?.versions[0]?.descriptor.actions as unknown as { id: string }[] | undefined
    )?.[0];
    if (stateAction) {
      stateAction.id = "mutated-state-read";
    }
    const sink = new InMemoryLifecycleActionSink();
    const evaluator = new LifecycleRuleEvaluator({
      registry,
      runStore: new InMemoryLifecycleRunStore(),
      actionAdapter: sink,
    });

    await evaluator.evaluate(createContext());

    expect(sink.getEmissions()[0]?.action.payload).toEqual({ secret: "must-not-leak" });
    expect((await registry.inspect())[0]?.actions[0]?.id).toBe("create-follow-up");
  });

  it("preserves structured payload values and custom prototypes across registry reads", async () => {
    class CustomPayload {
      constructor(readonly value: string) {}
    }

    const map = new Map([["tier", "gold"]]);
    const set = new Set(["retention"]);
    const pattern = /at-risk/gi;
    pattern.lastIndex = 2;
    const custom = new CustomPayload("original");
    const baseRule = createRule("structured-payload");
    if (!Array.isArray(baseRule.actions) || !baseRule.actions[0]) {
      return;
    }
    const registry = new LifecycleRuleRegistry();
    await registry.registerVersion({
      rule: {
        ...baseRule,
        actions: [
          {
            ...baseRule.actions[0],
            payload: { map, set, pattern, custom },
          },
        ],
      },
      version: "1.0.0",
      executableRegistrationId: "retention-risk:1.0.0",
      executableFingerprint: "retention-risk-bundle:1.0.0",
      contextRequirements: ["metadata.atRisk", "onboarding.isCompleted"],
      activate: true,
    });
    map.set("tier", "mutated");
    set.add("mutated");
    pattern.lastIndex = 0;

    const first = registry.getRegistration("retention-risk", "1.0.0");
    const payload = Array.isArray(first?.rule.actions) ? first.rule.actions[0]?.payload : undefined;
    expect(payload?.map).toEqual(new Map([["tier", "gold"]]));
    expect(payload?.set).toEqual(new Set(["retention"]));
    expect(payload?.pattern).toEqual(/at-risk/gi);
    expect((payload?.pattern as RegExp).lastIndex).toBe(2);
    expect(payload?.custom).toBeInstanceOf(CustomPayload);

    (payload?.map as Map<string, string>).set("tier", "read-mutation");
    const second = registry.getRegistration("retention-risk", "1.0.0");
    const secondPayload = Array.isArray(second?.rule.actions)
      ? second.rule.actions[0]?.payload
      : undefined;
    expect(secondPayload?.map).toEqual(new Map([["tier", "gold"]]));
  });

  it("dry-runs without dispatching, saving a production run, or consuming cooldown", async () => {
    const registry = new LifecycleRuleRegistry();
    await registerVersion(registry, "1.0.0", { activate: true });
    const runStore = new InMemoryLifecycleRunStore();
    const dryRunStore = new InMemoryLifecycleDryRunStore();
    const sink = new InMemoryLifecycleActionSink();
    const evaluator = new LifecycleRuleEvaluator({
      registry,
      runStore,
      dryRunStore,
      actionAdapter: sink,
    });

    const first = await evaluator.dryRun({
      ruleId: "retention-risk",
      context: createContext(),
    });
    const second = await evaluator.dryRun({
      ruleId: "retention-risk",
      context: createContext("signal-2", new Date(NOW.getTime() + 1_000)),
    });

    expect(first).toMatchObject({
      ruleVersion: "1.0.0",
      state: "active",
      matched: true,
      conditionEvidence: {
        atRisk: true,
        onboardingIncomplete: true,
      },
      proposedActions: [{ id: "create-follow-up", type: "cs.follow_up" }],
      suppression: { suppressed: false },
      problems: [],
    });
    expect(JSON.stringify(first)).not.toContain("must-not-leak");
    expect(JSON.stringify(first)).not.toContain("sensitive-context-value");
    expect(JSON.stringify(first)).not.toContain("sensitive-signal-value");
    expect(second.suppression).toEqual({ suppressed: false });
    expect(await runStore.list()).toHaveLength(0);
    expect(sink.getEmissions()).toHaveLength(0);
    expect(dryRunStore.list()).toHaveLength(2);

    const production = await evaluator.evaluate(
      createContext("signal-3", new Date(NOW.getTime() + 2_000)),
    );
    const cooldownPreview = await evaluator.dryRun({
      ruleId: "retention-risk",
      context: createContext("signal-4", new Date(NOW.getTime() + 3_000)),
    });
    expect(production.runs[0]).toMatchObject({ status: "succeeded" });
    expect(cooldownPreview.suppression).toEqual({
      suppressed: true,
      reason: "cooldown_active",
    });
    expect(sink.getEmissions()).toHaveLength(1);
  });

  it("stores a redacted dry-run problem when idempotency-key resolution fails", async () => {
    const registry = new LifecycleRuleRegistry();
    await registry.registerVersion({
      rule: {
        ...createRule(),
        idempotencyKey: () => {
          throw new Error("sensitive-idempotency-key-input");
        },
      },
      version: "1.0.0",
      executableRegistrationId: "retention-risk:1.0.0",
      executableFingerprint: "retention-risk-bundle:1.0.0",
      contextRequirements: ["metadata.atRisk", "onboarding.isCompleted"],
      activate: true,
    });
    const dryRunStore = new InMemoryLifecycleDryRunStore();
    const sink = new InMemoryLifecycleActionSink();
    const evaluator = new LifecycleRuleEvaluator({
      registry,
      runStore: new InMemoryLifecycleRunStore(),
      dryRunStore,
      actionAdapter: sink,
    });

    const result = await evaluator.dryRun({
      ruleId: "retention-risk",
      context: createContext(),
    });

    expect(result).toMatchObject({
      matched: true,
      suppression: { suppressed: true },
      problems: [{ code: "lifecycle-core/dry-run-idempotency-key-failed" }],
    });
    expect(JSON.stringify(result)).not.toContain("sensitive-idempotency-key-input");
    expect(await dryRunStore.list()).toEqual([result]);
    expect(sink.getEmissions()).toHaveLength(0);
  });

  it("keeps the simple registration compatibility path for dynamic action mappings", async () => {
    const registry = new LifecycleRuleRegistry();
    registry.register({
      ...createRule("legacy"),
      actions: (context) => [
        {
          id: "legacy-action",
          type: "cs.follow_up",
          payload: { tenantId: context.tenantId },
        },
      ],
    });
    const sink = new InMemoryLifecycleActionSink();
    const evaluator = new LifecycleRuleEvaluator({
      registry,
      runStore: new InMemoryLifecycleRunStore(),
      actionAdapter: sink,
    });

    const result = await evaluator.evaluate(createContext());

    expect(result.runs[0]).toMatchObject({
      ruleId: "retention-risk",
      ruleVersion: expect.stringMatching(/^legacy-/),
      status: "succeeded",
    });
    expect(sink.getEmissions()).toHaveLength(1);
  });

  it("records an explicit failed run when dynamic code produces an undeclared action", async () => {
    const registry = new LifecycleRuleRegistry();
    await registry.registerVersion({
      rule: {
        ...createRule("dynamic"),
        actions: () => [{ id: "undeclared-action", type: "billing.refund" }],
      },
      version: "1.0.0",
      executableRegistrationId: "retention-risk:dynamic-v1",
      executableFingerprint: "retention-risk-dynamic-bundle:1.0.0",
      actionDescriptors: [{ id: "create-follow-up", type: "cs.follow_up" }],
      activate: true,
    });
    const runStore = new InMemoryLifecycleRunStore();
    const sink = new InMemoryLifecycleActionSink();
    const evaluator = new LifecycleRuleEvaluator({ registry, runStore, actionAdapter: sink });

    const dryRun = await evaluator.dryRun({
      ruleId: "retention-risk",
      context: createContext(),
    });
    const production = await evaluator.evaluate(createContext());

    expect(dryRun).toMatchObject({
      proposedActions: [],
      problems: [{ code: "lifecycle-core/rule-action-contract-mismatch" }],
    });
    expect(production.runs).toMatchObject([
      {
        ruleVersion: "1.0.0",
        status: "failed",
        error: { code: "lifecycle-core/rule-action-contract-mismatch" },
      },
    ]);
    expect(sink.getEmissions()).toHaveLength(0);
    expect(await runStore.list()).toHaveLength(1);
  });

  it("reports operational version state, recent dry runs, and run fingerprint mismatches", async () => {
    const registry = new LifecycleRuleRegistry();
    await registerVersion(registry, "1.0.0", { activate: true });
    await registry.pause({
      commandId: "pause-v1",
      ruleId: "retention-risk",
      version: "1.0.0",
      expectedRevision: 1,
    });
    const runStore = new InMemoryLifecycleRunStore();
    const dryRunStore = new InMemoryLifecycleDryRunStore();
    const evaluator = new LifecycleRuleEvaluator({
      registry,
      runStore,
      dryRunStore,
      actionAdapter: new InMemoryLifecycleActionSink(),
    });
    await evaluator.dryRun({ ruleId: "retention-risk", context: createContext() });
    const mismatchedRun: LifecycleRun = {
      id: "mismatched-run",
      ruleId: "retention-risk",
      ruleVersion: "1.0.0",
      ruleFingerprint: "unexpected-fingerprint",
      tenantId: "tenant-1",
      signalType: "scheduled.reevaluation",
      signalId: "signal-1",
      severity: "high",
      status: "skipped",
      idempotencyKey: "mismatched-run",
      skipReason: "rule_paused",
      actionResults: [],
      startedAt: NOW,
      completedAt: NOW,
    };
    await runStore.save(mismatchedRun);

    const health = await new LifecycleDiagnosticsProvider(runStore, {
      registry,
      dryRunStore,
    }).getHealth();

    expect(health).toMatchObject({
      status: "degraded",
      details: {
        activeVersions: [],
        pausedRules: [{ version: "1.0.0", state: "paused" }],
        unavailableRegistrations: [],
        versionMismatchCount: 1,
        recentDryRuns: [
          {
            ruleVersion: "1.0.0",
            state: "paused",
            matched: true,
            suppressed: true,
          },
        ],
      },
    });
  });
});
