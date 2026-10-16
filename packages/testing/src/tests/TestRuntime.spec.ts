import { beforeEach, describe, expect, it } from "vitest";
import { createSlidingWindowPolicy, SlidingWindowInMemoryStore } from "@croco/ratelimit-core";
import { ExponentialBackoff } from "@croco/retry-core";
import {
  fixedClock,
  resetCrocoTestingContext,
  seededIds,
  TestKernelOutboundCallProblem,
  TestRuntime,
  TestRuntimeConfigurationProblem,
  TestRuntimeDrainProblem,
} from "../index";

describe("TestRuntime", () => {
  beforeEach(() => {
    resetCrocoTestingContext();
  });

  it("advances virtual time and drains only Croco-owned scheduled work in order", async () => {
    const clock = fixedClock("2026-01-01T00:00:00.000Z");
    const events: string[] = [];
    clock.schedule(
      () => {
        events.push("late");
      },
      "30s",
      "retry:late",
    );
    clock.schedule(
      () => {
        events.push("early");
        clock.schedule(
          () => {
            events.push("nested");
          },
          "5s",
          "retry:nested",
        );
      },
      "10s",
      "retry:early",
    );

    await clock.advanceBy("15s");

    expect(events).toEqual(["early", "nested"]);
    expect(clock.now.toISOString()).toBe("2026-01-01T00:00:15.000Z");
    expect(clock.pendingWork).toEqual([
      {
        dueAt: "2026-01-01T00:00:30.000Z",
        id: "scheduled-1",
        source: "retry:late",
      },
    ]);
  });

  it("preserves insertion order for work scheduled at the same virtual time", async () => {
    const clock = fixedClock("2026-01-01T00:00:00.000Z");
    const events: string[] = [];

    for (let index = 0; index < 12; index += 1) {
      clock.schedule(
        () => {
          events.push(String(index));
        },
        0,
        "same-time",
      );
    }

    await clock.drain();

    expect(events).toEqual(Array.from({ length: 12 }, (_, index) => String(index)));
  });

  it("drains async callbacks awaiting nested sleeps on the same clock", async () => {
    const clock = fixedClock("2026-01-01T00:00:00.000Z");
    const events: string[] = [];
    clock.schedule(async () => {
      events.push("entered");
      await clock.sleep(10);
      events.push(`first:${clock.now.getTime()}`);
      await clock.sleep(7);
      events.push(`finished:${clock.now.getTime()}`);
    }, 0);

    await clock.drain();

    expect(events).toEqual(["entered", "first:1767225600010", "finished:1767225600017"]);
    expect(clock.now.toISOString()).toBe("2026-01-01T00:00:00.017Z");
    expect(clock.pendingWork).toEqual([]);
  });

  it("orders overlapping callbacks and nested promise continuations by virtual time", async () => {
    const clock = fixedClock("2026-01-01T00:00:00.000Z");
    const events: string[] = [];
    const pause = async () => {
      for (let index = 0; index < 8; index += 1) await Promise.resolve();
      await clock.sleep(4);
    };
    clock.schedule(async () => {
      events.push("first:start");
      await pause();
      events.push(`first:end:${clock.now.getTime()}`);
    }, 0);
    clock.schedule(async () => {
      events.push("second:start");
      await clock.sleep(9);
      events.push(`second:end:${clock.now.getTime()}`);
    }, 2);

    await clock.drain();

    expect(events).toEqual([
      "first:start",
      "second:start",
      "first:end:1767225600004",
      "second:end:1767225600011",
    ]);
    expect(clock.pendingWork).toEqual([]);
  });

  it("keeps async sleeps beyond an advance horizon pending until the next advance", async () => {
    const clock = fixedClock("2026-01-01T00:00:00.000Z");
    const events: string[] = [];
    clock.schedule(async () => {
      events.push("entered");
      await clock.sleep(10);
      events.push("finished");
    }, 0);

    await clock.advanceBy(5);
    expect(events).toEqual(["entered"]);
    expect(clock.now.toISOString()).toBe("2026-01-01T00:00:00.005Z");
    expect(clock.pendingWork).toMatchObject([
      { dueAt: "2026-01-01T00:00:00.010Z", source: "sleep" },
    ]);

    await clock.advanceBy(5);
    expect(events).toEqual(["entered", "finished"]);
    expect(clock.now.toISOString()).toBe("2026-01-01T00:00:00.010Z");
    expect(clock.pendingWork).toEqual([]);
  });

  it.each(["fresh", "after-failure"] as const)(
    "finishes bounded advancement without waiting for external work: %s",
    async (state) => {
      const clock = fixedClock("2026-01-01T00:00:00.000Z");
      let release = () => {};
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const events: string[] = [];
      clock.schedule(async () => {
        await gate;
        await clock.sleep(2);
        events.push(clock.now.toISOString());
      }, 0);
      if (state === "after-failure") {
        const problem = new TestRuntimeConfigurationProblem("duration", "-1", "non-negative");
        clock.schedule(() => {
          throw problem;
        }, 0);
        await expect(clock.drain()).rejects.toBe(problem);
      }

      let advanced = false;
      const advancing = clock.advanceBy(5).then(() => {
        advanced = true;
      });
      try {
        await new Promise<void>((resolve) => setImmediate(resolve));
        expect(advanced).toBe(true);
        expect(clock.now.toISOString()).toBe("2026-01-01T00:00:00.005Z");
        expect(events).toEqual([]);
      } finally {
        release();
        await advancing;
      }
      await clock.drain();
      expect(events).toEqual(["2026-01-01T00:00:00.007Z"]);
      expect(clock.pendingWork).toEqual([]);
    },
  );

  it.each(["sync", "async"] as const)(
    "propagates %s callback failures without consuming later work",
    async (kind) => {
      const clock = fixedClock("2026-01-01T00:00:00.000Z");
      const problem = new TestRuntimeConfigurationProblem("duration", "-1", "non-negative");
      const fail = () => {
        throw problem;
      };
      clock.schedule(
        kind === "sync"
          ? fail
          : async () => {
              await clock.sleep(3);
              throw problem;
            },
        0,
      );
      const later: string[] = [];
      clock.schedule(
        () => {
          later.push("ran");
        },
        8,
        "later",
      );

      await expect(clock.drain()).rejects.toBe(problem);
      expect(later).toEqual([]);
      expect(clock.pendingWork).toMatchObject([{ source: "later" }]);
      await clock.drain();
      expect(later).toEqual(["ran"]);
      expect(clock.pendingWork).toEqual([]);
    },
  );

  it("waits for callback completion and notices work scheduled after an external promise", async () => {
    const clock = fixedClock("2026-01-01T00:00:00.000Z");
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let finished = false;
    clock.schedule(async () => {
      await gate;
      await clock.sleep(6);
      finished = true;
    }, 0);
    const draining = clock.drain();
    // A separate host turn makes the callback wait with an empty scheduler queue.
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(finished).toBe(false);
    release();
    await draining;

    expect(finished).toBe(true);
    expect(clock.now.toISOString()).toBe("2026-01-01T00:00:00.006Z");
    expect(clock.pendingWork).toEqual([]);
  });

  it("settles nested continuations after waking with newly scheduled work", async () => {
    const clock = fixedClock("2026-01-01T00:00:00.000Z");
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const events: string[] = [];
    clock.schedule(async () => {
      await gate;
      clock.schedule(() => {
        events.push(`late:${clock.now.getTime()}`);
      }, 10);
      for (let index = 0; index < 8; index += 1) await Promise.resolve();
      clock.schedule(() => {
        events.push(`early:${clock.now.getTime()}`);
      }, 0);
    }, 0);
    const draining = clock.drain();
    await new Promise<void>((resolve) => setImmediate(resolve));
    release();
    await draining;

    expect(events).toEqual(["early:1767225600000", "late:1767225600010"]);
    expect(clock.pendingWork).toEqual([]);
  });

  it("applies one callback budget across an async sleep loop and can drain after it stops", async () => {
    const clock = fixedClock("2026-01-01T00:00:00.000Z");
    let repeat = true;
    let finished = false;
    clock.schedule(async () => {
      while (repeat) await clock.sleep(1, "loop-sleep");
      finished = true;
    }, 0);

    await expect(clock.drain()).rejects.toMatchObject({
      code: "testing/test-runtime-drain-limit",
      extensions: { limit: 10_000 },
    });
    expect(finished).toBe(false);
    expect(clock.pendingWork).toMatchObject([{ source: "loop-sleep" }]);
    repeat = false;
    await clock.drain();
    expect(finished).toBe(true);
    expect(clock.pendingWork).toEqual([]);
  });

  it("reports non-terminating same-time rescheduling with a stable Problem", async () => {
    const clock = fixedClock("2026-01-01T00:00:00.000Z");
    const reschedule = () => {
      clock.schedule(reschedule, 0, "same-time-loop");
    };
    clock.schedule(reschedule, 0, "same-time-loop");

    await expect(clock.drain()).rejects.toThrow(TestRuntimeDrainProblem);
  });

  it("reports non-terminating positive-delay rescheduling with a stable Problem", async () => {
    const clock = fixedClock("2026-01-01T00:00:00.000Z");
    const reschedule = () => {
      clock.schedule(reschedule, 1, "positive-delay-loop");
    };
    clock.schedule(reschedule, 1, "positive-delay-loop");

    await expect(clock.drain()).rejects.toThrow(TestRuntimeDrainProblem);
  });

  it("replays seeded ids and random values without touching process state", () => {
    const first = seededIds("invitation-retry");
    const second = seededIds("invitation-retry");
    const advancedIds = seededIds("invitation-retry");
    advancedIds.next("already-used");
    const expectedIds = seededIds("invitation-retry");
    expectedIds.next("already-used");
    const environmentBefore = process.env["CROCO_TEST_RUNTIME_FIXTURE"];
    const runtime = new TestRuntime({
      environment: { CROCO_TEST_RUNTIME_FIXTURE: "scoped" },
      ids: "invitation-retry",
      scenarioId: "retry-replay",
    });

    expect(first.next("invitation")).toBe(second.next("invitation"));
    expect(first.random.next()).toBe(second.random.next());
    expect(runtime.environment.get("CROCO_TEST_RUNTIME_FIXTURE")).toBe("scoped");
    expect(process.env["CROCO_TEST_RUNTIME_FIXTURE"]).toBe(environmentBefore);
    expect(runtime.replay).toEqual({
      scenarioId: "retry-replay",
      seed: "invitation-retry",
      virtualTime: "2026-01-01T00:00:00.000Z",
    });

    const runtimeWithAdvancedIds = new TestRuntime({ ids: advancedIds });

    expect(runtimeWithAdvancedIds.scenarioId).toBe(expectedIds.next("scenario"));
    expect(runtimeWithAdvancedIds.ids).toBe(advancedIds);
  });

  it("forks seeded ID sources without resetting their sequence or entropy", () => {
    const ids = seededIds("forked-ids");
    ids.next("already-used");
    const fork = ids.fork();

    expect(fork.next("next")).toBe(ids.next("next"));
  });

  it("reports invalid time controls with a stable Problem code", async () => {
    expect(() => fixedClock("not-a-date")).toThrow(TestRuntimeConfigurationProblem);
    expect(() => fixedClock("2026-01-01T00:00:00.000Z").schedule(() => undefined, -1)).toThrow(
      TestRuntimeConfigurationProblem,
    );
    expect(() => fixedClock(new Date(8_640_000_000_000_000)).schedule(() => undefined, 1)).toThrow(
      TestRuntimeConfigurationProblem,
    );
    await expect(
      fixedClock("2026-01-01T00:00:00.000Z").advanceBy(Number.MAX_SAFE_INTEGER),
    ).rejects.toThrow(TestRuntimeConfigurationProblem);
  });

  it("rejects outbound calls by default with a provider-facing diagnostic", async () => {
    const runtime = new TestRuntime({ network: "deny" });

    await expect(
      runtime.network.fetch("https://provider.example.test/v1/send"),
    ).rejects.toMatchObject({
      code: "testing/test-kernel-outbound-call",
      extensions: {
        host: "provider.example.test",
        recovery: "Register a provider fake or explicitly allow this outbound call.",
      },
    });
    await expect(runtime.network.fetch("not a url")).rejects.toThrow(TestKernelOutboundCallProblem);
  });

  it("supplies virtual time and seeded entropy to rate-limit boundaries without global timers", async () => {
    const runtime = new TestRuntime({ ids: "rate-limit", network: "deny" });
    const store = new SlidingWindowInMemoryStore({
      now: () => runtime.clock.now.getTime(),
      pruneIntervalMs: 30_000,
      random: () => runtime.random.next(),
      scheduler: {
        schedule: (callback, delayMs) =>
          runtime.clock.schedule(callback, delayMs, "rate-limit:prune"),
      },
    });
    const policy = createSlidingWindowPolicy("test-runtime", 1, 30_000);

    await expect(store.check("tenant:one", policy)).resolves.toMatchObject({
      remaining: 0,
      success: true,
    });
    await expect(store.check("tenant:one", policy)).resolves.toMatchObject({ success: false });

    await runtime.clock.advanceBy(30_001);

    expect(runtime.clock.pendingWork).toMatchObject([{ source: "rate-limit:prune" }]);

    await expect(store.check("tenant:one", policy)).resolves.toMatchObject({
      remaining: 0,
      success: true,
    });
    store.close();
    expect(runtime.clock.pendingWork).toEqual([]);
  });

  it("drains retry-core backoff through kernel-owned virtual time", async () => {
    const runtime = new TestRuntime({ ids: "retry-replay" });
    const retry = new ExponentialBackoff({ delay: 30_000, jitter: false }, runtime.retry);
    const wait = retry.wait(0);

    expect(runtime.clock.pendingWork).toMatchObject([{ source: "retry:backoff" }]);

    await runtime.clock.advanceBy("30s");

    await expect(wait).resolves.toBeUndefined();
  });

  it("cancels retry-core backoff without leaving virtual work pending", async () => {
    const runtime = new TestRuntime({ ids: "retry-abort" });
    const controller = new AbortController();
    const retry = new ExponentialBackoff({ delay: 30_000, jitter: false }, runtime.retry);
    const wait = retry.wait(0, controller.signal);

    expect(runtime.retry.sleepSupportsAbortSignal).toBe(true);
    expect(runtime.clock.pendingWork).toMatchObject([{ source: "retry:backoff" }]);

    controller.abort();

    await expect(wait).rejects.toBe(controller.signal.reason);
    expect(runtime.clock.pendingWork).toEqual([]);
  });
});
