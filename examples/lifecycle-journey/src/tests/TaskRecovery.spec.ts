// croco-test-clock: controlled
import assert from "node:assert/strict";
import { it as test } from "vitest";
import { InMemoryJourneyStore, JourneyEngine, JourneyProblem } from "@croco/lifecycle-core";
import { fixedClock } from "@croco/testing";
import { createJourneyRuntime } from "../tasks";

function fixtureTime() {
  const time = fixedClock(new Date(0));
  return {
    time,
    executionTime: {
      clock: () => time.now,
      schedule: (wake: () => void, delayMs: number) => time.schedule(wake, delayMs),
    },
  };
}

test("recovers a failed task without starving another episode", async () => {
  const scope = { appId: "shop", environment: "test", tenantId: "one" };
  const store = new InMemoryJourneyStore();
  const { time, executionTime } = fixtureTime();
  const sent: string[] = [];
  const engine = new JourneyEngine({
    store,
    now: executionTime.clock,
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
  const initial = createJourneyRuntime(
    store,
    engine,
    scope,
    executionTime.clock,
    undefined,
    executionTime,
  );
  await assert.rejects(initial.wake.run());
  assert.deepEqual(sent, ["second"]);
  const failed = (await initial.executionStore.list()).find((item) => item.status === "failed");
  assert.ok(failed);
  unavailable = false;
  await time.advanceBy(30_001);
  const recovered = createJourneyRuntime(
    store,
    engine,
    scope,
    executionTime.clock,
    initial.executionStore,
    executionTime,
  );
  await recovered.wake.run();
  await recovered.wake.run();
  assert.deepEqual(sent.sort(), ["first", "second"]);
  assert.equal((await initial.executionStore.findById(failed.id))?.status, "completed");
  assert.equal((await store.get(scope, "first"))?.status, "completed");
});

test("fences a live abandoned invocation after a replacement worker completes", async () => {
  const scope = { appId: "shop", environment: "test", tenantId: "overlap" };
  const store = new InMemoryJourneyStore();
  const { time, executionTime } = fixtureTime();
  let sends = 0;
  const engine = new JourneyEngine({
    store,
    now: executionTime.clock,
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
  const initial = createJourneyRuntime(store, engine, scope, executionTime.clock, undefined, {
    ...executionTime,
    // The suspended worker cannot deliver its own timeout callback.
    schedule: () => () => {},
  });
  // The episode claim can expire before the task itself is eligible for retry.
  const pending = initial.bridge.dispatchDue(scope, time.now, 1, 29_999);
  const settled = Promise.allSettled([pending]);
  try {
    await entered;
    const [running] = await initial.executionStore.list({ status: "running" });
    assert.ok(running);
    assert.deepEqual(running.createdAt, new Date(0));
    assert.deepEqual(running.startedAt, new Date(0));
    const replacement = createJourneyRuntime(
      store,
      engine,
      scope,
      executionTime.clock,
      initial.executionStore,
      executionTime,
    );
    await time.advanceBy(29_999);
    await assert.rejects(replacement.bridge.dispatchDue(scope, time.now, 1, 1), {
      code: "execution/invalid-state-transition",
    });
    assert.equal(sends, 0);
    assert.equal((await initial.executionStore.findById(running.id))?.attempts, 1);

    await time.advanceBy(1);
    assert.equal(await replacement.wake.run(), 1);
    assert.equal(sends, 1);
    release();
    await settled;
    await replacement.wake.run();
    assert.equal(sends, 1);
    const completed = await initial.executionStore.findById(running.id);
    assert.equal(completed?.status, "completed");
    assert.equal(completed?.attempts, 2);
    assert.deepEqual(completed?.completedAt, new Date(30_000));
    assert.equal((await store.get(scope, "one"))?.status, "completed");
  } finally {
    release();
    await settled;
  }
});
