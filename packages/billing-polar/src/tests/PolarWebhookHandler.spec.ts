import type { BillingStore, PlanRegistry, PlanVersionDefinition } from "@croco/billing-core";
import {
  planVersionRef,
  UnknownProviderPlanMappingProblem,
  WebhookAlreadyProcessedProblem,
} from "@croco/billing-core";
import type { EventPublisher } from "@croco/events-core";
import { createBillingProviderConformanceSuite } from "@croco/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PolarWebhookHandler } from "../libs/PolarWebhookHandler";
import { WebhookProcessingProblem } from "../libs/problems/WebhookProcessingProblem";
import { WebhookValidationProblem } from "../libs/problems/WebhookValidationProblem";
import type { PolarConfig } from "../types";

function createMockStore(): BillingStore {
  return {
    findAccountByTenantId: vi.fn(),
    findAccountByExternalId: vi.fn(),
    saveAccount: vi.fn(),
    deleteAccount: vi.fn(),
    findSubscription: vi.fn(),
    findSubscriptionByExternalId: vi.fn(),
    saveSubscription: vi.fn(),
    deleteSubscription: vi.fn(),
    saveOrder: vi.fn(),
    findOrdersByAccount: vi.fn(),
    reserveWebhook: vi.fn(),
    completeWebhook: vi.fn(),
    failWebhook: vi.fn(),
  };
}

function createMockEventPublisher(): EventPublisher {
  const mockPublisher = {
    publish: vi.fn(),
    publishNow: vi.fn(),
    publishMany: vi.fn(),
  } as unknown as EventPublisher;
  return mockPublisher;
}

const POLAR_PLAN_VERSION = {
  ref: planVersionRef("plan-pro@v1"),
  planId: "plan-pro",
  versionId: "v1",
  effectiveAt: "2026-01-01T00:00:00.000Z",
  name: "Pro",
  amount: 9900,
  currency: "USD",
  interval: "month",
  intervalCount: 1,
  rating: { mode: "provider", provider: "polar" },
  providerBindings: [
    {
      provider: "polar",
      productId: "plan-pro",
      priceIds: [],
    },
  ],
} satisfies PlanVersionDefinition;

function createMockPlanRegistry(): PlanRegistry {
  return {
    publishPlanVersion: vi.fn(),
    getPlan: vi.fn(),
    getAllPlans: vi.fn(),
    getPlanVersion: vi.fn(),
    getAllPlanVersions: vi.fn(),
    getPlanAtDate: vi.fn(),
    resolveProviderPlanVersion: vi.fn().mockResolvedValue(POLAR_PLAN_VERSION),
  };
}

const mockValidateEvent = vi.fn();

vi.mock("@polar-sh/sdk/webhooks", () => ({
  get validateEvent() {
    return mockValidateEvent;
  },
  WebhookVerificationError: class extends Error {
    constructor(message: string) {
      super(message);
      this.name = "WebhookVerificationError";
    }
  },
}));

const signedSubscriptionEvent = {
  id: "evt-signed-replay",
  type: "subscription.created",
  data: {
    id: "sub-signed-replay",
    customer: { externalId: "tenant-signed-replay", metadata: {} },
    product: { id: "plan-pro" },
    status: "active",
    currentPeriodEnd: "2026-02-01T00:00:00Z",
    cancelAtPeriodEnd: false,
  },
};

function expectWebhookValidationProblem(
  problem: unknown,
  detail?: string | RegExp,
): asserts problem is WebhookValidationProblem {
  expect(problem).toBeInstanceOf(WebhookValidationProblem);
  expect(problem).toMatchObject({
    code: "WEBHOOK_VALIDATION_FAILED",
    status: 400,
  });

  if (detail) {
    expect(problem).toMatchObject({
      detail: typeof detail === "string" ? detail : expect.stringMatching(detail),
    });
  }
}

async function captureWebhookValidationProblem(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    expectWebhookValidationProblem(error);
    return error;
  }

  throw new Error("Expected webhook validation to fail");
}

const webhookValidationFailureCases: readonly {
  readonly name: string;
  readonly message: string;
  readonly headers: Record<string, string>;
  readonly detail: string | RegExp;
}[] = [
  {
    name: "invalid signature",
    message: "Invalid signature",
    headers: {
      "webhook-id": "evt-invalid-signature",
      "webhook-signature": "invalid-signature",
    },
    detail: "Webhook validation failed: Invalid signature",
  },
  {
    name: "stale timestamp outside clock skew tolerance",
    message: "Webhook timestamp outside tolerance: signature=stale-signature",
    headers: {
      "webhook-id": "evt-stale-timestamp",
      "webhook-timestamp": "2026-01-01T00:00:00Z",
      "webhook-signature": "stale-signature",
    },
    detail:
      /Webhook validation failed: Webhook timestamp outside tolerance: signature=\[redacted\]/,
  },
];

describe("PolarWebhookHandler", () => {
  let handler!: PolarWebhookHandler;
  let mockStore!: BillingStore;
  let mockEventPublisher!: EventPublisher;
  let mockPlanRegistry!: PlanRegistry;
  let config!: PolarConfig;

  beforeEach(() => {
    mockStore = createMockStore();
    mockEventPublisher = createMockEventPublisher();
    mockPlanRegistry = createMockPlanRegistry();
    config = {
      accessToken: "test-token",
      environment: "sandbox",
      webhookSecret: "test-secret",
    };

    handler = new PolarWebhookHandler(config, {
      store: mockStore,
      eventPublisher: mockEventPublisher,
      planRegistry: mockPlanRegistry,
    });

    vi.clearAllMocks();
  });

  describe("billing provider conformance", () => {
    const subscriptionEvent = {
      id: "evt-conformance-subscription",
      type: "subscription.created",
      data: {
        id: "sub-conformance",
        customer: { externalId: "tenant-conformance", metadata: {} },
        product: { id: "plan-pro" },
        status: "active",
        currentPeriodEnd: "2026-02-01T00:00:00Z",
        cancelAtPeriodEnd: false,
      },
    };

    const orderEvent = {
      id: "evt-conformance-order",
      type: "order.paid",
      data: {
        id: "order-conformance",
        amount: 9900,
        currency: "USD",
        customer: { externalId: "tenant-conformance", metadata: {} },
        createdAt: "2026-01-31T00:00:00Z",
      },
    };

    function configureConformanceHandler(): PolarWebhookHandler {
      vi.mocked(mockStore.findSubscription).mockResolvedValue(null);
      vi.mocked(mockStore.completeWebhook).mockResolvedValue(undefined);
      vi.mocked(mockStore.failWebhook).mockResolvedValue(undefined);
      vi.mocked(mockStore.reserveWebhook)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValue(new WebhookAlreadyProcessedProblem(subscriptionEvent.id));
      vi.mocked(mockValidateEvent).mockImplementation(
        (body: Buffer | string, headers: Record<string, string>) => {
          if (headers["webhook-signature"] !== "valid") {
            throw new Error("Invalid signature");
          }

          return JSON.parse(Buffer.isBuffer(body) ? body.toString("utf8") : body) as never;
        },
      );

      return handler;
    }

    it.each(
      createBillingProviderConformanceSuite({
        providerName: "billing-polar",
        webhook: {
          createHandler: configureConformanceHandler,
          fixtures: {
            subscription: {
              body: JSON.stringify(subscriptionEvent),
              headers: {
                "webhook-id": subscriptionEvent.id,
                "webhook-signature": "valid",
              },
              eventId: subscriptionEvent.id,
            },
            order: {
              body: JSON.stringify(orderEvent),
              headers: {
                "webhook-id": orderEvent.id,
                "webhook-signature": "valid",
              },
              eventId: orderEvent.id,
            },
            invalidSignature: {
              body: JSON.stringify(subscriptionEvent),
              headers: {
                "webhook-id": subscriptionEvent.id,
                "webhook-signature": "invalid",
              },
              eventId: subscriptionEvent.id,
            },
            invalidPayload: {
              body: JSON.stringify({
                id: "evt-invalid-payload",
                type: "subscription.created",
                data: {
                  id: "sub-invalid-payload",
                  customer: { externalId: "tenant-conformance", metadata: {} },
                  product: { id: "plan-pro" },
                  status: "future_status",
                  currentPeriodEnd: "2026-02-01T00:00:00Z",
                  cancelAtPeriodEnd: false,
                },
              }),
              headers: {
                "webhook-id": "evt-invalid-payload",
                "webhook-signature": "valid",
              },
              eventId: "evt-invalid-payload",
            },
          },
          assertions: {
            subscription: () => {
              expect(mockStore.saveSubscription).toHaveBeenCalledTimes(1);
            },
            order: () => {
              expect(mockStore.saveOrder).toHaveBeenCalledTimes(1);
            },
            idempotency: () => {
              expect(mockStore.saveSubscription).toHaveBeenCalledTimes(1);
              expect(mockStore.reserveWebhook).toHaveBeenCalledTimes(2);
            },
            invalidSignature: (problem) => {
              expect(problem).toBeInstanceOf(WebhookValidationProblem);
            },
            invalidPayload: (problem) => {
              expect(problem).toBeInstanceOf(WebhookValidationProblem);
            },
          },
        },
      }).cases,
    )("$name", async ({ run }) => {
      await run();
    });
  });

  describe("이미 처리된 이벤트는 스킵 (멱등성)", () => {
    it("should treat replayed signed deliveries as idempotent successes", async () => {
      vi.mocked(mockStore.findSubscription).mockResolvedValue(null);
      vi.mocked(mockStore.completeWebhook).mockResolvedValue(undefined);
      vi.mocked(mockStore.reserveWebhook)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new WebhookAlreadyProcessedProblem(signedSubscriptionEvent.id));
      vi.mocked(mockValidateEvent).mockImplementation(
        (body: Buffer | string, headers: Record<string, string>) => {
          expect(headers).toMatchObject({
            "webhook-id": signedSubscriptionEvent.id,
            "webhook-timestamp": "2026-01-31T00:00:00Z",
            "webhook-signature": "v1,replayed-signature",
          });

          return JSON.parse(Buffer.isBuffer(body) ? body.toString("utf8") : body) as never;
        },
      );

      const body = JSON.stringify(signedSubscriptionEvent);
      const headers = {
        "webhook-id": signedSubscriptionEvent.id,
        "webhook-timestamp": "2026-01-31T00:00:00Z",
        "webhook-signature": "v1,replayed-signature",
      };

      const firstResult = await handler.handle(body, headers);
      const replayResult = await handler.handle(body, headers);

      expect(firstResult).toEqual({ success: true, eventId: signedSubscriptionEvent.id });
      expect(replayResult).toEqual({ success: true, eventId: signedSubscriptionEvent.id });
      expect(mockValidateEvent).toHaveBeenCalledTimes(2);
      expect(mockStore.reserveWebhook).toHaveBeenCalledTimes(2);
      expect(mockStore.saveSubscription).toHaveBeenCalledTimes(1);
      expect(mockEventPublisher.publishNow).toHaveBeenCalledTimes(1);
      expect(mockStore.completeWebhook).toHaveBeenCalledTimes(1);
      expect(mockStore.failWebhook).not.toHaveBeenCalled();
    });

    it("should process webhook only once for concurrent requests", async () => {
      vi.mocked(mockStore.findSubscription).mockResolvedValue(null);
      vi.mocked(mockStore.reserveWebhook).mockResolvedValue(undefined);
      vi.mocked(mockStore.completeWebhook).mockResolvedValue(undefined);
      vi.mocked(mockStore.saveSubscription).mockImplementation(async () => {
        await new Promise((resolve) => {
          setTimeout(resolve, 10);
        });
      });

      const eventData = {
        id: "evt-race-1",
        type: "subscription.created",
        data: {
          id: "sub-race-1",
          customer: { externalId: "tenant-race-1", metadata: {} },
          product: { id: "plan-pro" },
          status: "active",
          currentPeriodEnd: "2026-02-01T00:00:00Z",
          cancelAtPeriodEnd: false,
        },
      };

      vi.mocked(mockValidateEvent).mockReturnValue(eventData as never);

      const body = JSON.stringify(eventData);
      const headers = { "webhook-id": "evt-race-1" };
      const secondHandler = new PolarWebhookHandler(config, {
        store: mockStore,
        eventPublisher: mockEventPublisher,
        planRegistry: mockPlanRegistry,
      });

      const [firstResult, secondResult] = await Promise.all([
        handler.handle(body, headers),
        secondHandler.handle(body, headers),
      ]);

      expect(firstResult.success).toBe(true);
      expect(secondResult.success).toBe(true);
      expect(firstResult.eventId).toBe("evt-race-1");
      expect(secondResult.eventId).toBe("evt-race-1");
      expect(mockStore.saveSubscription).toHaveBeenCalledTimes(1);
      expect(mockEventPublisher.publishNow).toHaveBeenCalledTimes(1);
      expect(mockStore.reserveWebhook).toHaveBeenCalledTimes(1);
      expect(mockStore.completeWebhook).toHaveBeenCalledTimes(1);
    });

    it("should skip only a typed already-processed reservation", async () => {
      vi.mocked(mockStore.reserveWebhook).mockRejectedValue(
        new WebhookAlreadyProcessedProblem("evt-dup-conflict"),
      );
      vi.mocked(mockStore.findSubscription).mockResolvedValue(null);

      const eventData = {
        id: "evt-dup-conflict",
        type: "subscription.created",
        data: {
          id: "sub-dup-conflict",
          customer: { externalId: "tenant-dup-conflict", metadata: {} },
          product: { id: "plan-pro" },
          status: "active",
          currentPeriodEnd: "2026-02-01T00:00:00Z",
          cancelAtPeriodEnd: false,
        },
      };

      vi.mocked(mockValidateEvent).mockReturnValue(eventData as never);

      const result = await handler.handle(JSON.stringify(eventData), {
        "webhook-id": "evt-dup-conflict",
      });

      expect(result.success).toBe(true);
      expect(result.eventId).toBe("evt-dup-conflict");
      expect(mockStore.saveSubscription).not.toHaveBeenCalled();
      expect(mockEventPublisher.publishNow).not.toHaveBeenCalled();
      expect(mockStore.reserveWebhook).toHaveBeenCalledTimes(1);
      expect(mockStore.completeWebhook).not.toHaveBeenCalled();
    });

    it.each([
      {
        name: "an unrelated PostgreSQL uniqueness failure",
        error: Object.assign(
          new Error('duplicate key value violates unique constraint "billing_accounts_email_key"'),
          { code: "23505" },
        ),
      },
      {
        name: "generic duplicate wording",
        error: new Error("duplicate webhook event"),
      },
      {
        name: "generic already-exists wording",
        error: new Error("reservation already exists"),
      },
      {
        name: "generic unique-constraint wording",
        error: new Error("unique constraint rejected the reservation"),
      },
      {
        name: "a spoofed typed Problem code",
        error: Object.assign(new Error("spoofed duplicate"), {
          code: "billing/webhook-already-processed",
        }),
      },
    ])("should preserve $name as a retriable reservation failure", async ({ error }) => {
      vi.mocked(mockStore.reserveWebhook).mockRejectedValue(error);
      vi.mocked(mockValidateEvent).mockReturnValue({
        id: "evt-reservation-failure",
        type: "subscription.created",
        data: {
          id: "sub-reservation-failure",
          customer: { externalId: "tenant-reservation-failure", metadata: {} },
          product: { id: "plan-pro" },
          status: "active",
          currentPeriodEnd: "2026-02-01T00:00:00Z",
          cancelAtPeriodEnd: false,
        },
      } as never);

      await expect(
        handler.handle("{}", { "webhook-id": "evt-reservation-failure" }),
      ).rejects.toSatisfy((problem: unknown) => {
        expect(problem).toBeInstanceOf(WebhookProcessingProblem);
        expect(problem).toMatchObject({
          detail: "Webhook processing failed: Webhook reservation failed",
          cause: error,
        });
        expect((problem as WebhookProcessingProblem).toJSON()).toMatchObject({
          detail: "Webhook processing failed: Webhook reservation failed",
        });
        expect(JSON.stringify((problem as WebhookProcessingProblem).toJSON())).not.toContain(
          error.message,
        );
        return true;
      });
      expect(mockStore.saveSubscription).not.toHaveBeenCalled();
      expect(mockEventPublisher.publishNow).not.toHaveBeenCalled();
      expect(mockStore.completeWebhook).not.toHaveBeenCalled();
      expect(mockStore.failWebhook).not.toHaveBeenCalled();
    });

    it("should preserve a non-Error reservation rejection without exposing it", async () => {
      const rejection = { constraint: "billing_accounts_email_key" };
      vi.mocked(mockStore.reserveWebhook).mockRejectedValue(rejection);
      vi.mocked(mockValidateEvent).mockReturnValue({
        id: "evt-non-error-reservation-failure",
        type: "subscription.created",
        data: {
          id: "sub-non-error-reservation-failure",
          customer: { externalId: "tenant-non-error-reservation-failure", metadata: {} },
          product: { id: "plan-pro" },
          status: "active",
          currentPeriodEnd: "2026-02-01T00:00:00Z",
          cancelAtPeriodEnd: false,
        },
      } as never);

      await expect(
        handler.handle("{}", { "webhook-id": "evt-non-error-reservation-failure" }),
      ).rejects.toSatisfy((problem: unknown) => {
        expect(problem).toBeInstanceOf(WebhookProcessingProblem);
        expect(problem).toMatchObject({
          detail: "Webhook processing failed: Webhook reservation failed",
          cause: expect.objectContaining({
            message: "Billing store rejected webhook reservation with a non-Error value",
            cause: rejection,
          }),
        });
        expect(JSON.stringify((problem as WebhookProcessingProblem).toJSON())).not.toContain(
          rejection.constraint,
        );
        return true;
      });
      expect(mockStore.saveSubscription).not.toHaveBeenCalled();
      expect(mockEventPublisher.publishNow).not.toHaveBeenCalled();
      expect(mockStore.completeWebhook).not.toHaveBeenCalled();
      expect(mockStore.failWebhook).not.toHaveBeenCalled();
    });
  });

  describe("subscription 이벤트 처리", () => {
    beforeEach(() => {
      vi.mocked(mockStore.reserveWebhook).mockResolvedValue(undefined);
      vi.mocked(mockStore.completeWebhook).mockResolvedValue(undefined);
      vi.mocked(mockStore.failWebhook).mockResolvedValue(undefined);
    });

    it("subscription.created 이벤트 처리 → store 업데이트 + 이벤트 발행", async () => {
      vi.mocked(mockStore.findSubscription).mockResolvedValue(null);

      const eventData = {
        id: "evt-123",
        type: "subscription.created",
        data: {
          id: "sub-123",
          customer: { externalId: "tenant-123", metadata: {} },
          product: { id: "plan-pro" },
          status: "active",
          currentPeriodEnd: "2026-02-01T00:00:00Z",
          cancelAtPeriodEnd: false,
        },
      };

      vi.mocked(mockValidateEvent).mockReturnValue(eventData as never);

      const body = JSON.stringify(eventData);
      const headers = { "webhook-id": "evt-123" };

      const result = await handler.handle(body, headers);

      expect(result.success).toBe(true);
      expect(mockStore.saveSubscription).toHaveBeenCalled();
      expect(mockEventPublisher.publishNow).toHaveBeenCalled();
      expect(mockStore.reserveWebhook).toHaveBeenCalledWith("evt-123", "subscription.created");
      expect(mockStore.completeWebhook).toHaveBeenCalledWith("evt-123");
    });

    it("subscription.canceled에서 currentPeriodEnd가 null이면 실패 처리", async () => {
      vi.mocked(mockStore.findSubscription).mockResolvedValue(null);

      const eventData = {
        id: "evt-null-period",
        type: "subscription.canceled",
        data: {
          id: "sub-null-period",
          customer: { externalId: "tenant-123", metadata: {} },
          product: { id: "plan-pro" },
          status: "canceled",
          currentPeriodEnd: null,
          cancelAtPeriodEnd: true,
        },
      };

      vi.mocked(mockValidateEvent).mockReturnValue(eventData as never);

      await expect(
        handler.handle(JSON.stringify(eventData), {
          "webhook-id": "evt-null-period",
        }),
      ).rejects.toBeInstanceOf(WebhookProcessingProblem);
      await expect(
        handler.handle(JSON.stringify(eventData), {
          "webhook-id": "evt-null-period",
        }),
      ).rejects.toMatchObject({
        code: "WEBHOOK_PROCESSING_FAILED",
        detail: "Webhook processing failed: currentPeriodEnd is required",
      });
      expect(mockStore.saveSubscription).not.toHaveBeenCalled();
      expect(mockStore.reserveWebhook).not.toHaveBeenCalled();
      expect(mockStore.failWebhook).not.toHaveBeenCalled();
    });

    it("should reject a signed webhook with an unknown subscription status", async () => {
      vi.mocked(mockStore.findSubscription).mockResolvedValue(null);

      const eventData = {
        id: "evt-unknown-status",
        type: "subscription.created",
        data: {
          id: "sub-unknown-status",
          customer: { externalId: "tenant-123", metadata: {} },
          product: { id: "plan-pro" },
          status: "future_status",
          currentPeriodEnd: "2026-02-01T00:00:00Z",
          cancelAtPeriodEnd: false,
        },
      };

      vi.mocked(mockValidateEvent).mockReturnValue(eventData as never);

      await expect(
        handler.handle(JSON.stringify(eventData), {
          "webhook-id": "evt-unknown-status",
        }),
      ).rejects.toBeInstanceOf(WebhookValidationProblem);
      await expect(
        handler.handle(JSON.stringify(eventData), {
          "webhook-id": "evt-unknown-status",
        }),
      ).rejects.toMatchObject({
        code: "WEBHOOK_VALIDATION_FAILED",
        detail: expect.stringContaining("Invalid webhook payload"),
      });
      expect(mockStore.saveSubscription).not.toHaveBeenCalled();
      expect(mockStore.reserveWebhook).not.toHaveBeenCalled();
      expect(mockStore.failWebhook).not.toHaveBeenCalled();
    });

    it("handler 실패 시 reserveWebhook 상태가 fail로 해제되어 재시도 가능", async () => {
      vi.mocked(mockStore.findSubscription).mockResolvedValue(null);
      vi.mocked(mockStore.saveSubscription).mockRejectedValueOnce(
        new Error("temporary store failure"),
      );

      const eventData = {
        id: "evt-retryable-failure",
        type: "subscription.created",
        data: {
          id: "sub-retryable-failure",
          customer: { externalId: "tenant-retryable-failure", metadata: {} },
          product: { id: "plan-pro" },
          status: "active",
          currentPeriodEnd: "2026-02-01T00:00:00Z",
          cancelAtPeriodEnd: false,
        },
      };

      vi.mocked(mockValidateEvent).mockReturnValue(eventData as never);

      const result = await handler.handle(JSON.stringify(eventData), {
        "webhook-id": "evt-retryable-failure",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("temporary store failure");
      expect(mockStore.reserveWebhook).toHaveBeenCalledWith(
        "evt-retryable-failure",
        "subscription.created",
      );
      expect(mockStore.failWebhook).toHaveBeenCalledWith("evt-retryable-failure");
      expect(mockStore.completeWebhook).not.toHaveBeenCalled();
    });
  });

  describe("order 이벤트 처리", () => {
    beforeEach(() => {
      vi.mocked(mockStore.reserveWebhook).mockResolvedValue(undefined);
      vi.mocked(mockStore.completeWebhook).mockResolvedValue(undefined);
    });

    it("order.paid 이벤트 처리 → store 저장 + 이벤트 발행", async () => {
      const eventData = {
        id: "evt-456",
        type: "order.paid",
        data: {
          id: "order-123",
          amount: 9900,
          currency: "USD",
          customer: { externalId: "tenant-123", metadata: {} },
          createdAt: "2026-01-31T00:00:00Z",
        },
      };

      vi.mocked(mockValidateEvent).mockReturnValue(eventData as never);

      const body = JSON.stringify(eventData);
      const headers = { "webhook-id": "evt-456" };

      const result = await handler.handle(body, headers);

      expect(result.success).toBe(true);
      expect(mockStore.saveOrder).toHaveBeenCalledWith({
        id: "order-123",
        billingAccountId: "tenant-123",
        externalOrderId: "order-123",
        amount: 9900,
        currency: "USD",
        reason: "subscription_cycle",
        paidAt: expect.any(Date),
      });
      expect(mockEventPublisher.publishNow).toHaveBeenCalled();
      expect(mockStore.reserveWebhook).toHaveBeenCalledWith("evt-456", "order.paid");
      expect(mockStore.completeWebhook).toHaveBeenCalledWith("evt-456");
    });
  });

  describe("webhook 검증 실패", () => {
    it.each(webhookValidationFailureCases)(
      "should surface stable Problem code and status for $name",
      async ({ message, headers, detail }) => {
        const body = JSON.stringify({ id: headers["webhook-id"], type: "subscription.created" });

        vi.mocked(mockValidateEvent).mockImplementation(() => {
          throw new Error(message);
        });

        const problem = await captureWebhookValidationProblem(() => handler.handle(body, headers));

        expectWebhookValidationProblem(problem, detail);
        expect(mockStore.reserveWebhook).not.toHaveBeenCalled();
        expect(mockStore.saveSubscription).not.toHaveBeenCalled();
        expect(mockStore.completeWebhook).not.toHaveBeenCalled();
        expect(mockStore.failWebhook).not.toHaveBeenCalled();
        expect(mockEventPublisher.publishNow).not.toHaveBeenCalled();
      },
    );

    it("should redact webhook secrets and signature diagnostics from validation Problems", async () => {
      const rawSignature = "v1,leaked-signature";
      const body = JSON.stringify({ id: "evt-redacted", type: "subscription.created" });
      const headers = {
        "webhook-id": "evt-redacted",
        "webhook-signature": rawSignature,
      };

      vi.mocked(mockValidateEvent).mockImplementation(() => {
        throw new Error(
          "Invalid signature: webhookSecret=test-secret webhook-signature=v1,leaked-signature signature=leaked-signature",
        );
      });

      const problem = await captureWebhookValidationProblem(() => handler.handle(body, headers));
      const serializedProblem = JSON.stringify(problem);

      expect(problem.detail).toContain("[redacted]");
      expect(serializedProblem).not.toContain("test-secret");
      expect(serializedProblem).not.toContain("leaked-signature");
      expect(serializedProblem).not.toContain(rawSignature);
      expect(mockStore.reserveWebhook).not.toHaveBeenCalled();
      expect(mockStore.saveSubscription).not.toHaveBeenCalled();
      expect(mockEventPublisher.publishNow).not.toHaveBeenCalled();
    });

    it("이벤트 ID 또는 타입 누락 시 실패", async () => {
      const body = JSON.stringify({});
      const headers = { "webhook-id": "evt-999" };

      vi.mocked(mockValidateEvent).mockReturnValue({
        id: null,
        type: null,
      } as never);

      await expect(handler.handle(body, headers)).rejects.toBeInstanceOf(WebhookValidationProblem);
      await expect(handler.handle(body, headers)).rejects.toMatchObject({
        code: "WEBHOOK_VALIDATION_FAILED",
        detail: expect.stringContaining("Invalid webhook payload"),
      });
    });
  });

  describe("처리 완료 후 completeWebhook 호출", () => {
    it("성공적인 이벤트 처리 후 webhook 처리 기록 저장", async () => {
      vi.mocked(mockStore.findSubscription).mockResolvedValue(null);
      vi.mocked(mockStore.reserveWebhook).mockResolvedValue(undefined);
      vi.mocked(mockStore.completeWebhook).mockResolvedValue(undefined);

      const eventData = {
        id: "evt-999",
        type: "subscription.canceled",
        data: {
          id: "sub-999",
          customer: { externalId: "tenant-999", metadata: {} },
          product: { id: "plan-basic" },
          status: "canceled",
          currentPeriodEnd: "2026-02-01T00:00:00Z",
          cancelAtPeriodEnd: true,
        },
      };

      vi.mocked(mockValidateEvent).mockReturnValue(eventData as never);

      const body = JSON.stringify(eventData);
      const headers = { "webhook-id": "evt-999" };

      const result = await handler.handle(body, headers);

      expect(result.success).toBe(true);
      expect(result.eventId).toBe("evt-999");
      expect(mockStore.reserveWebhook).toHaveBeenCalledTimes(1);
      expect(mockStore.reserveWebhook).toHaveBeenCalledWith("evt-999", "subscription.canceled");
      expect(mockStore.completeWebhook).toHaveBeenCalledTimes(1);
      expect(mockStore.completeWebhook).toHaveBeenCalledWith("evt-999");
    });
  });

  describe("plan version mapping", () => {
    it("fails explicitly before persistence when provider mapping is unknown", async () => {
      vi.mocked(mockStore.findSubscription).mockResolvedValue(null);
      vi.mocked(mockStore.reserveWebhook).mockResolvedValue(undefined);
      vi.mocked(mockStore.failWebhook).mockResolvedValue(undefined);
      vi.mocked(mockPlanRegistry.resolveProviderPlanVersion).mockRejectedValue(
        new UnknownProviderPlanMappingProblem("polar", "unknown-product", ["unknown-price"]),
      );
      vi.mocked(mockValidateEvent).mockReturnValue({
        id: "evt-unknown-plan",
        type: "subscription.created",
        data: {
          id: "sub-unknown-plan",
          customer: { externalId: "tenant-unknown-plan", metadata: {} },
          product: { id: "unknown-product" },
          prices: [{ id: "unknown-price" }],
          status: "active",
          currentPeriodEnd: "2026-02-01T00:00:00Z",
          cancelAtPeriodEnd: false,
        },
      } as never);

      const result = await handler.handle("{}", { "webhook-id": "evt-unknown-plan" });

      expect(result).toMatchObject({
        success: false,
        eventId: "evt-unknown-plan",
        error: expect.stringContaining("billing/unknown-provider-plan-mapping"),
      });
      expect(mockStore.saveSubscription).not.toHaveBeenCalled();
      expect(mockEventPublisher.publishNow).not.toHaveBeenCalled();
      expect(mockStore.failWebhook).toHaveBeenCalledWith("evt-unknown-plan");
    });
  });
});
