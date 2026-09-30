import { describe, expect, it, vi } from "vitest";
import { InMemoryJourneyStore, JourneyEngine, JourneyProblem, JourneyTaskBridge } from "../index";
import type { JourneyDefinition } from "../index";
const scope = { appId: "shop", environment: "test", tenantId: "tenant" };
const entry = {
  id: "one",
  scope,
  subject: "buyer",
  businessObjectRef: "cart",
  episodeKey: "session",
  sourceEventId: "event-1",
};
const definition: JourneyDefinition = {
  id: "purchase",
  version: "1",
  entry: "wait",
  goal: { registration: "bought", params: {} },
  reentry: "once",
  unknownRetryMs: 10,
  unknownDeadlineMs: 30,
  nodes: [
    { id: "wait", kind: "wait", durationMs: 3600000, next: "send" },
    { id: "send", kind: "action", action: { registration: "message", params: {} }, next: "end" },
    { id: "end", kind: "end" },
  ],
};
function setup(store = new InMemoryJourneyStore(), registeredDefinition = definition) {
  let now = 0;
  let goal: boolean | "unknown" = false;
  let consent: boolean | "unknown" = true;
  let condition: boolean | "unknown" = false;
  const dispatch = vi.fn(async () => "accepted" as const);
  const engine = new JourneyEngine({
    store,
    now: () => new Date(now),
    predicates: {
      bought: { validate: () => {}, evaluate: async () => goal },
      eligible: { validate: () => {}, evaluate: async () => condition },
    },
    actions: { message: { validate: () => {}, capability: "message", dispatch } },
    capabilities: ["message"],
    checkLatest: async () => ({ consent, resource: true }),
  });
  engine.register(registeredDefinition);
  return {
    store,
    engine,
    dispatch,
    time: (value: number) => {
      now = value;
    },
    goal: (value: boolean | "unknown") => {
      goal = value;
    },
    condition: (value: boolean | "unknown") => {
      condition = value;
    },
    consent: (value: boolean | "unknown") => {
      consent = value;
    },
  };
}
describe("JourneyEngine", () => {
  it("checks latest goal before and after a delayed wake", async () => {
    const f = setup();
    await f.engine.enter("purchase", "1", entry);
    await f.engine.tick(scope, entry.id);
    f.time(100);
    f.goal(true);
    expect((await f.engine.tick(scope, entry.id)).reason).toBe("goal-achieved");
    f.time(7200000);
    await f.engine.tick(scope, entry.id);
    expect(f.dispatch).not.toHaveBeenCalled();
  });
  it("deduplicates entry and concurrent wakes and pins definition version", async () => {
    const f = setup();
    const entered = await Promise.all([
      f.engine.enter("purchase", "1", entry),
      f.engine.enter("purchase", "1", { ...entry, id: "duplicate" }),
    ]);
    expect(entered.map((item) => item.id)).toEqual(["one", "one"]);
    f.engine.register({ ...definition, version: "2" });
    await f.engine.tick(scope, entry.id);
    f.time(3600000);
    await f.engine.tick(scope, entry.id);
    await Promise.allSettled([f.engine.tick(scope, entry.id), f.engine.tick(scope, entry.id)]);
    expect(f.dispatch).toHaveBeenCalledTimes(1);
    expect((await f.store.get(scope, entry.id))?.definitionVersion).toBe("1");
    expect((await f.engine.tick(scope, entry.id)).status).toBe("completed");
  });
  it("defers unknown until the deadline without dispatch", async () => {
    const f = setup();
    f.goal("unknown");
    await f.engine.enter("purchase", "1", entry);
    expect((await f.engine.tick(scope, entry.id)).status).toBe("waiting");
    f.time(30);
    expect((await f.engine.tick(scope, entry.id)).reason).toBe("blocked-unknown-deadline");
    expect(f.dispatch).not.toHaveBeenCalled();
  });
  it("does not mutate store or dispatch during dry-run and isolates scope", async () => {
    const f = setup();
    await f.engine.dryRun("purchase", "1", entry);
    expect(await f.store.list(scope)).toEqual([]);
    expect(f.dispatch).not.toHaveBeenCalled();
    await f.engine.enter("purchase", "1", entry);
    expect(await f.store.list({ ...scope, tenantId: "other" })).toEqual([]);
    await expect(f.engine.tick({ ...scope, tenantId: "" }, entry.id)).rejects.toBeInstanceOf(
      JourneyProblem,
    );
  });
  it("dry-runs only the selected condition path and reports unknown deadlines without mutation", async () => {
    const f = setup();
    f.engine.register({
      ...definition,
      version: "branch",
      entry: "condition",
      nodes: [
        {
          id: "condition",
          kind: "condition",
          predicate: { registration: "eligible", params: {} },
          matched: "send",
          unmatched: "end",
        },
        ...definition.nodes.slice(1),
      ],
    });
    const unmatched = await f.engine.dryRun("purchase", "branch", entry);
    expect(unmatched.steps.map((step) => step.outcome)).toEqual(["no-match", "completed"]);
    f.condition(true);
    const matched = await f.engine.dryRun("purchase", "branch", entry);
    expect(matched.steps.map((step) => step.outcome)).toEqual(["matched", "proposed", "completed"]);
    f.condition("unknown");
    const unknown = await f.engine.dryRun("purchase", "branch", entry);
    expect(unknown.steps).toHaveLength(1);
    expect(unknown.steps[0].conditionResult).toBe("unknown");
    expect(unknown.steps[0]).toMatchObject({
      outcome: "deferred",
      wakeAt: new Date(10).toISOString(),
      deadlineAt: new Date(30).toISOString(),
      deadlineReason: "blocked-unknown-deadline",
    });
    expect(await f.store.list(scope)).toEqual([]);
    expect(f.dispatch).not.toHaveBeenCalled();
  });
  it("dry-run projects waits and suppresses actions for denied consent", async () => {
    const f = setup();
    f.consent(false);
    const result = await f.engine.dryRun("purchase", "1", entry);
    expect(result.steps.map((step) => step.outcome)).toEqual(["wait", "suppressed"]);
    expect(result.steps[1]).toMatchObject({
      reason: "consent-denied",
      projectedAt: new Date(3600000).toISOString(),
      checks: { consent: false, resource: true, goal: false },
    });
    expect(await f.store.list(scope)).toEqual([]);
    expect(f.dispatch).not.toHaveBeenCalled();
  });
  it.each([
    new Error("secret customer address"),
    new JourneyProblem("secret-provider-code", "secret payload"),
  ])("retains safe provider failure and source-check evidence", async (error) => {
    const f = setup();
    f.dispatch.mockRejectedValueOnce(error);
    await f.engine.enter("purchase", "1", entry);
    await f.engine.tick(scope, entry.id);
    f.time(3600000);
    await f.engine.tick(scope, entry.id);
    const result = await f.engine.tick(scope, entry.id);
    expect(result.intents[0]).toMatchObject({
      status: "indeterminate",
      problemCode:
        error instanceof JourneyProblem
          ? "lifecycle-core/journey-provider-problem"
          : "lifecycle-core/journey-provider-exception",
      checks: {
        goal: false,
        consent: true,
        resource: true,
        evaluatedAt: new Date(3600000).toISOString(),
      },
    });
    expect(result.receipts.at(-1)?.executionReference).toBe(result.intents[0].executionReference);
    expect(result.receipts.at(-1)?.problemCode).toBe(result.intents[0].problemCode);
    expect(JSON.stringify(result)).not.toContain("secret");
  });
  it("pauses dispatch and resumes with a fresh wait instead of catching up", async () => {
    const f = setup();
    await f.engine.enter("purchase", "1", entry);
    const waiting = await f.engine.tick(scope, entry.id);
    const paused = await f.engine.command(scope, entry.id, {
      type: "pause",
      expectedRevision: waiting.revision,
      actor: "admin",
      reason: "review",
      idempotencyKey: "pause",
    });
    f.time(7200000);
    await f.engine.tick(scope, entry.id);
    expect(f.dispatch).not.toHaveBeenCalled();
    const resumed = await f.engine.command(scope, entry.id, {
      type: "resume",
      expectedRevision: paused.revision,
      actor: "admin",
      reason: "approved",
      idempotencyKey: "resume",
    });
    expect(resumed.wakeAt).toBe(new Date(10800000).toISOString());
    expect(resumed.receipts.slice(0, paused.receipts.length)).toEqual(paused.receipts);
    expect(resumed.receipts.filter((receipt) => receipt.reason === "wait-started")).toHaveLength(2);
    f.time(7200001);
    expect((await f.engine.tick(scope, entry.id)).nodeId).toBe("wait");
    f.time(10800000);
    expect((await f.engine.tick(scope, entry.id)).nodeId).toBe("send");
  });
  it("never replays unknown external acceptance, including after engine restart", async () => {
    const f = setup();
    f.dispatch.mockRejectedValueOnce(new Error("connection lost"));
    await f.engine.enter("purchase", "1", entry);
    await f.engine.tick(scope, entry.id);
    f.time(3600000);
    await f.engine.tick(scope, entry.id);
    expect((await f.engine.tick(scope, entry.id)).status).toBe("indeterminate");
    await f.engine.tick(scope, entry.id);
    expect(f.dispatch).toHaveBeenCalledTimes(1);
  });
  it("rejects definition drift on restart and retains the admitted action across stop", async () => {
    const f = setup();
    await f.engine.enter("purchase", "1", entry);
    const restarted = setup(f.store, { ...definition, unknownRetryMs: 11 });
    await expect(restarted.engine.tick(scope, entry.id)).rejects.toBeInstanceOf(JourneyProblem);
    await f.engine.tick(scope, entry.id);
    f.time(3600000);
    await f.engine.tick(scope, entry.id);
    let release!: () => void;
    let admitted!: () => void;
    const started = new Promise<void>((resolve) => {
      admitted = resolve;
    });
    f.dispatch.mockImplementationOnce(async () => {
      admitted();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return "accepted";
    });
    const ticking = f.engine.tick(scope, entry.id);
    await started;
    const current = await f.store.get(scope, entry.id);
    if (!current) throw new Error("Expected admitted episode");
    await expect(
      f.engine.command(scope, entry.id, {
        type: "pause",
        expectedRevision: current.revision,
        actor: "admin",
        reason: "pause",
        idempotencyKey: "pause",
      }),
    ).rejects.toBeInstanceOf(JourneyProblem);
    await f.engine.command(scope, entry.id, {
      type: "stop",
      expectedRevision: current.revision,
      actor: "admin",
      reason: "stop",
      idempotencyKey: "stop",
    });
    release();
    const stopped = await ticking;
    expect(stopped.status).toBe("exited");
    expect(stopped.intents[0].status).toBe("accepted");
    expect(f.dispatch).toHaveBeenCalledTimes(1);
  });
  it("reconciles provider proof once without replaying an uncertain action", async () => {
    const f = setup();
    f.dispatch.mockRejectedValueOnce(new Error("lost acceptance"));
    await f.engine.enter("purchase", "1", entry);
    await f.engine.tick(scope, entry.id);
    f.time(3600000);
    await f.engine.tick(scope, entry.id);
    const uncertain = await f.engine.tick(scope, entry.id);
    const proof = {
      actor: "operator",
      reason: "provider receipt checked",
      proofReference: "provider:receipt-1",
      idempotencyKey: "reconcile-1",
      expectedRevision: uncertain.revision,
      attemptIdentity: uncertain.intents[0].attemptIdentity,
      outcome: "accepted" as const,
    };
    const reconciled = await f.engine.reconcile(scope, entry.id, proof);
    expect(reconciled.nodeId).toBe("end");
    expect(await f.engine.reconcile(scope, entry.id, proof)).toEqual(reconciled);
    expect((await f.engine.tick(scope, entry.id)).status).toBe("completed");
    expect(f.dispatch).toHaveBeenCalledTimes(1);
  });
  it("rejects pause once dispatch admission wins and checks consent before admission", async () => {
    const f = setup();
    await f.engine.enter("purchase", "1", entry);
    await f.engine.tick(scope, entry.id);
    f.time(3600000);
    await f.engine.tick(scope, entry.id);
    f.consent(false);
    expect((await f.engine.tick(scope, entry.id)).reason).toBe("consent-denied");
    expect(f.dispatch).not.toHaveBeenCalled();
  });
  it("rejects cycles, oversized graphs, missing registrations and immutable version rewrites", () => {
    const f = setup();
    expect(() => f.engine.register(definition)).toThrow(JourneyProblem);
    expect(() =>
      f.engine.register({
        ...definition,
        version: "cycle",
        nodes: [{ id: "wait", kind: "wait", durationMs: 1, next: "wait" }],
      }),
    ).toThrow(JourneyProblem);
    expect(() =>
      f.engine.register({
        ...definition,
        version: "large",
        nodes: Array.from({ length: 9 }, (_, id) => ({ id: String(id), kind: "end" as const })),
      }),
    ).toThrow(JourneyProblem);
    expect(() =>
      f.engine.register({
        ...definition,
        version: "missing",
        goal: { registration: "nope", params: {} },
      }),
    ).toThrow(JourneyProblem);
  });
  it("fences a pause racing with the final source check", async () => {
    const store = new InMemoryJourneyStore();
    let release!: () => void;
    let checked!: () => void;
    const started = new Promise<void>((resolve) => {
      checked = resolve;
    });
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const dispatch = vi.fn(async () => "accepted" as const);
    const engine = new JourneyEngine({
      store,
      predicates: { bought: { validate: () => {}, evaluate: async () => false } },
      actions: { message: { validate: () => {}, capability: "message", dispatch } },
      capabilities: ["message"],
      checkLatest: async () => {
        checked();
        await barrier;
        return { consent: true, resource: true };
      },
    });
    engine.register({ ...definition, entry: "send", nodes: definition.nodes.slice(1) });
    await engine.enter("purchase", "1", entry);
    const ticking = engine.tick(scope, entry.id);
    await started;
    await engine.command(scope, entry.id, {
      type: "pause",
      expectedRevision: 0,
      actor: "admin",
      reason: "hold",
      idempotencyKey: "hold",
    });
    release();
    await expect(ticking).rejects.toBeInstanceOf(JourneyProblem);
    expect(dispatch).not.toHaveBeenCalled();
  });
  it("leases concurrent due claims and allows recovery after expiration", async () => {
    const f = setup();
    await f.engine.enter("purchase", "1", entry);
    const claims = await Promise.all([
      f.store.claimDue(scope, new Date(0).toISOString(), 10, 50),
      f.store.claimDue(scope, new Date(0).toISOString(), 10, 50),
    ]);
    expect(claims.flat()).toHaveLength(1);
    expect(await f.store.claimDue(scope, new Date(50).toISOString(), 10, 50)).toHaveLength(1);
  });
  it("dispatches every claimed episode before reporting an invocation failure", async () => {
    const f = setup();
    await f.engine.enter("purchase", "1", entry);
    await f.engine.enter("purchase", "1", { ...entry, id: "two", subject: "other" });
    const failure = new JourneyProblem("dispatch", "Task dispatch unavailable");
    const invoke = vi.fn().mockRejectedValueOnce(failure).mockResolvedValue(undefined);
    const bridge = new JourneyTaskBridge(f.store, f.engine, { invoke });
    await expect(bridge.dispatchDue(scope, new Date(0))).rejects.toBe(failure);
    expect(invoke.mock.calls.map(([input]) => input.episodeId)).toEqual(["one", "two"]);
    expect(await bridge.dispatchDue(scope, new Date(0))).toBe(0);
    expect(await bridge.dispatchDue(scope, new Date(30000))).toBe(2);
  });
  it("drives the complete journey through the task bridge", async () => {
    const f = setup();
    await f.engine.enter("purchase", "1", entry);
    let bridge: JourneyTaskBridge;
    bridge = new JourneyTaskBridge(f.store, f.engine, {
      invoke: async (input) => {
        await bridge.execute(input);
      },
    });
    expect(await bridge.dispatchDue(scope, new Date(0))).toBe(1);
    expect(await bridge.dispatchDue(scope, new Date(0))).toBe(0);
    f.time(3600000);
    for (let index = 0; index < 3; index++)
      expect(await bridge.dispatchDue(scope, new Date(3600000))).toBe(1);
    expect((await f.store.get(scope, entry.id))?.status).toBe("completed");
    expect(f.dispatch).toHaveBeenCalledTimes(1);
    expect(await bridge.dispatchDue(scope, new Date(3600000))).toBe(0);
  });
  it("bridges due wake to a bounded task invocation and ignores obsolete deliveries", async () => {
    const f = setup();
    await f.engine.enter("purchase", "1", entry);
    const invoke = vi.fn(
      async (_input: {
        taskId: string;
        idempotencyKey: string;
        scope: typeof scope;
        episodeId: string;
        revision: number;
      }) => {},
    );
    const bridge = new JourneyTaskBridge(f.store, f.engine, { invoke });
    expect(await bridge.dispatchDue(scope, new Date(0))).toBe(1);
    await bridge.execute(invoke.mock.calls[0][0]);
    await bridge.execute(invoke.mock.calls[0][0]);
    expect((await f.store.get(scope, entry.id))?.revision).toBe(1);
    expect(await bridge.dispatchDue(scope, new Date(0))).toBe(0);
  });
});
