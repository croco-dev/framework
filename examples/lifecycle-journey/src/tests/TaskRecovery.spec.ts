import assert from "node:assert/strict";
import { it as test } from "vitest";
import { InMemoryJourneyStore, JourneyEngine, JourneyProblem } from "@croco/lifecycle-core";
import { createJourneyRuntime } from "../tasks";

test("recovers a failed task without starving another episode", async () => {
  const scope = { appId: "shop", environment: "test", tenantId: "one" };
  const store = new InMemoryJourneyStore();
  let clock = new Date(0);
  const sent: string[] = [];
  const engine = new JourneyEngine({
    store,
    now: () => clock,
    predicates: { goal: { validate() {}, evaluate: async () => false } },
    actions: {
      send: {
        validate() {},
        capability: "message",
        dispatch: async ({ episode }) => {
          sent.push(episode.id);
          return "accepted";
        },
      },
    },
    capabilities: ["message"],
    checkLatest: async () => ({ consent: true, resource: true }),
  });
  engine.register({
    id: "journey",
    version: "1",
    entry: "send",
    goal: { registration: "goal", params: {} },
    reentry: "once",
    unknownRetryMs: 10,
    unknownDeadlineMs: 100,
    nodes: [
      { id: "send", kind: "action", action: { registration: "send", params: {} }, next: "end" },
      { id: "end", kind: "end" },
    ],
  });
  for (const id of ["first", "second"])
    await engine.enter("journey", "1", {
      id,
      scope,
      subject: id,
      businessObjectRef: id,
      episodeKey: id,
      sourceEventId: id,
    });
  const tick = engine.tick.bind(engine);
  let unavailable = true;
  engine.tick = async (...args) => {
    if (args[1] === "first" && unavailable)
      throw new JourneyProblem("unavailable", "Worker unavailable");
    return tick(...args);
  };
  const initial = createJourneyRuntime(store, engine, scope, () => clock);
  await assert.rejects(initial.wake.run());
  assert.deepEqual(sent, ["second"]);
  const failed = (await initial.executionStore.list()).find((item) => item.status === "failed");
  assert.ok(failed);
  unavailable = false;
  clock = new Date(30_001);
  const recovered = createJourneyRuntime(store, engine, scope, () => clock, initial.executionStore);
  await recovered.wake.run();
  await recovered.wake.run();
  assert.deepEqual(sent.sort(), ["first", "second"]);
  assert.equal((await initial.executionStore.findById(failed.id))?.status, "completed");
  assert.equal((await store.get(scope, "first"))?.status, "completed");
});

test("fences a live abandoned invocation after a replacement worker completes", async () => {
  const scope = { appId: "shop", environment: "test", tenantId: "overlap" };
  const store = new InMemoryJourneyStore();
  let clock = new Date(0);
  let sends = 0;
  const engine = new JourneyEngine({
    store,
    now: () => clock,
    predicates: { goal: { validate() {}, evaluate: async () => false } },
    actions: {
      send: {
        validate() {},
        capability: "message",
        dispatch: async () => {
          sends++;
          return "accepted";
        },
      },
    },
    capabilities: ["message"],
    checkLatest: async () => ({ consent: true, resource: true }),
  });
  engine.register({
    id: "journey",
    version: "1",
    entry: "send",
    goal: { registration: "goal", params: {} },
    reentry: "once",
    unknownRetryMs: 10,
    unknownDeadlineMs: 100,
    nodes: [
      { id: "send", kind: "action", action: { registration: "send", params: {} }, next: "end" },
      { id: "end", kind: "end" },
    ],
  });
  await engine.enter("journey", "1", {
    id: "one",
    scope,
    subject: "one",
    businessObjectRef: "one",
    episodeKey: "one",
    sourceEventId: "one",
  });
  let release: () => void = () => {};
  let started: () => void = () => {};
  const suspended = new Promise<void>((resolve) => {
    release = resolve;
  });
  const entered = new Promise<void>((resolve) => {
    started = resolve;
  });
  const tick = engine.tick.bind(engine);
  let block = true;
  engine.tick = async (...args) => {
    if (block) {
      block = false;
      started();
      await suspended;
    }
    return tick(...args);
  };
  const initial = createJourneyRuntime(store, engine, scope, () => clock);
  const pending = initial.wake.run();
  const settled = Promise.allSettled([pending]);
  await entered;
  const [running] = await initial.executionStore.list({ status: "running" });
  assert.ok(running);
  await initial.executionStore.update(running.id, { startedAt: new Date(Date.now() - 60_000) });
  clock = new Date(30_001);
  const replacement = createJourneyRuntime(
    store,
    engine,
    scope,
    () => clock,
    initial.executionStore,
  );
  await replacement.wake.run();
  assert.equal(sends, 1);
  release();
  await settled;
  await replacement.wake.run();
  assert.equal(sends, 1);
  assert.equal((await initial.executionStore.findById(running.id))?.status, "completed");
  assert.equal((await initial.executionStore.findById(running.id))?.attempts, 2);
  assert.equal((await store.get(scope, "one"))?.status, "completed");
});
