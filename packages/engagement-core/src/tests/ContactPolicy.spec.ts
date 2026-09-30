import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  ContactPolicy,
  ContactPolicyConflictProblem,
  ContactPolicyInvalidProblem,
  EngagementService,
  InMemoryContactPolicyStore,
  InMemoryEngagementStore,
  InMemoryRecipientDirectory,
  defineMessage,
  type ContactPolicyConfig,
  type ContactPolicyRequest,
  type ContactPolicyReservation,
  type EngagementMessageRenderer,
} from "../index";
const scope = { app: "app", environment: "test", tenantId: "tenant" };
const now = new Date("2026-09-29T00:00:00Z");
const config: ContactPolicyConfig = {
  version: "1",
  rules: [{ id: "daily", limit: 1, windowMs: 86400000 }],
  reservationTtlMs: 1000,
};
const topics = [
  { id: "marketing", kind: "marketing" as const, priority: 1, messageIds: ["message"] },
  { id: "security", kind: "security" as const, priority: 100, messageIds: ["security-message"] },
];
function request(
  logicalSendId = "send",
  overrides: Partial<ContactPolicyRequest> = {},
): ContactPolicyRequest {
  return {
    scope,
    recipient: "recipient",
    channel: "email",
    topic: "marketing",
    messageId: "message",
    logicalSendId,
    payloadFingerprint: "hash",
    now,
    ...overrides,
  };
}
function setup(override: Partial<ContactPolicyConfig> = {}) {
  const store = new InMemoryContactPolicyStore();
  return {
    store,
    policy: new ContactPolicy({ store, config: { ...config, ...override }, topics }),
  };
}
async function reserved(
  policy: ContactPolicy,
  input = request(),
): Promise<ContactPolicyReservation> {
  const result = await policy.reserve(input);
  if (result.reservation === undefined) throw new Error("test expected reservation");
  return result.reservation;
}
describe("ContactPolicy", () => {
  it("atomically admits one of ten concurrent sends and preserves replay without extra consumption", async () => {
    const { store, policy } = setup();
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, index) => policy.reserve(request(String(index)))),
    );
    expect(results.filter((result) => result.decision.allowed)).toHaveLength(1);
    const replay = await policy.reserve(request("0"));
    expect(replay.replay).toBe(true);
    expect(await store.read(scope, "recipient:recipient")).toHaveLength(1);
    await expect(
      policy.reserve(request("0", { payloadFingerprint: "different" })),
    ).rejects.toBeInstanceOf(ContactPolicyConflictProblem);
  });
  it("does not consume on dry-run, isolates scopes and enforces rolling boundaries", async () => {
    const { store, policy } = setup();
    expect((await policy.evaluate(request())).allowed).toBe(true);
    expect(await store.read(scope, "recipient:recipient")).toEqual([]);
    await reserved(policy);
    expect(
      (await policy.evaluate(request("next", { now: new Date(now.getTime() + 86400000 - 1) })))
        .allowed,
    ).toBe(false);
    expect(
      (await policy.evaluate(request("next", { now: new Date(now.getTime() + 86400000) }))).allowed,
    ).toBe(true);
    expect(
      (await policy.reserve(request("next", { scope: { ...scope, tenantId: "other" } }))).decision
        .allowed,
    ).toBe(true);
  });
  it("preserves unknown and expired reservations and only releases before dispatch", async () => {
    const { policy } = setup();
    const item = await reserved(policy);
    expect(
      (await policy.evaluate(request("send", { now: new Date(now.getTime() + 1000) }))).reason,
    ).toBe("unknown");
    await policy.markUnknown(item);
    await expect(policy.release(item)).rejects.toBeInstanceOf(ContactPolicyConflictProblem);
    expect((await policy.reserve(request("other"))).decision.reason).toBe("limit");
    expect((await policy.reserve(request())).decision.reason).toBe("unknown");
    await policy.commit(item, ["execution"]);
    expect((await policy.reserve(request())).reservation?.executionIds).toEqual(["execution"]);
    await expect(policy.commit(item, ["changed"])).rejects.toBeInstanceOf(
      ContactPolicyConflictProblem,
    );
  });
  it("reports a next eligible instant satisfying every rule and future quiet hours", async () => {
    const { store, policy } = setup({
      rules: [
        { id: "hourly", limit: 1, windowMs: 3600000 },
        { id: "daily", limit: 1, windowMs: 86400000 },
      ],
    });
    await reserved(policy);
    const decision = await policy.evaluate(
      request("next", { now: new Date(now.getTime() + 60000) }),
    );
    expect(decision.blockingRuleId).toBe("hourly");
    expect(decision.nextEligibleAt?.toISOString()).toBe("2026-09-30T00:00:00.000Z");
    expect((await policy.evaluate(request("next", { now: decision.nextEligibleAt }))).allowed).toBe(
      true,
    );
    const revised = new ContactPolicy({
      store,
      config: {
        ...config,
        quietHours: { startMinute: 0, endMinute: 120, timezone: "UTC" },
      },
      topics,
    });
    const quiet = await revised.evaluate(request("next", { now: new Date(now.getTime() + 60000) }));
    expect(quiet.nextEligibleAt?.toISOString()).toBe("2026-09-30T02:00:00.000Z");
    expect((await revised.evaluate(request("next", { now: quiet.nextEligibleAt }))).allowed).toBe(
      true,
    );
  });
  it("omits next eligibility when any applicable rule permanently blocks sends", async () => {
    const { policy } = setup({
      rules: [{ id: "disabled", limit: 0, windowMs: 86400000 }],
      quietHours: { startMinute: 0, endMinute: 120, timezone: "UTC" },
    });
    expect((await policy.evaluate(request())).nextEligibleAt).toBeUndefined();
  });
  it("releases definite pre-dispatch failure without permitting the same logical send again", async () => {
    const { policy } = setup();
    const item = await reserved(policy);
    await policy.release(item);
    expect((await policy.reserve(request())).decision.reason).toBe("released");
    expect((await policy.reserve(request("new"))).decision.allowed).toBe(true);
  });
  it("enforces quiet hours in the configured timezone and minimum spacing", async () => {
    const { policy } = setup({
      quietHours: { startMinute: 22 * 60, endMinute: 9 * 60, timezone: "Asia/Seoul" },
    });
    const blocked = await policy.evaluate(
      request("quiet", { now: new Date("2026-09-28T23:59:59Z") }),
    );
    expect(blocked.reason).toBe("quiet-hours");
    expect(blocked.nextEligibleAt?.toISOString()).toBe("2026-09-29T00:00:00.000Z");
    expect((await policy.evaluate(request())).allowed).toBe(true);
    const spacing = setup({
      rules: [{ id: "spacing", limit: 10, windowMs: 86400000, minimumSpacingMs: 60000 }],
    }).policy;
    await reserved(spacing);
    expect((await spacing.evaluate(request("later"))).reason).toBe("spacing");
    expect(
      (await spacing.evaluate(request("later", { now: new Date(now.getTime() + 60000) }))).allowed,
    ).toBe(true);
  });
  it("retains revision of replays while applying new policy to new reservations", async () => {
    const { store, policy } = setup();
    await reserved(policy);
    const revised = new ContactPolicy({
      store,
      config: { ...config, version: "2", rules: [] },
      topics,
    });
    expect((await revised.reserve(request())).reservation?.policyVersion).toBe("1");
    expect((await revised.reserve(request("new"))).reservation?.policyVersion).toBe("2");
  });
  it("rejects forged security topics and unverified shared endpoints", async () => {
    const { policy } = setup();
    await expect(policy.reserve(request("forged", { topic: "security" }))).rejects.toBeInstanceOf(
      ContactPolicyInvalidProblem,
    );
    await expect(
      policy.reserve(request("group", { endpointGroupId: "same-phone" })),
    ).rejects.toBeInstanceOf(ContactPolicyInvalidProblem);
    await reserved(policy);
    expect(
      (
        await policy.reserve(
          request("security", { topic: "security", messageId: "security-message" }),
        )
      ).decision.allowed,
    ).toBe(true);
  });
  it("shares quota only through a verified endpoint mapping and rejects missing tenant scope", async () => {
    const store = new InMemoryContactPolicyStore();
    const policy = new ContactPolicy({
      store,
      config,
      topics,
      verifyEndpointGroup: async (input) => input.endpointGroupId === "verified-group",
    });
    await policy.reserve(request("first", { endpointGroupId: "verified-group" }));
    expect(
      (
        await policy.reserve(
          request("second", { recipient: "another-account", endpointGroupId: "verified-group" }),
        )
      ).decision.allowed,
    ).toBe(false);
    expect(
      (await policy.reserve(request("third", { recipient: "another-account" }))).decision.allowed,
    ).toBe(true);
    await expect(
      policy.evaluate(request("invalid", { scope: { ...scope, tenantId: "" } })),
    ).rejects.toBeInstanceOf(ContactPolicyInvalidProblem);
  });
  it("uses topic priority then stable logical send ID within a submitted batch", async () => {
    const store = new InMemoryContactPolicyStore();
    const policy = new ContactPolicy({
      store,
      config,
      topics: [
        ...topics,
        { id: "urgent", kind: "marketing", priority: 10, messageIds: ["message"] },
      ],
    });
    const results = await policy.reserveBatch([
      request("z"),
      request("b", { topic: "urgent" }),
      request("a", { topic: "urgent" }),
    ]);
    expect(results.map((result) => result.decision.allowed)).toEqual([false, false, true]);
  });
  it("reports the first rolling expiry that puts usage below the limit", async () => {
    const { store, policy } = setup({ rules: [{ id: "window", limit: 3, windowMs: 10000 }] });
    await policy.reserve(request("a"));
    await policy.reserve(request("b", { now: new Date(now.getTime() + 1000) }));
    await policy.reserve(request("c", { now: new Date(now.getTime() + 2000) }));
    expect(
      (
        await policy.evaluate(request("d", { now: new Date(now.getTime() + 3000) }))
      ).nextEligibleAt?.getTime(),
    ).toBe(now.getTime() + 10000);
    const revised = new ContactPolicy({
      store,
      config: { ...config, rules: [{ id: "window", limit: 2, windowMs: 10000 }] },
      topics,
    });
    expect(
      (
        await revised.evaluate(request("d", { now: new Date(now.getTime() + 3000) }))
      ).nextEligibleAt?.getTime(),
    ).toBe(now.getTime() + 11000);
    const zero = new ContactPolicy({
      store,
      config: { ...config, rules: [{ id: "zero", limit: 0, windowMs: 10000 }] },
      topics,
    });
    expect((await zero.evaluate(request("d"))).nextEligibleAt).toBeUndefined();
  });
  it("requires external evidence to reconcile unknown non-acceptance and releases only explicitly", async () => {
    const { policy, store } = setup();
    const item = await reserved(policy);
    await policy.markUnknown(item);
    const resolution = {
      outcome: "not-accepted",
      evidence: {
        reference: "provider-check-42",
        actor: "operator-7",
        reason: "Provider ledger confirms no acceptance",
      },
    } as const;
    await expect(
      policy.reconcile(item, {
        ...resolution,
        evidence: { ...resolution.evidence, reference: "" },
      }),
    ).rejects.toBeInstanceOf(ContactPolicyInvalidProblem);
    expect((await store.read(scope, item.subject))[0]?.state).toBe("unknown");
    await expect(policy.release(item)).rejects.toBeInstanceOf(ContactPolicyConflictProblem);
    expect((await policy.reconcile(item, resolution)).state).toBe("released");
    expect((await policy.reconcile(item, resolution)).reconciliation).toEqual(resolution);
    expect(
      (
        await policy.reconcile(item, {
          evidence: {
            reason: resolution.evidence.reason,
            actor: resolution.evidence.actor,
            reference: resolution.evidence.reference,
          },
          outcome: "not-accepted",
        })
      ).state,
    ).toBe("released");
    expect((await policy.reserve(request("new"))).decision.allowed).toBe(true);
    await expect(
      policy.reconcile(item, {
        outcome: "accepted",
        executionIds: ["id"],
        evidence: resolution.evidence,
      }),
    ).rejects.toBeInstanceOf(ContactPolicyConflictProblem);
  });
  it("records evidence and execution IDs when reconciliation proves acceptance", async () => {
    const { policy } = setup();
    const item = await reserved(policy);
    await policy.markUnknown(item);
    const resolution = {
      outcome: "accepted",
      executionIds: ["provider-execution"],
      evidence: { reference: "proof", actor: "operator", reason: "Provider confirmed receipt" },
    } as const;
    expect((await policy.reconcile(item, resolution)).state).toBe("committed");
    expect((await policy.reserve(request())).reservation?.executionIds).toEqual([
      "provider-execution",
    ]);
  });
  it("rolls back a failed transaction", async () => {
    const { store, policy } = setup();
    const item = await reserved(policy);
    await expect(
      store.transact(scope, item.subject, async (tx) => {
        tx.save({ ...item, state: "released" });
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
    expect((await store.read(scope, item.subject))[0]?.state).toBe("reserved");
  });
});

const message = defineMessage({
  id: "message",
  topic: "marketing",
  data: z.object({ value: z.string().optional() }),
  channels: ["email"],
});
const recipient = { tenantId: "tenant", userId: "recipient" };
function serviceFixture(
  options: { failProvider?: boolean; deny?: boolean; failCommit?: boolean; dynamic?: boolean } = {},
) {
  const { store, policy } = setup();
  let currentPolicy = policy;
  const dispatches = new InMemoryEngagementStore();
  const dispatch = vi.fn(async () => {
    if (options.failProvider) throw new Error("acceptance unknown");
    return { executionId: "execution" };
  });
  const renderer: EngagementMessageRenderer = {
    async render() {
      return { subject: "subject", html: "body", text: "body" } as never;
    },
  };
  if (options.failCommit)
    vi.spyOn(policy, "commit").mockRejectedValue(new Error("database unavailable"));
  const service = new EngagementService(
    new InMemoryRecipientDirectory([
      {
        recipient,
        emails: [
          { id: "e1", address: "a@example.com" },
          { id: "e2", address: "b@example.com" },
        ],
        push: [],
      },
    ]),
    renderer,
    {
      prepareDispatch() {
        return { dispatch };
      },
    },
    {
      async evaluate() {
        return { suppressed: options.deny === true, kind: "preference" };
      },
    },
    dispatches,
    () => now,
    {
      ...(options.dynamic ? { resolvePolicy: async () => currentPolicy } : { policy }),
      app: "app",
      environment: "test",
      fingerprint: (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex"),
    },
  );
  return {
    store,
    policy,
    service,
    dispatch,
    dispatches,
    setConfig(next: ContactPolicyConfig) {
      currentPolicy = new ContactPolicy({ store, config: next, topics });
    },
  };
}
describe("EngagementService contact policy gate", () => {
  it("records unknown provider acceptance as non-retryable before campaign error handling", async () => {
    const { service, dispatches } = serviceFixture({ failProvider: true });
    await expect(
      service.send(message, { recipient, data: {}, key: "unknown" }),
    ).rejects.toMatchObject({
      extensions: {
        retryable: false,
        causeCode: "engagement-core/contact-policy-acceptance-unknown",
      },
    });
    const failed = await dispatches.findByIdentity({
      tenantId: "tenant",
      recipientId: "recipient",
      messageId: "message",
      channel: "email",
      semanticKey: "unknown",
    });
    expect(failed?.outcome).toMatchObject({
      kind: "failed",
      failureCode: "engagement-core/contact-policy-acceptance-unknown",
      retryable: false,
    });
  });

  it("records the denied campaign and the other campaign that consumed its budget", async () => {
    const { service, dispatches, store } = serviceFixture();
    await service.send(message, { recipient, data: {}, key: "first", campaignId: "campaign-a" });
    const result = await service.send(message, {
      recipient,
      data: {},
      key: "second",
      campaignId: "campaign-b",
    });
    expect(result.channelResults[0]).toMatchObject({
      contactPolicyDecision: { reason: "limit", blockingCampaignIds: ["campaign-a"] },
    });
    expect((await store.read(scope, "recipient:recipient"))[0]?.campaignId).toBe("campaign-a");
    const denied = await dispatches.findByIdentity({
      tenantId: "tenant",
      recipientId: "recipient",
      messageId: "message",
      channel: "email",
      semanticKey: "second",
    });
    expect(denied?.outcome).toMatchObject({
      contactPolicy: { campaignId: "campaign-b", blockingCampaignIds: ["campaign-a"] },
    });
    await expect(
      service.send(message, { recipient, data: {}, key: "first", campaignId: "campaign-c" }),
    ).rejects.toBeInstanceOf(ContactPolicyConflictProblem);
  });

  it("resolves edited settings for new sends and retains the revision of existing reservations", async () => {
    const { service, store, setConfig } = serviceFixture({ dynamic: true });
    await service.send(message, { recipient, data: {}, key: "first" });
    setConfig({ ...config, version: "2", rules: [{ id: "daily", limit: 2, windowMs: 86400000 }] });
    expect((await service.send(message, { recipient, data: {}, key: "second" })).status).toBe(
      "queued",
    );
    expect((await service.send(message, { recipient, data: {}, key: "first" })).status).toBe(
      "queued",
    );
    expect(
      (await store.read(scope, "recipient:recipient")).map((item) => item.policyVersion),
    ).toEqual(["1", "2"]);
  });
  it("persists a scoped explanation for policy suppression", async () => {
    const { service, dispatches } = serviceFixture();
    await service.send(message, { recipient, data: {}, key: "first" });
    const result = await service.send(message, { recipient, data: {}, key: "second" });
    expect(result.channelResults[0]).toMatchObject({
      contactPolicyDecision: { reason: "limit", blockingRuleId: "daily" },
    });
    const saved = await dispatches.findByIdentity({
      tenantId: "tenant",
      recipientId: "recipient",
      messageId: "message",
      channel: "email",
      semanticKey: "second",
    });
    expect(saved?.outcome).toMatchObject({
      contactPolicy: {
        app: "app",
        environment: "test",
        reason: "limit",
        blockingRuleId: "daily",
        nextEligibleAt: "2026-09-30T00:00:00.000Z",
      },
    });
  });

  it("rejects changed parsed data on replay even when the dispatch store has a completed result", async () => {
    const { service, dispatch } = serviceFixture();
    await service.send(message, { recipient, data: { value: "first" }, key: "key" });
    await expect(
      service.send(message, { recipient, data: { value: "second" }, key: "key" }),
    ).rejects.toBeInstanceOf(ContactPolicyConflictProblem);
    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  it("charges once per logical channel across endpoints and replays without provider calls", async () => {
    const { service, dispatch, store } = serviceFixture();
    expect((await service.send(message, { recipient, data: {}, key: "key" })).status).toBe(
      "queued",
    );
    expect((await service.send(message, { recipient, data: {}, key: "key" })).status).toBe(
      "queued",
    );
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(await store.read(scope, "recipient:recipient")).toHaveLength(1);
    expect((await service.send(message, { recipient, data: {}, key: "other" })).status).toBe(
      "suppressed",
    );
  });
  it.each([{ failProvider: true }, { failCommit: true }])(
    "preserves unknown and prevents resends after %j",
    async (options) => {
      const { service, dispatch, store } = serviceFixture(options);
      await expect(service.send(message, { recipient, data: {}, key: "key" })).rejects.toThrow();
      const calls = dispatch.mock.calls.length;
      expect((await store.read(scope, "recipient:recipient"))[0]?.state).toBe("unknown");
      await expect(
        service.send(message, { recipient, data: {}, key: "key" }),
      ).rejects.toBeInstanceOf(ContactPolicyConflictProblem);
      expect(dispatch).toHaveBeenCalledTimes(calls);
    },
  );
  it("applies preference denial before reserving quota", async () => {
    const { service, dispatch, store } = serviceFixture({ deny: true });
    expect((await service.send(message, { recipient, data: {}, key: "key" })).status).toBe(
      "suppressed",
    );
    expect(dispatch).not.toHaveBeenCalled();
    expect(await store.read(scope, "recipient:recipient")).toEqual([]);
  });
});
