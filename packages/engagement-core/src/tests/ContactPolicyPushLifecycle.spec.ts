import { createHash } from "node:crypto";
import { NotificationPreferenceDeniedProblem } from "@croco/notifications-core";
import { Problem, ProblemCategory } from "@croco/problems-core";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  ContactPolicy,
  ContactPolicyConflictProblem,
  EngagementDeliveryEventProcessor,
  EngagementService,
  InMemoryContactPolicyStore,
  InMemoryEngagementStore,
  InMemoryRecipientDirectory,
  StoreBackedRecipientDirectory,
  defineMessage,
  type EngagementMessageRenderer,
  type EngagementNotificationDispatcher,
} from "../index";

const now = new Date("2026-09-29T00:00:00Z");
const recipient = { tenantId: "tenant", userId: "recipient" };
const scope = { app: "app", environment: "test", tenantId: recipient.tenantId };
const message = defineMessage({
  id: "policy-push",
  topic: "marketing",
  data: z.object({ value: z.string() }),
  channels: ["push"],
});
const command = {
  recipient,
  data: { value: "original" },
  key: "logical-send",
  campaignId: "campaign-a",
};
const accepted = {
  executionId: "execution-accepted",
  providerName: "fcm",
  providerMessageId: "projects/project/messages/accepted",
};
const unknownFailure = {
  kind: "failed",
  failureCode: "engagement-core/contact-policy-acceptance-unknown",
  retryable: false,
};

// Matches the provider Problem boundary used by the existing durable push tests.
class UnregisteredTokenProblem extends Problem {
  constructor() {
    super(
      "notifications-fcm/token-unregistered",
      ProblemCategory.ValidationError,
      "Token unregistered",
      {
        extensions: { provider: "fcm", endpointInvalid: true, retryable: false },
      },
    );
  }
}

async function fixture(endpointCount = 1) {
  const store = new InMemoryEngagementStore(undefined, () => now);
  for (let index = 1; index <= endpointCount; index += 1) {
    await store.saveEndpoint({
      id: `device-${index}`,
      tenantId: recipient.tenantId,
      recipientId: recipient.userId,
      kind: "push",
      provider: "fcm",
      app: scope.app,
      platform: "android",
      environment: scope.environment,
      tokenReference: `vault:device-${index}`,
      lastSeenAt: now,
    });
  }
  const policyStore = new InMemoryContactPolicyStore();
  const policy = new ContactPolicy({
    store: policyStore,
    config: {
      version: "1",
      rules: [{ id: "daily", limit: 1, windowMs: 86400000 }],
      reservationTtlMs: 1000,
    },
    topics: [{ id: "marketing", kind: "marketing", priority: 1, messageIds: [message.id] }],
  });
  const dispatch = vi.fn(async () => accepted);
  const renderer: EngagementMessageRenderer = {
    async render() {
      return { title: "Title", body: "Body" } as never;
    },
  };
  const notifications: EngagementNotificationDispatcher = { prepareDispatch: () => ({ dispatch }) };
  const suppression = {
    evaluate: vi.fn(async () => ({ suppressed: false, kind: "preference" as const })),
  };
  const processor = new EngagementDeliveryEventProcessor(store);
  const createService = (currentStore = store, currentProcessor = processor) =>
    new EngagementService(
      new StoreBackedRecipientDirectory(
        new InMemoryRecipientDirectory([{ recipient, push: [] }]),
        currentStore,
      ),
      renderer,
      notifications,
      suppression,
      currentStore,
      () => now,
      {
        policy,
        app: scope.app,
        environment: scope.environment,
        fingerprint: (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex"),
      },
      currentProcessor,
    );
  const savedDispatch = () =>
    store.findByIdentity({
      tenantId: recipient.tenantId,
      recipientId: recipient.userId,
      messageId: message.id,
      channel: "push",
      semanticKey: command.key,
    });
  const events = async () => {
    const saved = await savedDispatch();
    expect(saved).toBeDefined();
    return store.listByDispatch(recipient.tenantId, saved?.id ?? "");
  };
  const replay = () => {
    const reopened = store.reopen();
    return createService(reopened, new EngagementDeliveryEventProcessor(reopened)).send(
      message,
      command,
    );
  };
  return {
    renderer,
    notifications,
    suppression,
    store,
    policyStore,
    policy,
    dispatch,
    processor,
    createService,
    savedDispatch,
    events,
    replay,
  };
}

describe("contact policy with durable push delivery", () => {
  it("repairs interrupted accepted events from a committed reservation without resending", async () => {
    const test = await fixture();
    vi.spyOn(test.processor, "process").mockRejectedValueOnce(new Error("event store unavailable"));
    await expect(test.createService().send(message, command)).rejects.toThrow(
      "event store unavailable",
    );
    expect(await test.events()).toEqual([]);
    expect((await test.policyStore.read(scope, "recipient:recipient"))[0]?.state).toBe("committed");
    await expect(test.replay()).resolves.toMatchObject({ status: "queued" });
    await test.replay();
    expect(await test.events()).toMatchObject([
      { type: "accepted", provider: "fcm", endpointId: "device-1" },
    ]);
    expect(await test.events()).toHaveLength(1);
    expect(test.dispatch).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["data", "committed"],
    ["campaignId", "committed"],
    ["data", "unknown"],
    ["campaignId", "unknown"],
  ] as const)("rejects changed %s before repairing a %s replay", async (field, state) => {
    const test = await fixture();
    if (state === "unknown") test.dispatch.mockRejectedValueOnce(new UnregisteredTokenProblem());
    vi.spyOn(test.processor, "process").mockRejectedValueOnce(new Error("event store unavailable"));
    await expect(test.createService().send(message, command)).rejects.toThrow();
    const changed =
      field === "data"
        ? { ...command, data: { value: "changed" } }
        : { ...command, campaignId: "campaign-b" };
    await expect(test.createService().send(message, changed)).rejects.toBeInstanceOf(
      ContactPolicyConflictProblem,
    );
    expect(await test.events()).toEqual([]);
    expect(test.dispatch).toHaveBeenCalledTimes(1);
  });

  it("preserves the terminal provider code and invalidates the endpoint under policy unknown acceptance", async () => {
    const test = await fixture();
    test.dispatch.mockRejectedValueOnce(new UnregisteredTokenProblem());
    await expect(test.createService().send(message, command)).rejects.toThrow();
    expect((await test.savedDispatch())?.outcome).toMatchObject(unknownFailure);
    expect(await test.events()).toMatchObject([
      {
        type: "token-invalid",
        provider: "fcm",
        endpointId: "device-1",
        evidence: { providerCode: "notifications-fcm:token-unregistered" },
      },
    ]);
    expect((await test.store.getEndpoint(recipient.tenantId, "device-1"))?.invalidationReason).toBe(
      "token-invalid",
    );
    await expect(test.replay()).rejects.toBeInstanceOf(ContactPolicyConflictProblem);
    expect((await test.savedDispatch())?.outcome).toMatchObject(unknownFailure);
    expect(test.dispatch).toHaveBeenCalledTimes(1);
  });

  it("repairs interrupted terminal events before rejecting an unknown reservation replay", async () => {
    const test = await fixture();
    test.dispatch.mockRejectedValueOnce(new UnregisteredTokenProblem());
    vi.spyOn(test.processor, "process").mockRejectedValueOnce(new Error("event store unavailable"));
    await expect(test.createService().send(message, command)).rejects.toThrow();
    expect(await test.events()).toEqual([]);
    expect(
      (await test.store.getEndpoint(recipient.tenantId, "device-1"))?.invalidatedAt,
    ).toBeUndefined();
    await expect(test.replay()).rejects.toBeInstanceOf(ContactPolicyConflictProblem);
    expect((await test.store.getEndpoint(recipient.tenantId, "device-1"))?.invalidationReason).toBe(
      "token-invalid",
    );
    expect(await test.events()).toMatchObject([
      { type: "token-invalid", evidence: { providerCode: "notifications-fcm:token-unregistered" } },
    ]);
    expect(test.dispatch).toHaveBeenCalledTimes(1);
  });

  it("retains accepted targets alongside a later terminal failure", async () => {
    const test = await fixture(2);
    test.dispatch
      .mockResolvedValueOnce(accepted)
      .mockRejectedValueOnce(new UnregisteredTokenProblem());
    await expect(test.createService().send(message, command)).rejects.toThrow();
    expect((await test.savedDispatch())?.outcome).toMatchObject({
      ...unknownFailure,
      executionIds: [accepted.executionId],
    });
    expect((await test.savedDispatch())?.targets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          endpointId: "device-1",
          executionId: accepted.executionId,
          provider: "fcm",
          providerMessageId: accepted.providerMessageId,
        }),
      ]),
    );
    expect(
      [...(await test.events())].sort((left, right) =>
        left.endpointId.localeCompare(right.endpointId),
      ),
    ).toMatchObject([
      { type: "accepted", endpointId: "device-1", provider: "fcm" },
      {
        type: "token-invalid",
        endpointId: "device-2",
        evidence: { providerCode: "notifications-fcm:token-unregistered" },
      },
    ]);
    await expect(test.replay()).rejects.toBeInstanceOf(ContactPolicyConflictProblem);
    expect(test.dispatch).toHaveBeenCalledTimes(2);
  });

  it("retains accepted provider metadata when committing contact quota fails", async () => {
    const test = await fixture();
    vi.spyOn(test.policy, "commit").mockRejectedValueOnce(new Error("policy store unavailable"));
    await expect(test.createService().send(message, command)).rejects.toMatchObject({
      code: unknownFailure.failureCode,
    });
    expect((await test.savedDispatch())?.outcome).toMatchObject({
      ...unknownFailure,
      stage: "persistence",
      executionIds: [accepted.executionId],
    });
    expect((await test.savedDispatch())?.targets).toMatchObject([
      {
        endpointId: "device-1",
        executionId: accepted.executionId,
        provider: "fcm",
        providerMessageId: accepted.providerMessageId,
      },
    ]);
    expect((await test.policyStore.read(scope, "recipient:recipient"))[0]?.state).toBe("unknown");
    expect(await test.events()).toMatchObject([{ type: "accepted", provider: "fcm" }]);
    await expect(test.replay()).rejects.toBeInstanceOf(ContactPolicyConflictProblem);
    expect((await test.savedDispatch())?.outcome).toMatchObject(unknownFailure);
    expect(test.dispatch).toHaveBeenCalledTimes(1);
  });

  it("repairs accepted events after both policy commit and event persistence fail", async () => {
    const test = await fixture();
    vi.spyOn(test.policy, "commit").mockRejectedValueOnce(new Error("policy store unavailable"));
    vi.spyOn(test.processor, "process").mockRejectedValueOnce(new Error("event store unavailable"));
    await expect(test.createService().send(message, command)).rejects.toMatchObject({
      code: unknownFailure.failureCode,
      extensions: { retryable: false },
    });
    expect(await test.events()).toEqual([]);
    expect((await test.savedDispatch())?.outcome).toMatchObject(unknownFailure);
    await expect(test.replay()).rejects.toBeInstanceOf(ContactPolicyConflictProblem);
    expect(await test.events()).toMatchObject([{ type: "accepted", provider: "fcm" }]);
    expect(test.dispatch).toHaveBeenCalledTimes(1);
  });

  it.each(
    (["committed", "unknown"] as const).flatMap((state) =>
      (["first-reachable", "all-reachable"] as const).flatMap((sendPolicy) =>
        (["no-endpoint", "preference", "suppression", "preparation", "render"] as const).map(
          (change) => ({ state, sendPolicy, change }),
        ),
      ),
    ),
  )(
    "preserves $state evidence when $change prevents a $sendPolicy replay",
    async ({ state, sendPolicy, change }) => {
      const test = await fixture();
      const input = { ...command, policy: sendPolicy };
      if (state === "unknown") {
        vi.spyOn(test.policy, "commit").mockRejectedValueOnce(
          new Error("policy store unavailable"),
        );
        await expect(test.createService().send(message, input)).rejects.toMatchObject({
          code: unknownFailure.failureCode,
        });
      } else {
        await test.createService().send(message, input);
      }
      const original = await test.savedDispatch();
      const originalEvents = await test.events();
      switch (change) {
        case "no-endpoint":
          await test.store.invalidateEndpoint({
            tenantId: recipient.tenantId,
            endpointId: "device-1",
            expectedVersion: 1,
            reason: "token-invalid",
            invalidatedAt: now,
          });
          break;
        case "preference":
          vi.spyOn(test.notifications, "prepareDispatch").mockImplementation(
            (_channel, options) => {
              throw new NotificationPreferenceDeniedProblem({
                context: options.preferenceContext,
                reason: "user-opted-out",
                evaluationKey: "denied",
              });
            },
          );
          break;
        case "suppression":
          test.suppression.evaluate.mockResolvedValue({ suppressed: true, kind: "preference" });
          break;
        case "preparation":
          vi.spyOn(test.notifications, "prepareDispatch").mockImplementation(() => {
            throw new Error("preparation unavailable");
          });
          break;
        case "render":
          vi.spyOn(test.renderer, "render").mockRejectedValue(new Error("render unavailable"));
          break;
      }
      await expect(test.createService().send(message, input)).rejects.toBeInstanceOf(
        ContactPolicyConflictProblem,
      );
      expect(await test.savedDispatch()).toEqual(original);
      expect(await test.events()).toEqual(originalEvents);
      expect(test.dispatch).toHaveBeenCalledTimes(1);
    },
  );

  it("reports unresolved acceptance when a committed reservation has no durable dispatch", async () => {
    const test = await fixture();
    vi.spyOn(test.store, "recordDispatch").mockRejectedValueOnce(
      new Error("dispatch store unavailable"),
    );
    await expect(test.createService().send(message, command)).rejects.toThrow();
    expect((await test.policyStore.read(scope, "recipient:recipient"))[0]?.state).toBe("committed");
    expect(await test.savedDispatch()).toBeUndefined();
    await expect(test.replay()).rejects.toMatchObject({
      code: unknownFailure.failureCode,
      extensions: { retryable: false },
    });
    expect(test.dispatch).toHaveBeenCalledTimes(1);
    expect(await test.savedDispatch()).toBeUndefined();
  });

  it("preserves acceptance written after a concurrent eligibility guard observed no dispatch", async () => {
    const test = await fixture();
    let announceRead = () => {};
    const readObserved = new Promise<void>((resolve) => {
      announceRead = resolve;
    });
    let releaseRead = () => {};
    const blockedRead = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });
    vi.spyOn(test.store, "findByIdentity").mockImplementationOnce(async () => {
      announceRead();
      await blockedRead;
      return undefined;
    });
    test.suppression.evaluate.mockResolvedValueOnce({ suppressed: true, kind: "preference" });
    const eligibility = test
      .createService()
      .send(message, command)
      .catch((error: unknown) => error);
    await readObserved;
    vi.spyOn(test.policy, "commit").mockRejectedValueOnce(new Error("policy commit unavailable"));
    await expect(test.createService().send(message, command)).rejects.toMatchObject({
      code: unknownFailure.failureCode,
    });
    const acceptedDispatch = await test.savedDispatch();
    expect(acceptedDispatch?.targets).toMatchObject([
      { executionId: accepted.executionId, providerMessageId: accepted.providerMessageId },
    ]);
    releaseRead();
    expect(await eligibility).toBeInstanceOf(ContactPolicyConflictProblem);
    expect(await test.savedDispatch()).toEqual(acceptedDispatch);
    expect(test.dispatch).toHaveBeenCalledTimes(1);
  });
});
