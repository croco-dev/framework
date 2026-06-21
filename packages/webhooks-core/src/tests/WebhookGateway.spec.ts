import { InMemoryIdempotencyStore } from "@croco/idempotency-core";
import { describe, expect, it, vi } from "vitest";
import {
  InvalidWebhookEnvelopeProblem,
  InvalidWebhookFixtureProblem,
  InvalidWebhookSignatureProblem,
  UnknownWebhookEventProblem,
  WebhookDispatchProblem,
  WebhookGatewayConfigurationProblem,
  type WebhookEvent,
  WebhookGateway,
  type WebhookGatewayStoredResult,
  createWebhookEventRouter,
  type WebhookProviderAdapter,
} from "../index";

type FixtureEvents = {
  "subscription.created": {
    payload: { subscriptionId: string; tenantId: string };
    result: { stored: string };
  };
};

function createAdapter(): WebhookProviderAdapter {
  return {
    provider: "fixture",
    verify: ({ rawBody, headers }) => {
      if (headers["webhook-signature"] !== "valid") {
        throw new InvalidWebhookSignatureProblem({
          provider: "fixture",
          reason: "invalid signature",
        });
      }

      const parsed = JSON.parse(String(rawBody)) as {
        id: string;
        type: string;
        data: { subscriptionId: string; tenantId: string };
      };

      return {
        id: parsed.id,
        provider: "fixture",
        type: parsed.type,
        payload: parsed.data,
        tenantId: parsed.data.tenantId,
      };
    },
  };
}

function createGateway(
  options: { readonly unknownEventPolicy?: "fail" | "ignore" | "report" } = {},
) {
  const handler = vi.fn(
    async (
      event: WebhookEvent<{ subscriptionId: string; tenantId: string }, "subscription.created">,
    ) => ({
      stored: event.payload.subscriptionId,
    }),
  );
  const router = createWebhookEventRouter<FixtureEvents>().register(
    "subscription.created",
    handler,
  );
  const reporter = {
    reportUnknownEvent: vi.fn(),
  };
  const gateway = new WebhookGateway({
    adapter: createAdapter(),
    router,
    idempotencyStore: new InMemoryIdempotencyStore<WebhookGatewayStoredResult>(),
    unknownEventPolicy: options.unknownEventPolicy ?? "fail",
    ...(options.unknownEventPolicy === "report" ? { unknownEventReporter: reporter } : {}),
    now: () => new Date("2026-06-21T00:00:00.000Z"),
  });

  return { gateway, handler, reporter };
}

function signedRequest(type = "subscription.created") {
  return {
    rawBody: JSON.stringify({
      id: "evt-1",
      type,
      data: {
        subscriptionId: "sub-1",
        tenantId: "tenant-1",
      },
    }),
    headers: {
      "Webhook-Signature": "valid",
    },
  };
}

describe("WebhookGateway", () => {
  it("verifies signatures before dispatching to handlers", async () => {
    const { gateway, handler } = createGateway();

    await expect(
      gateway.handle({
        ...signedRequest(),
        headers: { "Webhook-Signature": "invalid" },
      }),
    ).rejects.toBeInstanceOf(InvalidWebhookSignatureProblem);

    expect(handler).not.toHaveBeenCalled();
  });

  it("dispatches verified events and replays duplicate deliveries deterministically", async () => {
    const { gateway, handler } = createGateway();

    const first = await gateway.handle(signedRequest());
    const second = await gateway.handle(signedRequest());

    expect(first.outcome).toBe("handled");
    expect(second.outcome).toBe("duplicate");
    expect(first).toMatchObject({
      dispatch: {
        eventId: "evt-1",
        eventType: "subscription.created",
        provider: "fixture",
        handlerResult: { stored: "sub-1" },
      },
    });
    if (
      first.outcome !== "handled" ||
      second.outcome !== "duplicate" ||
      second.originalOutcome !== "handled"
    ) {
      throw new Error("Expected handled first delivery and duplicate second delivery");
    }

    expect(second.originalOutcome).toBe("handled");
    expect(second.dispatch).toEqual(first.dispatch);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("rejects the same provider event id when the verified body fingerprint changes", async () => {
    const { gateway } = createGateway();

    await gateway.handle(signedRequest());

    await expect(
      gateway.handle({
        rawBody: JSON.stringify({
          id: "evt-1",
          type: "subscription.created",
          data: {
            subscriptionId: "sub-2",
            tenantId: "tenant-1",
          },
        }),
        headers: { "Webhook-Signature": "valid" },
      }),
    ).rejects.toMatchObject({
      code: "idempotency-core/key-conflict",
    });
  });

  it("requires unknown event policy to be explicit and fail closed by default policy", async () => {
    const { gateway, handler } = createGateway();

    await expect(gateway.handle(signedRequest("customer.updated"))).rejects.toBeInstanceOf(
      UnknownWebhookEventProblem,
    );
    expect(handler).not.toHaveBeenCalled();
  });

  it("rejects missing unknown event policy at runtime", () => {
    expect(
      () =>
        new WebhookGateway({
          adapter: createAdapter(),
          router: createWebhookEventRouter<FixtureEvents>(),
          idempotencyStore: new InMemoryIdempotencyStore<WebhookGatewayStoredResult>(),
          unknownEventPolicy: undefined as never,
        }),
    ).toThrow(WebhookGatewayConfigurationProblem);
  });

  it("can ignore unknown events without dispatching a handler", async () => {
    const { gateway, handler } = createGateway({ unknownEventPolicy: "ignore" });

    const result = await gateway.handle(signedRequest("customer.updated"));

    expect(result.outcome).toBe("ignored");
    if (result.outcome !== "ignored") {
      throw new Error("Expected ignored unknown event");
    }
    expect(result.problem).toBeInstanceOf(UnknownWebhookEventProblem);
    expect(handler).not.toHaveBeenCalled();
  });

  it("deduplicates ignored unknown events without dispatching a handler", async () => {
    const { gateway, handler } = createGateway({ unknownEventPolicy: "ignore" });

    const first = await gateway.handle(signedRequest("customer.updated"));
    const second = await gateway.handle(signedRequest("customer.updated"));

    expect(first.outcome).toBe("ignored");
    expect(second.outcome).toBe("duplicate");
    if (second.outcome !== "duplicate") {
      throw new Error("Expected duplicate unknown event replay");
    }
    expect(second.originalOutcome).toBe("ignored");
    expect(handler).not.toHaveBeenCalled();
  });

  it("can report unknown events without dispatching a handler", async () => {
    const { gateway, handler, reporter } = createGateway({ unknownEventPolicy: "report" });

    const result = await gateway.handle(signedRequest("customer.updated"));

    expect(result.outcome).toBe("reported");
    if (result.outcome !== "reported") {
      throw new Error("Expected reported unknown event");
    }
    expect(reporter.reportUnknownEvent).toHaveBeenCalledTimes(1);
    expect(handler).not.toHaveBeenCalled();
  });

  it("deduplicates reported unknown events without repeating reporter side effects", async () => {
    const { gateway, handler, reporter } = createGateway({ unknownEventPolicy: "report" });

    const first = await gateway.handle(signedRequest("customer.updated"));
    const second = await gateway.handle(signedRequest("customer.updated"));

    expect(first.outcome).toBe("reported");
    expect(second.outcome).toBe("duplicate");
    if (second.outcome !== "duplicate") {
      throw new Error("Expected duplicate reported event replay");
    }
    expect(second.originalOutcome).toBe("reported");
    expect(reporter.reportUnknownEvent).toHaveBeenCalledTimes(1);
    expect(handler).not.toHaveBeenCalled();
  });

  it("wraps handler failures in stable webhook Problems and releases retryable reservations", async () => {
    const handler = vi.fn(
      async (
        _event: WebhookEvent<{ subscriptionId: string; tenantId: string }, "subscription.created">,
      ) => {
        throw new Error("database unavailable");
      },
    );
    const router = createWebhookEventRouter<FixtureEvents>().register(
      "subscription.created",
      handler,
    );
    const gateway = new WebhookGateway({
      adapter: createAdapter(),
      router,
      idempotencyStore: new InMemoryIdempotencyStore<WebhookGatewayStoredResult>(),
      unknownEventPolicy: "fail",
    });

    await expect(gateway.handle(signedRequest())).rejects.toBeInstanceOf(WebhookDispatchProblem);
    await expect(gateway.handle(signedRequest())).rejects.toBeInstanceOf(WebhookDispatchProblem);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("replays local fixtures through the same verification, idempotency, and dispatch path", async () => {
    const { gateway, handler } = createGateway();

    const result = await gateway.replay({
      provider: "fixture",
      ...signedRequest(),
    });

    expect(result.outcome).toBe("handled");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("rejects replay fixtures when declared event metadata does not match verification", async () => {
    const { gateway } = createGateway();

    await expect(
      gateway.replay({
        provider: "fixture",
        eventId: "evt-other",
        ...signedRequest(),
      }),
    ).rejects.toBeInstanceOf(InvalidWebhookFixtureProblem);

    await expect(
      gateway.replay({
        provider: "fixture",
        eventType: "invoice.paid",
        ...signedRequest(),
      }),
    ).rejects.toBeInstanceOf(InvalidWebhookFixtureProblem);
  });

  it("maps validly signed malformed envelopes to envelope Problems", async () => {
    const { gateway, handler } = createGateway();

    await expect(
      gateway.handle({
        rawBody: "{",
        headers: {
          "Webhook-Signature": "valid",
        },
      }),
    ).rejects.toBeInstanceOf(InvalidWebhookEnvelopeProblem);
    expect(handler).not.toHaveBeenCalled();
  });
});
