import { describe, expect, it } from "vitest";
import { InMemoryJourneyStore, JourneyEngine, JourneyProblem } from "../index";
import type { JourneyDefinition } from "../index";

const scope = { appId: "shop", environment: "test", tenantId: "tenant" };
const entry = {
  id: "one",
  scope,
  subject: "buyer",
  businessObjectRef: "cart",
  episodeKey: "session",
  sourceEventId: "event",
};
const definition: JourneyDefinition = {
  id: "purchase",
  version: "1",
  entry: "wait",
  goal: { registration: "goal", params: { outer: { first: 1, second: 2 } } },
  reentry: "once",
  unknownRetryMs: 10,
  unknownDeadlineMs: 30,
  nodes: [
    { id: "wait", kind: "wait", durationMs: 100, next: "end" },
    { id: "end", kind: "end" },
  ],
};
function engine(store = new InMemoryJourneyStore(), now = () => new Date(0)) {
  return new JourneyEngine({
    store,
    now,
    predicates: { goal: { validate() {}, evaluate: async () => false } },
    actions: {},
    capabilities: [],
    checkLatest: async () => ({ consent: true, resource: true }),
  });
}

describe("JourneyDefinition", () => {
  it("preserves pinned versions across reordered definition and nested parameter keys", async () => {
    const store = new InMemoryJourneyStore();
    const original = engine(store);
    original.register(definition);
    await original.enter("purchase", "1", entry);
    const restarted = engine(store);
    restarted.register({
      nodes: [
        { next: "end", durationMs: 100, kind: "wait", id: "wait" },
        { kind: "end", id: "end" },
      ],
      unknownDeadlineMs: 30,
      unknownRetryMs: 10,
      reentry: "once",
      goal: { params: { outer: { second: 2, first: 1 } }, registration: "goal" },
      entry: "wait",
      version: "1",
      id: "purchase",
    });
    await expect(restarted.tick(scope, entry.id)).resolves.toMatchObject({ status: "waiting" });
    const changed = engine(store);
    changed.register({
      ...definition,
      goal: { registration: "goal", params: { outer: { first: 3, second: 2 } } },
    });
    await expect(changed.tick(scope, entry.id)).rejects.toMatchObject({
      code: "lifecycle-core/journey-version-drift",
    });
  });

  it.each(["wait", "retry", "deadline"])(
    "rejects an out-of-range %s interval at registration",
    (interval) => {
      const invalid = structuredClone(definition);
      if (interval === "wait")
        invalid.nodes = [
          { id: "wait", kind: "wait", durationMs: Number.MAX_VALUE, next: "end" },
          { id: "end", kind: "end" },
        ];
      else if (interval === "retry") invalid.unknownRetryMs = Number.MAX_VALUE;
      else invalid.unknownDeadlineMs = Number.MAX_VALUE;
      expect(() => engine().register(invalid)).toThrow(JourneyProblem);
    },
  );

  it("rejects a wait path whose cumulative projection exceeds the Date range", () => {
    expect(() =>
      engine().register({
        ...definition,
        nodes: [
          { id: "wait", kind: "wait", durationMs: 5_000_000_000_000_000, next: "again" },
          { id: "again", kind: "wait", durationMs: 5_000_000_000_000_000, next: "end" },
          { id: "end", kind: "end" },
        ],
      }),
    ).toThrow(JourneyProblem);
  });

  it("reports a Journey diagnostic if a later clock makes a registered interval unrepresentable", async () => {
    let now = new Date(0);
    const runtime = engine(new InMemoryJourneyStore(), () => now);
    runtime.register(definition);
    await runtime.enter("purchase", "1", entry);
    now = new Date(8_640_000_000_000_000);
    await expect(runtime.tick(scope, entry.id)).rejects.toMatchObject({
      code: "lifecycle-core/journey-definition",
    });
  });

  it("caps a long retry before validating the scheduled date", async () => {
    let now = new Date(0);
    let unknown = false;
    const runtime = new JourneyEngine({
      store: new InMemoryJourneyStore(),
      now: () => now,
      predicates: { goal: { validate() {}, evaluate: async () => (unknown ? "unknown" : false) } },
      actions: {},
      capabilities: [],
      checkLatest: async () => ({ consent: true, resource: true }),
    });
    runtime.register({ ...definition, unknownRetryMs: 8_640_000_000_000_000 });
    await runtime.enter("purchase", "1", entry);
    await runtime.tick(scope, entry.id);
    now = new Date(100);
    unknown = true;
    await expect(runtime.tick(scope, entry.id)).resolves.toMatchObject({
      wakeAt: new Date(130).toISOString(),
    });
  });
});
