import { describe, expect, it, vi } from "vitest";
import {
  classifyOutboundWebhookOutcome,
  createOutboundWebhookUrlPolicy,
  createOutboundWebhookStoreConformanceSuite,
  defaultOutboundWebhookUrlPolicy,
  FakeOutboundWebhookTransport,
  InMemoryOutboundWebhookEndpointStore,
  InMemoryOutboundWebhookSecretStore,
  InMemoryOutboundWebhookStore,
  InvalidOutboundWebhookSecretVersionProblem,
  InvalidOutboundWebhookUrlProblem,
  type OutboundWebhookAttemptOutcome,
  OutboundWebhookConfigurationProblem,
  type OutboundWebhookEndpoint,
  type OutboundWebhookEventDescriptor,
  OutboundWebhookPermanentProblem,
  OutboundWebhookReplayNotAllowedProblem,
  OutboundWebhookRetryableProblem,
  OutboundWebhookRuntime,
  type OutboundWebhookSecret,
  type OutboundWebhookTaskPublisher,
  type OutboundWebhookTransport,
  signOutboundWebhook,
  verifyOutboundWebhookSignature,
} from "../index";

const START = new Date("2026-07-26T00:00:00.000Z");

const ACTIVE_ENDPOINT: OutboundWebhookEndpoint = {
  id: "endpoint_1",
  tenantId: "tenant_1",
  url: "https://hooks.customer.example/croco",
  subscribedEventNames: ["invoice.paid"],
  status: "active",
  signingAlgorithm: "hmac-sha256",
  activeSecretVersion: "v2",
  previousSecretVersion: "v1",
  previousSecretValidUntil: new Date("2026-07-27T00:00:00.000Z"),
  metadata: { environment: "test" },
};

const ACTIVE_SECRET: OutboundWebhookSecret = {
  tenantId: ACTIVE_ENDPOINT.tenantId,
  endpointId: ACTIVE_ENDPOINT.id,
  version: "v2",
  material: new TextEncoder().encode("active-secret-material"),
};

const PREVIOUS_SECRET: OutboundWebhookSecret = {
  tenantId: ACTIVE_ENDPOINT.tenantId,
  endpointId: ACTIVE_ENDPOINT.id,
  version: "v1",
  material: new TextEncoder().encode("previous-secret-material"),
};

const EVENT: OutboundWebhookEventDescriptor<{ invoiceId: string }> = {
  id: "event_1",
  name: "invoice.paid",
  schemaVersion: "2026-07-01",
  subject: "invoice/inv_1",
  tenantId: "tenant_1",
  occurredAt: new Date("2026-07-25T23:59:00.000Z"),
  payload: { invoiceId: "inv_1" },
};

describe("OutboundWebhookRuntime", () => {
  it("commits durable intent evidence before surfacing a retryable publication failure", async () => {
    const store = new InMemoryOutboundWebhookStore();
    const publisher: OutboundWebhookTaskPublisher = {
      publish: vi.fn(async () => {
        throw new Error("task broker unavailable");
      }),
    };
    const runtime = createRuntime({ store, publisher });

    await expect(runtime.publish(EVENT)).rejects.toBeInstanceOf(OutboundWebhookRetryableProblem);
    expect(await store.getEvent(EVENT.tenantId, EVENT.id)).toBeDefined();
    expect(await store.listDeliveries(EVENT.tenantId, EVENT.id)).toHaveLength(1);
    expect(await store.listUnpublishedIntents(EVENT.tenantId)).toHaveLength(1);
  });

  it("continues after retryable intent publication failures and marks each published intent once", async () => {
    const store = new InMemoryOutboundWebhookStore();
    const secondEndpoint = { ...ACTIVE_ENDPOINT, id: "endpoint_2" };
    const committed = await store.commitEvent({
      event: {
        ...EVENT,
        payloadBytes: new TextEncoder().encode("{}"),
        committedAt: START,
      },
      endpoints: [ACTIVE_ENDPOINT, secondEndpoint],
    });
    const [firstIntent, secondIntent] = committed.intents;
    expect(firstIntent).toBeDefined();
    expect(secondIntent).toBeDefined();
    let firstAttempt = true;
    const publisher: OutboundWebhookTaskPublisher = {
      publish: vi.fn(async ({ deliveryId }) => {
        if (deliveryId === firstIntent?.deliveryId && firstAttempt) {
          firstAttempt = false;
          throw new Error("task broker unavailable");
        }
      }),
    };
    const runtime = createRuntime({ store, publisher });
    const markIntentPublished = vi.spyOn(store, "markIntentPublished");

    const firstOutcome = await runtime.publishUnpublishedIntents(EVENT.tenantId);

    expect(firstOutcome.publishedIntentIds).toEqual([secondIntent?.id]);
    expect(firstOutcome.failures).toHaveLength(1);
    expect(firstOutcome.failures[0]).toMatchObject({
      intentId: firstIntent?.id,
      deliveryId: firstIntent?.deliveryId,
      classification: "retryable",
    });
    expect(firstOutcome.failures[0]?.problem).toBeInstanceOf(OutboundWebhookRetryableProblem);
    expect(await store.listUnpublishedIntents(EVENT.tenantId)).toEqual([firstIntent]);

    const retryOutcome = await runtime.publishUnpublishedIntents(EVENT.tenantId);

    expect(retryOutcome).toEqual({ publishedIntentIds: [firstIntent?.id], failures: [] });
    expect(await store.listUnpublishedIntents(EVENT.tenantId)).toHaveLength(0);
    expect(markIntentPublished.mock.calls.map(([, intentId]) => intentId)).toEqual([
      secondIntent?.id,
      firstIntent?.id,
    ]);
    expect(publisher.publish).toHaveBeenCalledTimes(3);
  });

  it("transitions each unpublished intent once across concurrent batch drains", async () => {
    const store = new InMemoryOutboundWebhookStore();
    const committed = await store.commitEvent({
      event: {
        ...EVENT,
        payloadBytes: new TextEncoder().encode("{}"),
        committedAt: START,
      },
      endpoints: [ACTIVE_ENDPOINT],
    });
    const acceptedKeys = new Set<string>();
    const publisher: OutboundWebhookTaskPublisher = {
      publish: vi.fn(async ({ idempotencyKey }) => {
        acceptedKeys.add(idempotencyKey);
      }),
    };
    const runtime = createRuntime({ store, publisher });
    const markIntentPublished = vi.spyOn(store, "markIntentPublished");

    const outcomes = await Promise.all([
      runtime.publishUnpublishedIntents(EVENT.tenantId),
      runtime.publishUnpublishedIntents(EVENT.tenantId),
    ]);

    expect(outcomes.flatMap((outcome) => outcome.publishedIntentIds)).toEqual([
      committed.intents[0]?.id,
    ]);
    expect(publisher.publish).toHaveBeenCalledTimes(2);
    expect(acceptedKeys.size).toBe(1);
    expect(markIntentPublished).toHaveBeenCalledTimes(2);
    expect(await store.listUnpublishedIntents(EVENT.tenantId)).toHaveLength(0);
  });

  it("retries an idempotent publication when its store acknowledgement fails", async () => {
    class AcknowledgementFailureStore extends InMemoryOutboundWebhookStore {
      markAttempts = 0;
      successfulMarks = 0;

      override async markIntentPublished(
        tenantId: string,
        intentId: string,
        publishedAt: Date,
      ): Promise<boolean> {
        this.markAttempts += 1;
        if (this.markAttempts === 1) {
          throw new Error("store unavailable");
        }
        const marked = await super.markIntentPublished(tenantId, intentId, publishedAt);
        if (marked) {
          this.successfulMarks += 1;
        }
        return marked;
      }
    }

    const store = new AcknowledgementFailureStore();
    await store.commitEvent({
      event: {
        ...EVENT,
        payloadBytes: new TextEncoder().encode("{}"),
        committedAt: START,
      },
      endpoints: [ACTIVE_ENDPOINT],
    });
    const acceptedKeys = new Set<string>();
    const publisher: OutboundWebhookTaskPublisher = {
      publish: vi.fn(async ({ idempotencyKey }) => {
        acceptedKeys.add(idempotencyKey);
      }),
    };
    const runtime = createRuntime({ store, publisher });

    await expect(runtime.publishUnpublishedIntents(EVENT.tenantId)).rejects.toBeInstanceOf(
      OutboundWebhookConfigurationProblem,
    );
    expect(await store.listUnpublishedIntents(EVENT.tenantId)).toHaveLength(1);

    await expect(runtime.publishUnpublishedIntents(EVENT.tenantId)).resolves.toMatchObject({
      failures: [],
      publishedIntentIds: [expect.any(String)],
    });
    expect(publisher.publish).toHaveBeenCalledTimes(2);
    expect(acceptedKeys.size).toBe(1);
    expect(store.markAttempts).toBe(2);
    expect(store.successfulMarks).toBe(1);
  });

  it("classifies terminal intent publication failures without suppressing later intents", async () => {
    const store = new InMemoryOutboundWebhookStore();
    const secondEndpoint = { ...ACTIVE_ENDPOINT, id: "endpoint_2" };
    const committed = await store.commitEvent({
      event: {
        ...EVENT,
        payloadBytes: new TextEncoder().encode("{}"),
        committedAt: START,
      },
      endpoints: [ACTIVE_ENDPOINT, secondEndpoint],
    });
    const [firstIntent, secondIntent] = committed.intents;
    const terminalProblem = new OutboundWebhookPermanentProblem(
      firstIntent?.deliveryId ?? "",
      "task contract rejected",
      { payload: "must not escape" },
    );
    const publisher: OutboundWebhookTaskPublisher = {
      publish: vi.fn(async ({ deliveryId }) => {
        if (deliveryId === firstIntent?.deliveryId) {
          throw terminalProblem;
        }
      }),
    };
    const runtime = createRuntime({ store, publisher });

    const outcome = await runtime.publishUnpublishedIntents(EVENT.tenantId);

    expect(outcome.publishedIntentIds).toEqual([secondIntent?.id]);
    expect(outcome.failures).toHaveLength(1);
    expect(outcome.failures[0]).toMatchObject({
      intentId: firstIntent?.id,
      deliveryId: firstIntent?.deliveryId,
      classification: "terminal",
      problem: {
        extensions: {
          intentId: firstIntent?.id,
          deliveryId: firstIntent?.deliveryId,
        },
      },
    });
    expect(outcome.failures[0]?.problem.extensions).not.toHaveProperty("payload");
  });

  it("stops intent publication when shared configuration is unsafe", async () => {
    const store = new InMemoryOutboundWebhookStore();
    await store.commitEvent({
      event: {
        ...EVENT,
        payloadBytes: new TextEncoder().encode("{}"),
        committedAt: START,
      },
      endpoints: [ACTIVE_ENDPOINT, { ...ACTIVE_ENDPOINT, id: "endpoint_2" }],
    });
    const problem = new OutboundWebhookConfigurationProblem("task publisher is misconfigured");
    const publisher: OutboundWebhookTaskPublisher = {
      publish: vi.fn(async () => {
        throw problem;
      }),
    };
    const runtime = createRuntime({ store, publisher });

    await expect(runtime.publishUnpublishedIntents(EVENT.tenantId)).rejects.toBe(problem);
    expect(publisher.publish).toHaveBeenCalledTimes(1);
    expect(await store.listUnpublishedIntents(EVENT.tenantId)).toHaveLength(2);

    vi.mocked(publisher.publish).mockResolvedValue(undefined);
    await expect(runtime.publishUnpublishedIntents(EVENT.tenantId)).resolves.toMatchObject({
      failures: [],
      publishedIntentIds: [expect.any(String), expect.any(String)],
    });
  });

  it("creates one endpoint delivery for repeated logical event publication", async () => {
    const store = new InMemoryOutboundWebhookStore();
    const runtime = createRuntime({ store });

    const first = await runtime.publish(EVENT);
    const duplicate = await runtime.publish(EVENT);

    expect(first.duplicate).toBe(false);
    expect(duplicate.duplicate).toBe(true);
    expect(await store.listDeliveries(EVENT.tenantId, EVENT.id)).toHaveLength(1);
  });

  it("preserves event id and exact payload bytes across retries while recording attempt evidence", async () => {
    const store = new InMemoryOutboundWebhookStore();
    const publisher: OutboundWebhookTaskPublisher = { publish: vi.fn() };
    const transport = new FakeOutboundWebhookTransport([
      { kind: "http", status: 500 },
      { kind: "http", status: 204 },
    ]);
    let now = new Date(START);
    let id = 0;
    const runtime = createRuntime({
      store,
      transport,
      publisher,
      now: () => new Date(now),
      createId: () => `attempt_${++id}`,
    });
    const published = await runtime.publish(EVENT);
    const deliveryId = published.deliveries[0]?.id;
    expect(deliveryId).toBeDefined();

    const retrying = await runtime.dispatch(EVENT.tenantId, deliveryId ?? "");
    now = new Date(START.getTime() + 60_000);
    const delivered = await runtime.dispatch(EVENT.tenantId, deliveryId ?? "");

    expect(retrying.status).toBe("retrying");
    expect(delivered.status).toBe("delivered");
    expect(transport.requests).toHaveLength(2);
    expect(transport.requests[0]?.body).toEqual(transport.requests[1]?.body);
    expect(transport.requests[0]?.headers["webhook-id"]).toBe(EVENT.id);
    expect(transport.requests[1]?.headers["webhook-id"]).toBe(EVENT.id);
    expect(transport.requests[0]?.headers["webhook-signature"]).not.toBe(
      transport.requests[1]?.headers["webhook-signature"],
    );

    const attempts = await store.listAttempts(EVENT.tenantId, deliveryId ?? "");
    expect(attempts.map((attempt) => attempt.id)).toEqual(["attempt_1", "attempt_2"]);
    expect(attempts.map((attempt) => attempt.number)).toEqual([1, 2]);
    expect(publisher.publish).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        deliveryId,
        idempotencyKey: `${deliveryId}:attempt:1`,
        contracts: expect.objectContaining({
          task: expect.objectContaining({ idempotencyKey: `${deliveryId}:attempt:1` }),
          execution: expect.objectContaining({
            idempotencyKey: `${deliveryId}:attempt:1`,
            metadata: {
              deliveryId,
              eventId: EVENT.id,
              tenantId: EVENT.tenantId,
            },
          }),
          outbox: expect.objectContaining({
            idempotencyKey: `${deliveryId}:attempt:1`,
            payload: { deliveryId },
            source: { eventId: EVENT.id },
            tenant: { tenantId: EVENT.tenantId },
          }),
        }),
      }),
    );
    expect(publisher.publish).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        deliveryId,
        idempotencyKey: `${deliveryId}:attempt:2`,
      }),
    );
  });

  it.each([
    [{ kind: "http", status: 200 }, "delivered"],
    [{ kind: "http", status: 202 }, "accepted"],
    [{ kind: "http", status: 400 }, "permanent"],
    [{ kind: "http", status: 404 }, "permanent"],
    [{ kind: "http", status: 429 }, "retryable"],
    [{ kind: "http", status: 500 }, "retryable"],
    [{ kind: "redirect", status: 302, location: "https://169.254.169.254/latest" }, "permanent"],
    [{ kind: "timeout" }, "retryable"],
    [{ kind: "connection-reset" }, "retryable"],
    [
      {
        kind: "acceptance-unknown",
        reason: "connection closed after request bytes",
      },
      "acceptance-unknown",
    ],
  ] satisfies readonly [OutboundWebhookAttemptOutcome, string][])(
    "classifies %j as %s",
    (outcome, expected) => {
      expect(classifyOutboundWebhookOutcome("delivery_1", outcome).policy).toBe(expected);
    },
  );

  it("records HTTP evidence under a non-reserved extension key", () => {
    const result = classifyOutboundWebhookOutcome("delivery_1", { kind: "http", status: 503 });

    expect(result).toMatchObject({
      policy: "retryable",
      problem: { extensions: { upstreamStatus: 503 } },
    });
    if ("problem" in result) {
      expect(result.problem.extensions).not.toHaveProperty("status");
    }
  });

  it("bounds retries and marks the delivery dead at max attempts", async () => {
    const store = new InMemoryOutboundWebhookStore();
    let now = new Date(START);
    const transport = new FakeOutboundWebhookTransport([
      { kind: "timeout" },
      { kind: "connection-reset" },
    ]);
    const runtime = createRuntime({
      store,
      transport,
      retryPolicy: { maxAttempts: 2, backoff: { getDelay: () => 1 } },
      now: () => new Date(now),
    });
    const deliveryId = (await runtime.publish(EVENT)).deliveries[0]?.id ?? "";

    expect((await runtime.dispatch(EVENT.tenantId, deliveryId)).status).toBe("retrying");
    await expect(runtime.dispatch(EVENT.tenantId, deliveryId)).rejects.toBeInstanceOf(
      OutboundWebhookRetryableProblem,
    );
    expect(transport.requests).toHaveLength(1);
    now = new Date(START.getTime() + 1);
    expect((await runtime.dispatch(EVENT.tenantId, deliveryId)).status).toBe("dead");
  });

  it("claims a delivery before transport so concurrent tasks cannot send twice", async () => {
    const store = new InMemoryOutboundWebhookStore();
    let releaseSend: (() => void) | undefined;
    const transport: OutboundWebhookTransport = {
      send: vi.fn(
        () =>
          new Promise<OutboundWebhookAttemptOutcome>((resolve) => {
            releaseSend = () => resolve({ kind: "http", status: 204 });
          }),
      ),
    };
    const runtime = createRuntime({ store, transport });
    const deliveryId = (await runtime.publish(EVENT)).deliveries[0]?.id ?? "";

    const first = runtime.dispatch(EVENT.tenantId, deliveryId);
    await vi.waitFor(() => expect(transport.send).toHaveBeenCalledTimes(1));
    await expect(runtime.dispatch(EVENT.tenantId, deliveryId)).rejects.toBeInstanceOf(
      OutboundWebhookConfigurationProblem,
    );
    releaseSend?.();
    await expect(first).resolves.toMatchObject({ status: "delivered" });
    expect(transport.send).toHaveBeenCalledTimes(1);
  });

  it("allows idempotent replay only from terminal or acceptance-unknown states", async () => {
    const store = new InMemoryOutboundWebhookStore();
    const runtime = createRuntime({
      store,
      transport: new FakeOutboundWebhookTransport([{ kind: "http", status: 400 }]),
    });
    const deliveryId = (await runtime.publish(EVENT)).deliveries[0]?.id ?? "";

    await expect(runtime.replay(EVENT.tenantId, deliveryId, "replay_early")).rejects.toBeInstanceOf(
      OutboundWebhookReplayNotAllowedProblem,
    );
    expect((await runtime.dispatch(EVENT.tenantId, deliveryId)).status).toBe("dead");

    const replay = await runtime.replay(EVENT.tenantId, deliveryId, "operator_1");
    const duplicateReplay = await runtime.replay(EVENT.tenantId, deliveryId, "operator_1");
    expect(replay.id).toBe(duplicateReplay.id);
    expect(replay.eventId).toBe(EVENT.id);
    expect(await store.listDeliveries(EVENT.tenantId, EVENT.id)).toHaveLength(1);
  });

  it("resets the retry budget when replaying a dead delivery", async () => {
    const store = new InMemoryOutboundWebhookStore();
    const publishedKeys: string[] = [];
    const publisher: OutboundWebhookTaskPublisher = {
      publish: vi.fn(async ({ idempotencyKey }) => {
        publishedKeys.push(idempotencyKey);
      }),
    };
    let now = new Date(START);
    const transport = new FakeOutboundWebhookTransport([
      { kind: "http", status: 500 },
      { kind: "http", status: 500 },
      { kind: "http", status: 500 },
      { kind: "http", status: 500 },
      { kind: "http", status: 500 },
      { kind: "http", status: 500 },
    ]);
    const runtime = createRuntime({
      store,
      transport,
      publisher,
      retryPolicy: { maxAttempts: 2, backoff: { getDelay: () => 1 } },
      now: () => new Date(now),
    });
    const deliveryId = (await runtime.publish(EVENT)).deliveries[0]?.id ?? "";

    expect((await runtime.dispatch(EVENT.tenantId, deliveryId)).status).toBe("retrying");
    now = new Date(START.getTime() + 1);
    expect((await runtime.dispatch(EVENT.tenantId, deliveryId)).status).toBe("dead");

    const replay = await runtime.replay(EVENT.tenantId, deliveryId, "operator_1");

    expect(replay).toMatchObject({ status: "pending", attemptCount: 0 });
    expect(await store.listAttempts(EVENT.tenantId, deliveryId)).toHaveLength(2);
    expect(await runtime.dispatch(EVENT.tenantId, deliveryId)).toMatchObject({
      status: "retrying",
      attemptCount: 1,
    });
    now = new Date(START.getTime() + 2);
    expect(await runtime.dispatch(EVENT.tenantId, deliveryId)).toMatchObject({
      status: "dead",
      attemptCount: 2,
    });

    const secondReplay = await runtime.replay(EVENT.tenantId, deliveryId, "operator_22");

    expect(secondReplay).toMatchObject({ status: "pending", attemptCount: 0 });
    expect(await runtime.dispatch(EVENT.tenantId, deliveryId)).toMatchObject({
      status: "retrying",
      attemptCount: 1,
    });
    now = new Date(START.getTime() + 3);
    expect(await runtime.dispatch(EVENT.tenantId, deliveryId)).toMatchObject({
      status: "dead",
      attemptCount: 2,
    });
    expect(
      (await store.listAttempts(EVENT.tenantId, deliveryId)).map((attempt) => attempt.number),
    ).toEqual([1, 2, 1, 2, 1, 2]);
    expect(publishedKeys).toEqual([
      `${deliveryId}:attempt:1`,
      `${deliveryId}:attempt:2`,
      `${deliveryId}:replay:operator_1`,
      `${deliveryId}:replay-attempt:10:operator_1:2`,
      `${deliveryId}:replay:operator_22`,
      `${deliveryId}:replay-attempt:11:operator_22:2`,
    ]);
  });

  it("keeps committed evidence for paused and disabled subscribed endpoints without dispatching", async () => {
    const paused = {
      ...ACTIVE_ENDPOINT,
      id: "paused",
      status: "paused" as const,
    };
    const disabled = {
      ...ACTIVE_ENDPOINT,
      id: "disabled",
      status: "disabled" as const,
    };
    const store = new InMemoryOutboundWebhookStore();
    const publisher: OutboundWebhookTaskPublisher = { publish: vi.fn() };
    const runtime = createRuntime({
      store,
      publisher,
      endpoints: [paused, disabled],
      secrets: [],
    });

    const result = await runtime.publish(EVENT);

    expect(result.deliveries.map((delivery) => delivery.status).sort()).toEqual([
      "canceled",
      "pending",
    ]);
    expect(result.intents).toHaveLength(0);
    expect(publisher.publish).not.toHaveBeenCalled();
    expect(await store.getEvent(EVENT.tenantId, EVENT.id)).toBeDefined();
  });

  it("does not replay a terminal delivery while its endpoint is paused", async () => {
    const store = new InMemoryOutboundWebhookStore();
    const endpointStore = new InMemoryOutboundWebhookEndpointStore([ACTIVE_ENDPOINT]);
    const runtime = new OutboundWebhookRuntime({
      store,
      endpointStore,
      secretStore: new InMemoryOutboundWebhookSecretStore([ACTIVE_SECRET]),
      taskPublisher: { publish: vi.fn() },
      transport: new FakeOutboundWebhookTransport([{ kind: "http", status: 400 }]),
      urlPolicy: publicTestUrlPolicy(),
      now: () => new Date(START),
    });
    const deliveryId = (await runtime.publish(EVENT)).deliveries[0]?.id ?? "";
    await runtime.dispatch(EVENT.tenantId, deliveryId);
    endpointStore.set({ ...ACTIVE_ENDPOINT, status: "paused" });

    await expect(runtime.replay(EVENT.tenantId, deliveryId)).rejects.toBeInstanceOf(
      OutboundWebhookReplayNotAllowedProblem,
    );
    expect(await store.listDeliveries(EVENT.tenantId, EVENT.id)).toHaveLength(1);
  });

  it("resumes committed paused evidence only after the tenant endpoint becomes active", async () => {
    const pausedEndpoint = { ...ACTIVE_ENDPOINT, status: "paused" as const };
    const store = new InMemoryOutboundWebhookStore();
    const endpointStore = new InMemoryOutboundWebhookEndpointStore([pausedEndpoint]);
    const publisher: OutboundWebhookTaskPublisher = { publish: vi.fn() };
    const runtime = new OutboundWebhookRuntime({
      store,
      endpointStore,
      secretStore: new InMemoryOutboundWebhookSecretStore([ACTIVE_SECRET]),
      taskPublisher: publisher,
      transport: new FakeOutboundWebhookTransport([]),
      urlPolicy: publicTestUrlPolicy(),
      now: () => new Date(START),
    });
    const deliveryId = (await runtime.publish(EVENT)).deliveries[0]?.id ?? "";
    expect(publisher.publish).not.toHaveBeenCalled();

    endpointStore.set(ACTIVE_ENDPOINT);
    await runtime.resume(EVENT.tenantId, deliveryId);

    expect(publisher.publish).toHaveBeenCalledTimes(1);
  });

  it("enforces tenant isolation when committing endpoint-specific deliveries", async () => {
    const store = new InMemoryOutboundWebhookStore();
    const event = {
      ...EVENT,
      payloadBytes: new TextEncoder().encode("{}"),
      committedAt: START,
    };
    await expect(
      store.commitEvent({
        event,
        endpoints: [
          ACTIVE_ENDPOINT,
          { ...ACTIVE_ENDPOINT, id: "endpoint_2", tenantId: "tenant_2" },
        ],
      }),
    ).rejects.toBeInstanceOf(OutboundWebhookConfigurationProblem);
    expect(await store.getEvent(EVENT.tenantId, EVENT.id)).toBeUndefined();
    expect(
      await store.getDelivery(
        EVENT.tenantId,
        `${EVENT.tenantId}:${EVENT.id}:${ACTIVE_ENDPOINT.id}`,
      ),
    ).toBeUndefined();
  });

  it("returns diagnostics without payload, URL, metadata, signature, or secret material", async () => {
    const store = new InMemoryOutboundWebhookStore();
    const runtime = createRuntime({
      store,
      transport: new FakeOutboundWebhookTransport([{ kind: "http", status: 204 }]),
    });
    const deliveryId = (await runtime.publish(EVENT)).deliveries[0]?.id ?? "";
    await runtime.dispatch(EVENT.tenantId, deliveryId);

    const diagnostics = await runtime.diagnostics(EVENT.tenantId, EVENT.id);
    const serialized = JSON.stringify(diagnostics);
    expect(diagnostics).toEqual({
      eventId: EVENT.id,
      tenantId: EVENT.tenantId,
      deliveryCounts: {
        pending: 0,
        accepted: 0,
        delivered: 1,
        retrying: 0,
        dead: 0,
        canceled: 0,
        "acceptance-unknown": 0,
      },
      attemptCount: 1,
    });
    expect(serialized).not.toContain("invoiceId");
    expect(serialized).not.toContain("active-secret-material");
    expect(serialized).not.toContain(ACTIVE_ENDPOINT.url);
  });

  it("rejects cross-tenant dispatch, replay, and diagnostics without revealing records", async () => {
    const store = new InMemoryOutboundWebhookStore();
    const runtime = createRuntime({ store });
    const deliveryId = (await runtime.publish(EVENT)).deliveries[0]?.id ?? "";

    await expect(runtime.dispatch("tenant_2", deliveryId)).rejects.toBeInstanceOf(
      OutboundWebhookConfigurationProblem,
    );
    await expect(runtime.replay("tenant_2", deliveryId)).rejects.toBeInstanceOf(
      OutboundWebhookConfigurationProblem,
    );
    await expect(runtime.diagnostics("tenant_2", EVENT.id)).rejects.toBeInstanceOf(
      OutboundWebhookConfigurationProblem,
    );
  });

  it("drains durable dispatch intents only for the requested tenant", async () => {
    const store = new InMemoryOutboundWebhookStore();
    const tenantTwoEndpoint = {
      ...ACTIVE_ENDPOINT,
      id: "endpoint_2",
      tenantId: "tenant_2",
    };
    await store.commitEvent({
      event: {
        ...EVENT,
        payloadBytes: new TextEncoder().encode("{}"),
        committedAt: START,
      },
      endpoints: [ACTIVE_ENDPOINT],
    });
    await store.commitEvent({
      event: {
        ...EVENT,
        id: "event_2",
        tenantId: "tenant_2",
        payloadBytes: new TextEncoder().encode("{}"),
        committedAt: START,
      },
      endpoints: [tenantTwoEndpoint],
    });
    const publisher: OutboundWebhookTaskPublisher = { publish: vi.fn() };
    const runtime = createRuntime({ store, publisher });

    await expect(runtime.publishUnpublishedIntents(EVENT.tenantId)).resolves.toEqual({
      publishedIntentIds: [expect.any(String)],
      failures: [],
    });

    expect(publisher.publish).toHaveBeenCalledTimes(1);
    expect(await store.listUnpublishedIntents(EVENT.tenantId)).toHaveLength(0);
    expect(await store.listUnpublishedIntents("tenant_2")).toHaveLength(1);
  });

  it("never lets a custom pause policy override paused or disabled endpoint status", async () => {
    const paused = { ...ACTIVE_ENDPOINT, status: "paused" as const };
    const store = new InMemoryOutboundWebhookStore();
    const endpointStore = new InMemoryOutboundWebhookEndpointStore([paused]);
    const runtime = new OutboundWebhookRuntime({
      store,
      endpointStore,
      secretStore: new InMemoryOutboundWebhookSecretStore([ACTIVE_SECRET]),
      taskPublisher: { publish: vi.fn() },
      transport: new FakeOutboundWebhookTransport([{ kind: "http", status: 204 }]),
      pausePolicy: { allowsDispatch: () => true },
      urlPolicy: publicTestUrlPolicy(),
      now: () => new Date(START),
    });
    const deliveryId = (await runtime.publish(EVENT)).deliveries[0]?.id ?? "";

    await expect(runtime.dispatch(EVENT.tenantId, deliveryId)).rejects.toBeInstanceOf(
      OutboundWebhookReplayNotAllowedProblem,
    );
    endpointStore.set({ ...ACTIVE_ENDPOINT, status: "disabled" });
    await expect(runtime.resume(EVENT.tenantId, deliveryId)).rejects.toBeInstanceOf(
      OutboundWebhookReplayNotAllowedProblem,
    );
  });

  it("rejects a secret adapter response from another tenant before signing", async () => {
    const store = new InMemoryOutboundWebhookStore();
    const transport = new FakeOutboundWebhookTransport([{ kind: "http", status: 204 }]);
    const runtime = new OutboundWebhookRuntime({
      store,
      endpointStore: new InMemoryOutboundWebhookEndpointStore([ACTIVE_ENDPOINT]),
      secretStore: {
        getSecret: async () => ({ ...ACTIVE_SECRET, tenantId: "tenant_2" }),
      },
      taskPublisher: { publish: vi.fn() },
      transport,
      urlPolicy: publicTestUrlPolicy(),
      now: () => new Date(START),
    });
    const deliveryId = (await runtime.publish(EVENT)).deliveries[0]?.id ?? "";

    await expect(runtime.dispatch(EVENT.tenantId, deliveryId)).rejects.toBeInstanceOf(
      OutboundWebhookConfigurationProblem,
    );
    expect(transport.requests).toHaveLength(0);
  });
});

describe("outbound webhook signing and URL policy", () => {
  const body = new TextEncoder().encode('{"event":"stable-bytes"}');
  const timestamp = "1785024000";

  it("verifies active and grace-period previous secrets", () => {
    const activeSignature = signOutboundWebhook(body, timestamp, ACTIVE_SECRET);
    const previousSignature = signOutboundWebhook(body, timestamp, PREVIOUS_SECRET);

    expect(
      verifyOutboundWebhookSignature({
        body,
        timestamp,
        signature: activeSignature,
        secretVersion: "v2",
        endpoint: ACTIVE_ENDPOINT,
        secrets: [ACTIVE_SECRET, PREVIOUS_SECRET],
        now: START,
      }),
    ).toBe(true);
    expect(
      verifyOutboundWebhookSignature({
        body,
        timestamp,
        signature: previousSignature,
        secretVersion: "v1",
        endpoint: ACTIVE_ENDPOINT,
        secrets: [ACTIVE_SECRET, PREVIOUS_SECRET],
        now: START,
      }),
    ).toBe(true);
  });

  it.each([-300, 300])(
    "verifies signatures within the five-minute replay window at %s seconds",
    (offsetSeconds) => {
      const inWindowTimestamp = String(START.getTime() / 1_000 + offsetSeconds);

      expect(
        verifyOutboundWebhookSignature({
          body,
          timestamp: inWindowTimestamp,
          signature: signOutboundWebhook(body, inWindowTimestamp, ACTIVE_SECRET),
          secretVersion: "v2",
          endpoint: ACTIVE_ENDPOINT,
          secrets: [ACTIVE_SECRET],
          now: START,
        }),
      ).toBe(true);
    },
  );

  it.each([
    { case: "stale", rejectedTimestamp: String(START.getTime() / 1_000 - 301) },
    { case: "future", rejectedTimestamp: String(START.getTime() / 1_000 + 301) },
    { case: "malformed", rejectedTimestamp: "not-a-date" },
  ])("rejects $case signed timestamps outside the replay contract", ({ rejectedTimestamp }) => {
    expect(
      verifyOutboundWebhookSignature({
        body,
        timestamp: rejectedTimestamp,
        signature: signOutboundWebhook(body, rejectedTimestamp, ACTIVE_SECRET),
        secretVersion: "v2",
        endpoint: ACTIVE_ENDPOINT,
        secrets: [ACTIVE_SECRET],
        now: START,
      }),
    ).toBe(false);
  });

  it("returns false for an invalid signature without exposing secret material", () => {
    expect(
      verifyOutboundWebhookSignature({
        body,
        timestamp,
        signature: "v1=invalid",
        secretVersion: "v2",
        endpoint: ACTIVE_ENDPOINT,
        secrets: [ACTIVE_SECRET],
        now: START,
      }),
    ).toBe(false);
  });

  it.each([
    ["v1", new Date("2026-07-28T00:00:00.000Z"), "expired"],
    ["v0", START, "unknown"],
  ])("rejects %s secret versions as %s", (secretVersion, now, reason) => {
    expect(() =>
      verifyOutboundWebhookSignature({
        body,
        timestamp,
        signature: "v1=invalid",
        secretVersion,
        endpoint: ACTIVE_ENDPOINT,
        secrets: [ACTIVE_SECRET, PREVIOUS_SECRET],
        now,
      }),
    ).toThrowError(InvalidOutboundWebhookSecretVersionProblem);
    try {
      verifyOutboundWebhookSignature({
        body,
        timestamp,
        signature: "v1=invalid",
        secretVersion,
        endpoint: ACTIVE_ENDPOINT,
        secrets: [ACTIVE_SECRET, PREVIOUS_SECRET],
        now,
      });
    } catch (error) {
      expect(JSON.stringify(error)).not.toContain("secret-material");
      expect(JSON.stringify(error)).toContain(reason);
    }
  });

  it.each([
    "http://hooks.example.com",
    "https://localhost/hook",
    "https://127.0.0.1/hook",
    "https://10.1.2.3/hook",
    "https://169.254.169.254/latest/meta-data",
    "https://[::1]/hook",
    "https://user:password@hooks.example.com/hook",
    "https://[::ffff:7f00:1]/hook",
  ])("rejects SSRF-oriented endpoint URL %s", async (url) => {
    await expect(defaultOutboundWebhookUrlPolicy.validate(url)).rejects.toBeInstanceOf(
      InvalidOutboundWebhookUrlProblem,
    );
  });

  it("rejects unsafe endpoint registrations before they can be subscribed", () => {
    expect(
      () =>
        new InMemoryOutboundWebhookEndpointStore([
          { ...ACTIVE_ENDPOINT, url: "https://169.254.169.254/latest" },
        ]),
    ).toThrowError(InvalidOutboundWebhookUrlProblem);
  });

  it("rejects a public hostname when DNS resolves it to a private address", async () => {
    const policy = createOutboundWebhookUrlPolicy({
      resolveHostname: async () => ["10.1.2.3"],
    });

    await expect(
      policy.validate("https://hooks.customer.example/v1/events"),
    ).rejects.toBeInstanceOf(InvalidOutboundWebhookUrlProblem);
  });

  it("rejects non-IP resolver output so transports never resolve a second hostname", async () => {
    const policy = createOutboundWebhookUrlPolicy({
      resolveHostname: async () => ["second-resolution.example"],
    });

    await expect(
      policy.validate("https://hooks.customer.example/v1/events"),
    ).rejects.toBeInstanceOf(InvalidOutboundWebhookUrlProblem);
  });

  it("pins validated public DNS addresses into the transport request", async () => {
    const store = new InMemoryOutboundWebhookStore();
    const transport = new FakeOutboundWebhookTransport([{ kind: "http", status: 204 }]);
    const runtime = createRuntime({ store, transport });
    const deliveryId = (await runtime.publish(EVENT)).deliveries[0]?.id ?? "";

    await runtime.dispatch(EVENT.tenantId, deliveryId);

    expect(transport.requests[0]?.resolvedAddresses).toEqual(["1.1.1.1"]);
  });
});

describe("outbound webhook store conformance", () => {
  const suite = createOutboundWebhookStoreConformanceSuite({
    createStore: () => new InMemoryOutboundWebhookStore(),
    event: {
      id: EVENT.id,
      name: EVENT.name,
      schemaVersion: EVENT.schemaVersion,
      subject: EVENT.subject,
      tenantId: EVENT.tenantId,
      occurredAt: EVENT.occurredAt,
      payloadBytes: new TextEncoder().encode('{"fixture":true}'),
      committedAt: START,
    },
    endpoint: ACTIVE_ENDPOINT,
  });

  it.each(suite.cases.map((testCase) => [testCase.name, testCase.run] as const))(
    "%s",
    async (_name, run) => run(),
  );
});

function createRuntime(options: {
  readonly store: InMemoryOutboundWebhookStore;
  readonly publisher?: OutboundWebhookTaskPublisher;
  readonly transport?: OutboundWebhookTransport;
  readonly endpoints?: readonly OutboundWebhookEndpoint[];
  readonly secrets?: readonly OutboundWebhookSecret[];
  readonly retryPolicy?: {
    readonly maxAttempts: number;
    readonly backoff: { getDelay(attempt: number): number };
  };
  readonly now?: () => Date;
  readonly createId?: () => string;
}): OutboundWebhookRuntime {
  return new OutboundWebhookRuntime({
    store: options.store,
    endpointStore: new InMemoryOutboundWebhookEndpointStore(options.endpoints ?? [ACTIVE_ENDPOINT]),
    secretStore: new InMemoryOutboundWebhookSecretStore(options.secrets ?? [ACTIVE_SECRET]),
    taskPublisher: options.publisher ?? { publish: vi.fn() },
    transport:
      options.transport ?? new FakeOutboundWebhookTransport([{ kind: "http", status: 204 }]),
    urlPolicy: publicTestUrlPolicy(),
    now: options.now ?? (() => new Date(START)),
    createId: options.createId ?? (() => "attempt_1"),
    ...(options.retryPolicy === undefined ? {} : { retryPolicy: options.retryPolicy }),
  });
}

function publicTestUrlPolicy() {
  return createOutboundWebhookUrlPolicy({
    resolveHostname: async () => ["1.1.1.1"],
  });
}
