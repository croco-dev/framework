// croco-test-clock: controlled
import { fixedClock } from "@croco/testing";
import { describe, expect, it } from "vitest";
import { InMemoryLifecycleRuleStateStore, LifecycleRuleRegistry } from "../index";
import type { LifecycleRule } from "../index";

function fixture() {
  const time = fixedClock("2026-07-26T00:00:00.000Z");
  const stateStore = new InMemoryLifecycleRuleStateStore({
    now: () => time.now,
    scheduleExecutionClaimWake: (wake, delayMs) => time.schedule(wake, delayMs, "execution-lease"),
  });
  return { time, stateStore, registry: new LifecycleRuleRegistry({ stateStore }) };
}
async function registerVersion(
  registry: LifecycleRuleRegistry,
  version: string,
  options: { activate: true },
) {
  const rule: LifecycleRule = {
    id: "retention-risk",
    description: "Lease-bound retention check",
    triggers: [{ type: "scheduled.reevaluation" }],
    severity: "high",
    cooldown: { durationMs: 60_000 },
    when: () => true,
    actions: [{ id: "follow-up", type: "cs.follow_up", title: "Follow up" }],
  };
  return registry.registerVersion({
    rule,
    version,
    executableRegistrationId: `retention-risk:${version}`,
    executableFingerprint: `retention-risk-bundle:${version}`,
    activate: options.activate,
    registeredAt: new Date("2026-07-26T00:00:00Z"),
  });
}
describe("Lifecycle controlled execution leases", () => {
  it("rejects duplicate execution lease identifiers instead of sharing ownership", async () => {
    const { time, stateStore, registry } = fixture();
    await registerVersion(registry, "1.0.0", { activate: true });
    const claim = {
      claimId: "duplicate-lease",
      ruleId: "retention-risk",
      version: "1.0.0",
      expiresAt: new Date(time.now.getTime() + 30_000),
    };

    expect(stateStore.claimExecution(claim)).toEqual({ claimed: true });
    expect(stateStore.claimExecution(claim)).toEqual({ claimed: false, state: undefined });

    stateStore.releaseExecution(claim.claimId);
  });

  it("automatically resumes a blocked transition when an abandoned execution lease expires", async () => {
    const { time, stateStore, registry } = fixture();
    await registerVersion(registry, "1.0.0", { activate: true });
    expect(
      stateStore.claimExecution({
        claimId: "abandoned-lease",
        ruleId: "retention-risk",
        version: "1.0.0",
        expiresAt: new Date(time.now.getTime() + 10),
      }),
    ).toEqual({ claimed: true });

    let settled = false;
    const pausing = registry
      .pause({
        commandId: "pause-after-lease-expiry",
        ruleId: "retention-risk",
        version: "1.0.0",
        expectedRevision: 1,
      })
      .then((result) => {
        settled = true;
        return result;
      });
    await time.advanceBy(9);
    expect(settled).toBe(false);
    await time.advanceBy(1);
    await expect(pausing).resolves.toMatchObject({ state: { revision: 2 } });
    expect(await registry.getRegistrationState("retention-risk", "1.0.0")).toBe("paused");
  });

  it("uses the configured logical scheduler when an execution lease expires", async () => {
    const { time, stateStore, registry } = fixture();
    await registerVersion(registry, "1.0.0", { activate: true });
    expect(
      stateStore.claimExecution({
        claimId: "logical-clock-lease",
        ruleId: "retention-risk",
        version: "1.0.0",
        expiresAt: new Date(time.now.getTime() + 1_000),
      }),
    ).toEqual({ claimed: true });

    const pausing = registry.pause({
      commandId: "pause-after-logical-lease-expiry",
      ruleId: "retention-risk",
      version: "1.0.0",
      expectedRevision: 1,
    });
    await time.advanceBy(1_000);
    await expect(pausing).resolves.toMatchObject({ state: { revision: 2 } });
    expect(time.now).toEqual(new Date("2026-07-26T00:00:01.000Z"));
  });
});
