import { describe, expect, it } from "vitest";
import { createSlidingWindowPolicy, SlidingWindowInMemoryStore } from "@croco/ratelimit-core";
import { ExponentialBackoff } from "@croco/retry-core";
import {
  fixedClock,
  seededIds,
  TestKernelOutboundCallProblem,
  TestRuntime,
  TestRuntimeConfigurationProblem,
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

  it("replays seeded ids and random values without touching process state", () => {
    const first = seededIds("invitation-retry");
    const second = seededIds("invitation-retry");
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
  });

  it("reports invalid time controls with a stable Problem code", () => {
    expect(() => fixedClock("not-a-date")).toThrow(TestRuntimeConfigurationProblem);
    expect(() => fixedClock("2026-01-01T00:00:00.000Z").schedule(() => undefined, -1)).toThrow(
      TestRuntimeConfigurationProblem,
    );
  });

  it("rejects outbound calls by default with a provider-facing diagnostic", () => {
    const runtime = new TestRuntime({ network: "deny" });

    expect(() => runtime.network.fetch("https://provider.example.test/v1/send")).toThrow(
      TestKernelOutboundCallProblem,
    );
    try {
      runtime.network.fetch("https://provider.example.test/v1/send");
    } catch (error) {
      expect(error).toMatchObject({
        code: "testing/test-kernel-outbound-call",
        extensions: {
          host: "provider.example.test",
          recovery: "Register a provider fake or explicitly allow this outbound call.",
        },
      });
    }
  });

  it("supplies virtual time and seeded entropy to rate-limit boundaries without global timers", async () => {
    const runtime = new TestRuntime({ ids: "rate-limit", network: "deny" });
    const store = new SlidingWindowInMemoryStore({
      now: () => runtime.clock.now.getTime(),
      pruneIntervalMs: 0,
      random: () => runtime.random.next(),
    });
    const policy = createSlidingWindowPolicy("test-runtime", 1, 30_000);

    await expect(store.check("tenant:one", policy)).resolves.toMatchObject({
      remaining: 0,
      success: true,
    });
    await expect(store.check("tenant:one", policy)).resolves.toMatchObject({ success: false });

    await runtime.clock.advanceBy(30_001);

    await expect(store.check("tenant:one", policy)).resolves.toMatchObject({
      remaining: 0,
      success: true,
    });
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
