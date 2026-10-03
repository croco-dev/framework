import { describe, expect, it, vi } from "vitest";
import { InMemoryJourneyStore, JourneyEngine } from "../index";
import type { JourneyContext, JourneyDefinition } from "../index";
const scope = { appId: "shop", environment: "test", tenantId: "tenant" };
const entry = {
  id: "sample",
  scope,
  subject: "buyer",
  businessObjectRef: "cart",
  episodeKey: "session",
  sourceEventId: "event",
};
const definition: JourneyDefinition = {
  id: "journey",
  version: "1",
  entry: "wait",
  goal: { registration: "goal", params: {} },
  reentry: "once",
  unknownRetryMs: 10,
  unknownDeadlineMs: 30,
  nodes: [
    { id: "wait", kind: "wait", durationMs: 100, next: "condition" },
    {
      id: "condition",
      kind: "condition",
      predicate: { registration: "ready", params: {} },
      matched: "action",
      unmatched: "end",
    },
    { id: "action", kind: "action", action: { registration: "send", params: {} }, next: "end" },
    { id: "end", kind: "end" },
  ],
};
function setup(
  goal: (context: JourneyContext) => Promise<boolean | "unknown"> = async () => false,
) {
  let time = 0;
  const store = new InMemoryJourneyStore();
  const dispatch = vi.fn(async () => "accepted" as const);
  const contexts: JourneyContext[] = [];
  const engine = new JourneyEngine({
    store,
    now: () => new Date(time),
    capabilities: ["send"],
    actions: { send: { capability: "send", validate: () => {}, dispatch } },
    predicates: {
      goal: {
        validate: () => {},
        evaluate: async (context) => {
          contexts.push(structuredClone(context));
          return goal(context);
        },
      },
      ready: {
        validate: () => {},
        evaluate: async (context) =>
          context.episode.status === "running" &&
          context.episode.wakeAt === null &&
          context.episode.revision === 2 &&
          context.episode.receipts.some(
            (receipt) =>
              receipt.reason === "wait-finished" &&
              receipt.evaluatedAt === new Date(100).toISOString(),
          ),
      },
    },
    checkLatest: async (context) => ({
      consent: context.episode.receipts.some((receipt) => receipt.reason === "matched"),
      resource: true,
    }),
  });
  engine.register(definition);
  return {
    engine,
    store,
    dispatch,
    contexts,
    advance: (now: number) => {
      time = now;
    },
  };
}
describe("Journey dry-run transition context", () => {
  it("uses projected wait and condition receipts to select the same runtime path without writes", async () => {
    const f = setup();
    const result = await f.engine.dryRun("journey", "1", entry);
    expect(result.steps.map((step) => step.outcome)).toEqual([
      "wait",
      "matched",
      "proposed",
      "completed",
    ]);
    const actionContext = f.contexts.find((context) => context.episode.nodeId === "action");
    expect(actionContext?.episode.receipts.map((receipt) => receipt.reason)).toEqual([
      "wait-started",
      "wait-finished",
      "matched",
    ]);
    expect(actionContext?.episode.revision).toBe(3);
    expect(await f.store.list(scope)).toEqual([]);
    expect(f.dispatch).not.toHaveBeenCalled();
    expect(result.episode.receipts).toEqual([]);
    await f.engine.enter("journey", "1", entry);
    await f.engine.tick(scope, entry.id);
    f.advance(100);
    await f.engine.tick(scope, entry.id);
    const runtime = await f.engine.tick(scope, entry.id);
    expect(runtime.nodeId).toBe("action");
    expect(runtime.receipts).toEqual(actionContext?.episode.receipts);
  });
  it("rechecks the goal at the projected wake before recording wait completion", async () => {
    const f = setup(
      async (context) =>
        context.episode.status === "waiting" &&
        context.episode.receipts.some((receipt) => receipt.reason === "wait-started"),
    );
    const result = await f.engine.dryRun("journey", "1", entry);
    expect(result.steps.map((step) => step.outcome)).toEqual(["suppressed"]);
    expect(result.steps[0].reason).toBe("goal-achieved");
    expect(f.contexts.at(-1)?.episode.receipts.map((receipt) => receipt.reason)).toEqual([
      "wait-started",
    ]);
    expect(f.dispatch).not.toHaveBeenCalled();
  });
  it("preserves unknown deferral and deadline at the projected wake", async () => {
    const f = setup(async (context) => (context.episode.status === "waiting" ? "unknown" : false));
    const result = await f.engine.dryRun("journey", "1", entry);
    expect(result.steps[0]).toMatchObject({
      outcome: "deferred",
      wakeAt: new Date(110).toISOString(),
      deadlineAt: new Date(130).toISOString(),
      deadlineReason: "blocked-unknown-deadline",
    });
    expect(await f.store.list(scope)).toEqual([]);
  });
  it("does not invent provider acceptance when traversing a proposed action", async () => {
    const f = setup();
    await f.engine.dryRun("journey", "1", entry);
    const end = f.contexts.find((context) => context.episode.nodeId === "end");
    expect(end?.episode.intents).toEqual([]);
    expect(end?.episode.receipts.at(-1)?.reason).toBe("action-proposed");
    expect(end?.episode.receipts.some((receipt) => receipt.reason === "dispatch-accepted")).toBe(
      false,
    );
  });
});
