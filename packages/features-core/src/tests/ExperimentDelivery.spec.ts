import { describe, expect, it, vi } from "vitest";
import {
  experimentRegionFragment,
  ExperimentDeliveryBridge,
  InMemoryExperimentDeliveryStore,
  ExperimentRuntime,
  InMemoryExperimentStore,
} from "../index";
import type {
  ExperimentRenderDecision,
  ExperimentDefinition,
  ExperimentDeliveryIdentity,
  ExperimentRegistration,
} from "../index";
const scope = { app: "checkout", environment: "test", tenantId: "alpha" };
const identity: ExperimentDeliveryIdentity = {
  scope,
  subject: { kind: "user", id: "buyer-a" },
  actor: "server",
};
const target = { experimentId: "assurance", experimentRevision: "v1", scope };
const definition: ExperimentDefinition = {
  id: "assurance",
  revision: "v1",
  unit: "user",
  loginPolicy: "preserve-unit",
  salt: "test",
  allocatorVersion: "sha256-v1",
  allocation: 10000,
  variants: [{ id: "assurance", value: "Payment protected", weight: 10000 }],
  hypothesis: "Clear assurance",
  observationPlan: "completed checkout",
  eligibility: "published",
};
async function fixture(
  eligibility: ExperimentRegistration["eligibility"] = () => ({ status: "eligible" }),
) {
  let time = new Date("2026-10-01T10:00:00Z");
  const clock = { now: () => time };
  const store = new InMemoryExperimentStore();
  const runtime = new ExperimentRuntime({
    store,
    clock,
    authorization: { authorize: (r) => r.actor === "server" },
  });
  await runtime.register(
    { definition, eligibility, handlers: { assurance: () => "done" } },
    scope,
    "server",
  );
  const command = {
    ...target,
    actor: "server",
    reason: "approved",
    expectedRevision: 0,
    idempotencyKey: "start",
  };
  await runtime.start(command);
  const inspect = vi.fn();
  const receipts = new InMemoryExperimentDeliveryStore();
  const options = {
    regions: [{ id: "hero", target, policyRevision: "p1" }],
    reader: runtime,
    store: receipts,
    clock,
    ttlMs: 1000,
    evaluationTimeoutMs: 100,
    inspect,
  };
  const bridge = new ExperimentDeliveryBridge(options);
  return {
    bridge,
    runtime,
    store,
    options,
    inspect,
    clock,
    advance: (ms: number) => {
      time = new Date(time.getTime() + ms);
    },
    pause: () => runtime.pause({ ...command, expectedRevision: 1, idempotencyKey: "pause" }),
  };
}
function token(decision: { receipt?: string } | undefined): string {
  if (!decision?.receipt) throw new Error("Fixture expected a delivery receipt");
  return decision.receipt;
}
describe("ExperimentDeliveryBridge", () => {
  it("freezes only registered render decisions without exposing private assignment data", async () => {
    const { bridge, runtime, options } = await fixture();
    const assign = vi.spyOn(runtime, "assign");
    const [decision] = await bridge.prepare(["hero"], identity, "admitted");
    expect(decision).toMatchObject({
      region: "hero",
      status: "assigned",
      value: "Payment protected",
      variant: "assurance",
      phase: "admitted",
    });
    expect(JSON.stringify(decision)).not.toContain("buyer-a");
    expect(JSON.stringify(decision)).not.toContain("alpha");
    expect(Object.isFrozen(decision)).toBe(true);
    expect(assign).toHaveBeenCalledTimes(1);
    await expect(bridge.prepare(["not-registered"], identity, "admitted")).rejects.toThrow();
    expect(assign).toHaveBeenCalledTimes(1);
    const other = { ...identity, subject: { kind: "user" as const, id: "buyer-b" } };
    const [second] = await bridge.prepare(["hero"], other, "admitted");
    expect(second?.receipt).not.toBe(decision?.receipt);
    if (!second || !decision) throw new Error("Expected both decisions");
    expect(experimentRegionFragment(second)).toEqual(experimentRegionFragment(decision));
    expect(JSON.stringify(experimentRegionFragment(second))).not.toContain(token(second));
    expect(experimentRegionFragment({ ...second, policyRevision: "p2" }).key).not.toBe(
      experimentRegionFragment(decision).key,
    );
    expect(second?.deliveryId).not.toBe(decision?.deliveryId);
    expect(options.regions[0]?.policyRevision).toBe("p1");
  });
  it("prefetch does not expose; admission preserves variant and never reevaluates assignment", async () => {
    const { bridge, runtime, clock } = await fixture();
    const [prefetch] = await bridge.prepare(["hero"], identity, "speculative");
    await expect(
      bridge.expose(token(prefetch), identity, "display-a", clock.now().toISOString()),
    ).rejects.toThrow("not admitted");
    vi.spyOn(runtime, "assign").mockRejectedValue(new Error("must not allocate again"));
    const admitted = await bridge.admit(token(prefetch), identity);
    expect(admitted.variant).toBe(prefetch?.variant);
    expect(admitted.deliveryId).toBe(prefetch?.deliveryId);
    expect(admitted.receipt).not.toBe(prefetch?.receipt);
    const first = await bridge.expose(
      token(admitted),
      identity,
      "display-a",
      clock.now().toISOString(),
    );
    const retry = await bridge.expose(
      token(admitted),
      identity,
      "display-a",
      clock.now().toISOString(),
    );
    const redisplay = await bridge.expose(
      token(admitted),
      identity,
      "display-b",
      clock.now().toISOString(),
    );
    expect(retry.id).toBe(first.id);
    expect(redisplay.id).not.toBe(first.id);
  });
  it.each([
    ["prepare", "abort"],
    ["prepare", "expiry"],
    ["admit", "abort"],
    ["admit", "expiry"],
  ] as const)(
    "returns fallback when %s receipt persistence completes after %s",
    async (operation, end) => {
      const { bridge, options, advance } = await fixture();
      const controller = new AbortController();
      const [prefetch] =
        operation === "admit" ? await bridge.prepare(["hero"], identity, "speculative") : [];
      const create = options.store.create.bind(options.store);
      vi.spyOn(options.store, "create").mockImplementation(async (key, receipt) => {
        await create(key, receipt);
        // The shared store completes asynchronously after the request's validity boundary.
        if (end === "abort") controller.abort();
        else advance(1001);
      });
      const decision =
        operation === "prepare"
          ? (await bridge.prepare(["hero"], identity, "admitted", controller.signal))[0]
          : await bridge.admit(token(prefetch), identity, controller.signal);
      expect(decision).toMatchObject({ status: "fallback" });
      expect(decision?.receipt).toBeUndefined();
      expect(decision?.variant).toBeUndefined();
      expect(decision?.value).toBeUndefined();
    },
  );
  it.each(["abort", "expiry"] as const)(
    "finalizes earlier regions after a later region crosses %s",
    async (end) => {
      const { options, advance, inspect } = await fixture();
      const bridge = new ExperimentDeliveryBridge({
        ...options,
        regions: [...options.regions, { id: "footer", target, policyRevision: "p1" }],
      });
      const controller = new AbortController();
      const create = options.store.create.bind(options.store);
      vi.spyOn(options.store, "create").mockImplementation(async (key, receipt) => {
        await create(key, receipt);
        if (receipt.decision.region === "footer") {
          if (end === "abort") controller.abort();
          else advance(1001);
        }
      });
      const decisions = await bridge.prepare(
        ["hero", "footer"],
        identity,
        "admitted",
        controller.signal,
      );
      expect(decisions.map((decision) => decision.status)).toEqual(["fallback", "fallback"]);
      for (const decision of decisions) {
        expect(decision.receipt).toBeUndefined();
        expect(decision.variant).toBeUndefined();
        expect(decision.value).toBeUndefined();
      }
      expect(
        inspect.mock.calls.map(([event]) => ({ region: event.region, status: event.status })),
      ).toEqual([
        { region: "hero", status: "fallback" },
        { region: "footer", status: "fallback" },
      ]);
    },
  );
  it("rejects forged receipts and old user or tenant ownership", async () => {
    const { bridge, clock } = await fixture();
    const [decision] = await bridge.prepare(["hero"], identity, "admitted");
    for (const other of [
      { ...identity, subject: { kind: "user" as const, id: "buyer-b" } },
      { ...identity, scope: { ...scope, tenantId: "beta" } },
    ]) {
      await expect(bridge.admit(token(decision), other)).rejects.toThrow("ownership");
      await expect(
        bridge.expose(token(decision), other, "display", clock.now().toISOString()),
      ).rejects.toThrow("ownership");
    }
    await expect(
      bridge.expose("invented", identity, "display", clock.now().toISOString()),
    ).rejects.toThrow("Unknown");
  });
  it("blocks stale prefetch after pause or expiry but accepts a late historical report", async () => {
    const { bridge, pause, advance, clock } = await fixture();
    const [prefetch] = await bridge.prepare(["hero"], identity, "speculative");
    const [shown] = await bridge.prepare(["hero"], identity, "admitted");
    const occurredAt = clock.now().toISOString();
    await pause();
    expect((await bridge.admit(token(prefetch), identity)).status).toBe("fallback");
    advance(1000);
    expect((await bridge.admit(token(shown), identity)).status).toBe("fallback");
    expect(
      (await bridge.expose(token(shown), identity, "shown-before-pause", occurredAt)).assignmentId,
    ).toBeTruthy();
    const [fallback] = await bridge.prepare(["hero"], identity, "admitted");
    expect(fallback).toMatchObject({ status: "fallback" });
    expect(fallback?.receipt).toBeUndefined();
    expect(fallback?.variant).toBeUndefined();
  });
  it("rechecks current eligibility on consumption while interpreting past exposure by its original assignment", async () => {
    let available = true;
    const { bridge, clock } = await fixture(() =>
      available
        ? { status: "eligible" }
        : { status: "unavailable", reason: "privacy_or_snapshot_invalid" },
    );
    const [prefetch] = await bridge.prepare(["hero"], identity, "speculative");
    const [shown] = await bridge.prepare(["hero"], identity, "admitted");
    available = false;
    expect((await bridge.admit(token(prefetch), identity)).status).toBe("fallback");
    const [fallback] = await bridge.prepare(["hero"], identity, "admitted");
    expect(fallback?.receipt).toBeUndefined();
    expect(
      await bridge.expose(token(shown), identity, "historical", clock.now().toISOString()),
    ).toMatchObject({ kind: "display" });
  });
  it("aborted and bounded failed readers never produce reportable control decisions", async () => {
    const { options } = await fixture();
    const controller = new AbortController();
    controller.abort();
    const bridge = new ExperimentDeliveryBridge({
      ...options,
      evaluationTimeoutMs: 5,
      reader: {
        ...options.reader,
        assign: () => new Promise(() => {}),
        admitDisplay: options.reader.admitDisplay.bind(options.reader),
        recordExposure: options.reader.recordExposure.bind(options.reader),
      },
    });
    for (const signal of [controller.signal, undefined]) {
      const [decision] = await bridge.prepare(["hero"], identity, "admitted", signal);
      expect(decision).toMatchObject({ status: "fallback" });
      expect(decision?.receipt).toBeUndefined();
    }
  });
  it("reuses only public fragment content while keeping two users' response receipts private", async () => {
    const { bridge } = await fixture();
    const fragments = new Map<string, string>();
    const render = async (decisions: readonly ExperimentRenderDecision[]) => {
      const decision = decisions[0];
      if (!decision) throw new Error("Expected decision");
      const fragment = experimentRegionFragment(decision);
      if (!fragments.has(fragment.key))
        fragments.set(fragment.key, `<button>${String(fragment.value)}</button>`);
      return new Response(
        `${fragments.get(fragment.key)}<script>${JSON.stringify(decision)}</script>`,
        { headers: { vary: "Accept", "content-type": "text/html" } },
      );
    };
    const first = await bridge.render(
      ["hero"],
      identity,
      new Request("http://local/checkout"),
      render,
    );
    const second = await bridge.render(
      ["hero"],
      { ...identity, subject: { kind: "user", id: "buyer-b" } },
      new Request("http://local/checkout"),
      render,
    );
    expect(first.headers.get("cache-control")).toBe("private, no-store");
    expect(second.headers.get("vary")).toBe("Accept");
    expect(fragments.size).toBe(1);
    expect([...fragments.values()]).toEqual(["<button>Payment protected</button>"]);
    const firstHtml = await first.text();
    const secondHtml = await second.text();
    expect(firstHtml).not.toBe(secondHtml);
    expect(firstHtml).not.toContain("buyer-a");
    expect(secondHtml).not.toContain("buyer-b");
  });
  it("reports sink failure without changing the original delivered decision", async () => {
    const { bridge, runtime, inspect, clock } = await fixture();
    const [decision] = await bridge.prepare(["hero"], identity, "admitted");
    vi.spyOn(runtime, "recordExposure").mockRejectedValue(new Error("measurement offline"));
    await expect(
      bridge.expose(token(decision), identity, "display-a", clock.now().toISOString()),
    ).rejects.toThrow("measurement offline");
    expect(decision?.status).toBe("assigned");
    expect(inspect).toHaveBeenLastCalledWith(
      expect.objectContaining({
        stage: "exposure",
        reason: "display_recording_failed",
        status: "assigned",
      }),
    );
  });
  it("rejects revision drift at new admission while preserving previously delivered history", async () => {
    const { bridge, options, clock } = await fixture();
    const [prefetch] = await bridge.prepare(["hero"], identity, "speculative");
    const [shown] = await bridge.prepare(["hero"], identity, "admitted");
    const next = new ExperimentDeliveryBridge({
      ...options,
      regions: [
        {
          ...options.regions[0],
          id: "hero",
          policyRevision: "p1",
          target: { ...target, experimentRevision: "v2" },
        },
      ],
    });
    await expect(next.admit(token(prefetch), identity)).rejects.toThrow("policy revision");
    expect(
      await next.expose(token(shown), identity, "original-display", clock.now().toISOString()),
    ).toMatchObject({ kind: "display" });
  });
  it("keeps distinct region/display tuples separate even when their parts contain separators", async () => {
    const { options, clock } = await fixture();
    const bridge = new ExperimentDeliveryBridge({
      ...options,
      regions: [
        { id: "a", target, policyRevision: "p1" },
        { id: "a:b", target, policyRevision: "p1" },
      ],
    });
    const [firstDecision, secondDecision] = await bridge.prepare(
      ["a", "a:b"],
      identity,
      "admitted",
    );
    const first = await bridge.expose(
      token(firstDecision),
      identity,
      "b:screen",
      clock.now().toISOString(),
    );
    const second = await bridge.expose(
      token(secondDecision),
      identity,
      "screen",
      clock.now().toISOString(),
    );
    expect(second.id).not.toBe(first.id);
    expect(
      await bridge.expose(token(firstDecision), identity, "b:screen", clock.now().toISOString()),
    ).toEqual(first);
  });
  it("inspector failure keeps the admitted decision and remains observable", async () => {
    const { options } = await fixture();
    const bridge = new ExperimentDeliveryBridge({
      ...options,
      inspect: () => {
        throw new Error("observer offline");
      },
    });
    expect((await bridge.prepare(["hero"], identity, "admitted"))[0]?.status).toBe("assigned");
    expect(bridge.getInspectionFailureCount()).toBe(1);
  });
});
