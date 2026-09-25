import { InMemoryIdempotencyStore } from "@croco/idempotency-core";
import { Problem, ProblemCategory } from "@croco/problems-core";
import { describe, expect, it, vi } from "vitest";
import {
  InvalidWebhookEnvelopeProblem,
  InvalidWebhookFixtureProblem,
  InvalidWebhookSignatureProblem,
  UnknownWebhookEventProblem,
  WebhookDispatchProblem,
  WebhookGatewayConfigurationProblem,
  WebhookReporterProblem,
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

      const body = typeof rawBody === "string" ? rawBody : new TextDecoder().decode(rawBody);
      const parsed = JSON.parse(body.replace(/^\uFEFF/u, "")) as {
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
  options: {
    readonly unknownEventPolicy?: "fail" | "ignore" | "report";
    readonly handlerFailure?: Error;
  } = {},
) {
  const handler = vi.fn(
    async (
      event: WebhookEvent<{ subscriptionId: string; tenantId: string }, "subscription.created">,
    ) => {
      if (options.handlerFailure !== undefined) {
        throw options.handlerFailure;
      }

      return { stored: event.payload.subscriptionId };
    },
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

class FixtureHandlerProblem extends Problem {
  constructor(category: ProblemCategory, extensions?: { readonly retryable: boolean }) {
    super(
      "webhooks-core/test-handler-problem",
      category,
      "fixture handler failed",
      extensions === undefined ? {} : { extensions },
    );
  }
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

  it("deduplicates equivalent string and Uint8Array bodies with the same fingerprint", async () => {
    const { gateway, handler } = createGateway();
    const request = signedRequest();

    const first = await gateway.handle(request);
    const second = await gateway.handle({
      ...request,
      rawBody: new TextEncoder().encode(request.rawBody),
    });

    expect(second.outcome).toBe("duplicate");
    expect(second.idempotencyKey).toEqual(first.idempotencyKey);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("preserves a leading byte order mark across string and Uint8Array bodies", async () => {
    const { gateway, handler } = createGateway();
    const request = signedRequest();
    const rawBody = `\uFEFF${request.rawBody}`;

    const first = await gateway.handle({ ...request, rawBody });
    const second = await gateway.handle({
      ...request,
      rawBody: new TextEncoder().encode(rawBody),
    });

    expect(second.outcome).toBe("duplicate");
    expect(second.idempotencyKey).toEqual(first.idempotencyKey);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("keeps malformed binary bodies distinct from valid text and other malformed bytes", async () => {
    const handler = vi.fn(async () => ({ stored: "sub-1" }));
    const gateway = new WebhookGateway({
      adapter: {
        provider: "fixture",
        verify: () => ({
          id: "evt-1",
          provider: "fixture",
          type: "subscription.created",
          payload: { subscriptionId: "sub-1", tenantId: "tenant-1" },
          tenantId: "tenant-1",
        }),
      },
      router: createWebhookEventRouter<FixtureEvents>().register("subscription.created", handler),
      idempotencyStore: new InMemoryIdempotencyStore<WebhookGatewayStoredResult>(),
      unknownEventPolicy: "fail",
    });

    await gateway.handle({ rawBody: Uint8Array.of(0xff), headers: {} });

    await expect(
      gateway.handle({ rawBody: Uint8Array.of(0xfe), headers: {} }),
    ).rejects.toMatchObject({ code: "idempotency-core/key-conflict" });
    await expect(
      gateway.handle({ rawBody: new TextEncoder().encode("ff"), headers: {} }),
    ).rejects.toMatchObject({ code: "idempotency-core/key-conflict" });
    await expect(gateway.handle({ rawBody: "ff", headers: {} })).rejects.toMatchObject({
      code: "idempotency-core/key-conflict",
    });
    await expect(gateway.handle({ rawBody: "�", headers: {} })).rejects.toMatchObject({
      code: "idempotency-core/key-conflict",
    });
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

  it.each([
    {
      name: "a plain Error",
      failure: new Error("database unavailable"),
      extensions: {},
    },
    {
      name: "a Problem marked retryable on a client-error category",
      failure: new FixtureHandlerProblem(ProblemCategory.NotFound, { retryable: true }),
      extensions: { causeCode: "webhooks-core/test-handler-problem", retryable: true },
    },
    {
      name: "a Problem with a retryable client-error status",
      failure: new FixtureHandlerProblem(ProblemCategory.TooManyRequests),
      extensions: { causeCode: "webhooks-core/test-handler-problem", retryable: true },
    },
    {
      name: "a Problem with a server-error status",
      failure: new FixtureHandlerProblem(ProblemCategory.InternalServerError),
      extensions: { causeCode: "webhooks-core/test-handler-problem", retryable: true },
    },
  ])(
    "wraps retryable handler failures from $name and re-runs the handler on redelivery",
    async ({ failure, extensions }) => {
      const { gateway, handler } = createGateway({ handlerFailure: failure });

      for (let delivery = 0; delivery < 3; delivery += 1) {
        const error = await gateway.handle(signedRequest()).catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(WebhookDispatchProblem);
        expect(error).toMatchObject({
          code: "webhooks-core/dispatch-failed",
          category: ProblemCategory.InternalServerError,
          status: 500,
        });
        expect((error as WebhookDispatchProblem).extensions).toEqual({
          provider: "fixture",
          eventId: "evt-1",
          eventType: "subscription.created",
          ...extensions,
        });
        expect((error as WebhookDispatchProblem).cause).toBe(failure);
      }
      expect(handler).toHaveBeenCalledTimes(3);
    },
  );

  it.each([
    {
      name: "a Problem marked non-retryable on a server-error category",
      failure: new FixtureHandlerProblem(ProblemCategory.InternalServerError, { retryable: false }),
    },
    {
      name: "a Problem with a client-error status",
      failure: new FixtureHandlerProblem(ProblemCategory.NotFound),
    },
  ])(
    "records non-retryable handler failures from $name without re-running the handler",
    async ({ failure }) => {
      const { gateway, handler } = createGateway({ handlerFailure: failure });

      const error = await gateway.handle(signedRequest()).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(WebhookDispatchProblem);
      expect(error).toMatchObject({
        code: "webhooks-core/dispatch-failed",
        category: ProblemCategory.InternalServerError,
        status: 500,
      });
      expect((error as WebhookDispatchProblem).extensions).toEqual({
        provider: "fixture",
        eventId: "evt-1",
        eventType: "subscription.created",
        causeCode: "webhooks-core/test-handler-problem",
        retryable: false,
      });
      expect((error as WebhookDispatchProblem).cause).toBe(failure);

      for (let redelivery = 0; redelivery < 2; redelivery += 1) {
        await expect(gateway.handle(signedRequest())).resolves.toMatchObject({
          outcome: "failed",
          record: {
            status: "failed",
            retryable: false,
            problem: { code: "webhooks-core/dispatch-failed", status: 500 },
          },
        });
      }
      await expect(
        gateway.replay({ provider: "fixture", ...signedRequest() }),
      ).resolves.toMatchObject({
        outcome: "failed",
        record: { status: "failed", retryable: false },
      });
      expect(handler).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    {
      name: "a plain Error",
      failure: new Error("reporter unavailable"),
      extensions: {},
    },
    {
      name: "a Problem marked retryable on a client-error category",
      failure: new FixtureHandlerProblem(ProblemCategory.NotFound, { retryable: true }),
      extensions: { retryable: true },
    },
    {
      name: "a Problem with a server-error status",
      failure: new FixtureHandlerProblem(ProblemCategory.InternalServerError),
      extensions: { retryable: true },
    },
  ])(
    "wraps retryable reporter failures from $name and re-runs the reporter on redelivery",
    async ({ failure, extensions }) => {
      const { gateway, reporter } = createGateway({ unknownEventPolicy: "report" });
      reporter.reportUnknownEvent.mockRejectedValue(failure);

      for (let delivery = 0; delivery < 3; delivery += 1) {
        const error = await gateway
          .handle(signedRequest("customer.updated"))
          .catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(WebhookReporterProblem);
        expect(error).toMatchObject({
          code: "webhooks-core/reporter-failed",
          category: ProblemCategory.InternalServerError,
          status: 500,
        });
        expect((error as WebhookReporterProblem).extensions).toEqual({
          provider: "fixture",
          eventId: "evt-1",
          eventType: "customer.updated",
          ...extensions,
        });
        expect((error as WebhookReporterProblem).cause).toBe(failure);
      }
      expect(reporter.reportUnknownEvent).toHaveBeenCalledTimes(3);
    },
  );

  it.each([
    {
      name: "a Problem marked non-retryable on a server-error category",
      failure: new FixtureHandlerProblem(ProblemCategory.InternalServerError, { retryable: false }),
    },
    {
      name: "a Problem with a client-error status",
      failure: new FixtureHandlerProblem(ProblemCategory.NotFound),
    },
  ])(
    "records non-retryable reporter failures from $name without re-running the reporter",
    async ({ failure }) => {
      const { gateway, reporter } = createGateway({ unknownEventPolicy: "report" });
      reporter.reportUnknownEvent.mockRejectedValue(failure);

      const error = await gateway
        .handle(signedRequest("customer.updated"))
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(WebhookReporterProblem);
      expect(error).toMatchObject({
        code: "webhooks-core/reporter-failed",
        category: ProblemCategory.InternalServerError,
        status: 500,
      });
      expect((error as WebhookReporterProblem).extensions).toEqual({
        provider: "fixture",
        eventId: "evt-1",
        eventType: "customer.updated",
        retryable: false,
      });
      expect((error as WebhookReporterProblem).cause).toBe(failure);

      for (let redelivery = 0; redelivery < 2; redelivery += 1) {
        await expect(gateway.handle(signedRequest("customer.updated"))).resolves.toMatchObject({
          outcome: "failed",
          record: {
            status: "failed",
            retryable: false,
            problem: { code: "webhooks-core/reporter-failed", status: 500 },
          },
        });
      }
      expect(reporter.reportUnknownEvent).toHaveBeenCalledTimes(1);
    },
  );

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
