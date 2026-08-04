import { describe, expect, it } from "vitest";
import { createSlidingWindowPolicy, SlidingWindowInMemoryStore } from "@croco/ratelimit-core";
import { ExponentialBackoff } from "@croco/retry-core";
import {
  fixedClock,
  seededIds,
  TestKernelOutboundCallProblem,
  TestRuntime,
  TestRuntimeConfigurationProblem,
  TestRuntimeDrainProblem,
} from "../index";

describe("TestRuntime", () => {
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
});
