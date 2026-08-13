import { createHmac } from "node:crypto";
import type { BillingStore, PlanRegistry, PlanVersionDefinition } from "@croco/billing-core";
import {
  InMemoryBillingStore,
  planVersionRef,
  SubscriptionPastDueEvent,
  WebhookAlreadyProcessedProblem,
} from "@croco/billing-core";
import type { EventPublisher } from "@croco/events-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PolarWebhookHandler } from "../libs/PolarWebhookHandler";
import type { WebhookDependencies } from "../libs/PolarWebhookHandler";
import { WebhookValidationProblem } from "../libs/problems/WebhookValidationProblem";
import type { PolarConfig } from "../types";

function createMockStore(): BillingStore {
  const store = new InMemoryBillingStore();
  vi.spyOn(store, "findSubscription");
  vi.spyOn(store, "saveSubscription");
  vi.spyOn(store, "commitSubscriptionWebhook");
  vi.spyOn(store, "markWebhookEventIntentPublished");
  vi.spyOn(store, "claimWebhookDelivery");
  vi.spyOn(store, "completeWebhookDelivery");
  vi.spyOn(store, "releaseWebhookDelivery");
  vi.spyOn(store, "reserveWebhook");
  vi.spyOn(store, "completeWebhook");
  vi.spyOn(store, "failWebhook");
  return store;
}

function createMockEventPublisher() {
  const publish = vi.fn();
  return {
    publish: vi.fn(),
    publishNow: publish,
    publishMany: vi.fn(),
    publishIdempotently: publish,
  } as unknown as WebhookDependencies["eventPublisher"] & EventPublisher;
}

const POLAR_PLAN_VERSION = {
  ref: planVersionRef("plan-pro@v1"),
  planId: "plan-pro",
  versionId: "v1",
  effectiveAt: "2026-01-01T00:00:00.000Z",
  name: "Pro",
  amount: 2900,
  currency: "USD",
  interval: "month",
  intervalCount: 1,
  rating: { mode: "provider", provider: "polar" },
  quantityPolicy: {
    minimumQuantity: 1,
    includedSeats: 0,
    seatQuota: 100,
    billableMembershipRoles: ["owner", "admin", "member"],
  },
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

function createSdkSubscriptionPayload(eventId: string) {
  return {
    id: eventId,
    type: "subscription.created",
    data: {
      created_at: "2026-01-01T00:00:00Z",
      modified_at: null,
      id: "sub-sdk-replay",
      amount: 2900,
      currency: "usd",
      recurring_interval: "month",
      status: "active",
      current_period_start: "2026-01-01T00:00:00Z",
      current_period_end: "2026-02-01T00:00:00Z",
      cancel_at_period_end: false,
      canceled_at: null,
      started_at: "2026-01-01T00:00:00Z",
      ends_at: null,
      ended_at: null,
      customer_id: "cus-sdk",
      product_id: "plan-pro",
      discount_id: null,
      checkout_id: null,
      customer_cancellation_reason: null,
      customer_cancellation_comment: null,
      metadata: {},
      customer: {
        id: "cus-sdk",
        created_at: "2026-01-01T00:00:00Z",
        modified_at: null,
        metadata: {},
        external_id: "tenant-sdk-replay",
        email: "sdk@example.com",
        email_verified: true,
        name: null,
        billing_address: null,
        tax_id: null,
        organization_id: "org-sdk",
        deleted_at: null,
        avatar_url: "",
      },
      product: {
        created_at: "2026-01-01T00:00:00Z",
        modified_at: null,
        id: "plan-pro",
        name: "Pro",
        description: null,
        recurring_interval: "month",
        is_recurring: true,
        is_archived: false,
        organization_id: "org-sdk",
        metadata: {},
        prices: [],
        benefits: [],
        medias: [],
        attached_custom_fields: [],
      },
      discount: null,
      prices: [],
      meters: [],
    },
  };
}

function signPolarWebhook(params: {
  readonly body: string;
  readonly eventId: string;
  readonly secret: string;
  readonly timestamp: number;
}) {
  return `v1,${createHmac("sha256", params.secret)
    .update(`${params.eventId}.${params.timestamp}.${params.body}`)
    .digest("base64")}`;
}

function createSignedHeaders(params: {
  readonly body: string;
  readonly eventId: string;
  readonly secret: string;
  readonly timestamp: number;
}) {
  return {
    "webhook-id": params.eventId,
    "webhook-timestamp": String(params.timestamp),
    "webhook-signature": signPolarWebhook(params),
  };
}

function expectWebhookValidationProblem(
  problem: unknown,
  detail: string,
): asserts problem is WebhookValidationProblem {
  expect(problem).toBeInstanceOf(WebhookValidationProblem);
  expect(problem).toMatchObject({
    code: "WEBHOOK_VALIDATION_FAILED",
    detail,
    status: 400,
  });
}

describe("PolarWebhookHandler Standard Webhooks signature verification", () => {
  const webhookSecret = "test-secret";
  const now = new Date("2026-01-31T00:00:00Z");
  let handler!: PolarWebhookHandler;
  let mockStore!: BillingStore;
  let mockEventPublisher!: WebhookDependencies["eventPublisher"];
  let mockPlanRegistry!: PlanRegistry;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    mockStore = createMockStore();
    mockEventPublisher = createMockEventPublisher();
    mockPlanRegistry = createMockPlanRegistry();
    const config: PolarConfig = {
      accessToken: "test-token",
      environment: "sandbox",
      webhookSecret,
    };
    handler = new PolarWebhookHandler(config, {
      store: mockStore,
      eventPublisher: mockEventPublisher,
      planRegistry: mockPlanRegistry,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should verify a real SDK signed replay and preserve idempotent side effects", async () => {
    const eventId = "evt-sdk-replay";
    const body = JSON.stringify(createSdkSubscriptionPayload(eventId));
    const timestamp = Math.floor(now.getTime() / 1000);
    const headers = createSignedHeaders({ body, eventId, secret: webhookSecret, timestamp });

    vi.mocked(mockStore.findSubscription).mockResolvedValue(null);
    vi.mocked(mockStore.reserveWebhook)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new WebhookAlreadyProcessedProblem(eventId));

    const firstResult = await handler.handle(body, headers);
    const replayResult = await handler.handle(body, headers);

    expect(firstResult).toEqual({ success: true, eventId });
    expect(replayResult).toEqual({ success: true, eventId });
    expect(mockStore.reserveWebhook).not.toHaveBeenCalled();
    expect(mockStore.saveSubscription).toHaveBeenCalledTimes(1);
    expect(mockEventPublisher.publishNow).toHaveBeenCalledTimes(1);
    expect(mockStore.completeWebhook).toHaveBeenCalledTimes(1);
    expect(mockStore.failWebhook).not.toHaveBeenCalled();
  });

  it("should verify and publish a directly signed subscription.past_due event", async () => {
    const eventId = "evt-sdk-past-due";
    const createdPayload = createSdkSubscriptionPayload(eventId);
    const payload = {
      ...createdPayload,
      type: "subscription.past_due",
      data: {
        ...createdPayload.data,
        status: "past_due",
      },
    };
    const body = JSON.stringify(payload);
    const timestamp = Math.floor(now.getTime() / 1000);
    const headers = createSignedHeaders({ body, eventId, secret: webhookSecret, timestamp });

    vi.mocked(mockStore.findSubscription).mockResolvedValue(null);
    vi.mocked(mockStore.reserveWebhook).mockResolvedValue(undefined);
    vi.mocked(mockStore.completeWebhook).mockResolvedValue(undefined);

    const result = await handler.handle(body, headers);

    expect(result).toEqual({ success: true, eventId });
    expect(mockEventPublisher.publishNow).toHaveBeenCalledWith(
      expect.any(SubscriptionPastDueEvent),
    );
    expect(mockStore.claimWebhookDelivery).toHaveBeenCalledWith(
      "croco:billing:polar:subscription:sub-sdk-replay:past_due",
      "billing.subscription_past_due",
      30_000,
    );
  });

  it("should map a real SDK stale timestamp rejection to a stable validation Problem", async () => {
    const eventId = "evt-sdk-stale";
    const body = JSON.stringify(createSdkSubscriptionPayload(eventId));
    const timestamp = Math.floor(now.getTime() / 1000) - 301;
    const headers = createSignedHeaders({ body, eventId, secret: webhookSecret, timestamp });

    await expect(handler.handle(body, headers)).rejects.toSatisfy((problem: unknown) => {
      expectWebhookValidationProblem(
        problem,
        "Webhook validation failed: Message timestamp too old",
      );
      return true;
    });
    expect(mockStore.reserveWebhook).not.toHaveBeenCalled();
    expect(mockStore.saveSubscription).not.toHaveBeenCalled();
    expect(mockStore.completeWebhook).not.toHaveBeenCalled();
    expect(mockStore.failWebhook).not.toHaveBeenCalled();
    expect(mockEventPublisher.publishNow).not.toHaveBeenCalled();
  });

  it("should map a real SDK invalid signature rejection to a stable validation Problem", async () => {
    const eventId = "evt-sdk-invalid-signature";
    const body = JSON.stringify(createSdkSubscriptionPayload(eventId));
    const timestamp = Math.floor(now.getTime() / 1000);
    const headers = {
      "webhook-id": eventId,
      "webhook-timestamp": String(timestamp),
      "webhook-signature": "v1,invalid-signature",
    };

    await expect(handler.handle(body, headers)).rejects.toSatisfy((problem: unknown) => {
      expectWebhookValidationProblem(
        problem,
        "Webhook validation failed: No matching signature found",
      );
      return true;
    });
    expect(mockStore.reserveWebhook).not.toHaveBeenCalled();
    expect(mockStore.saveSubscription).not.toHaveBeenCalled();
    expect(mockStore.completeWebhook).not.toHaveBeenCalled();
    expect(mockStore.failWebhook).not.toHaveBeenCalled();
    expect(mockEventPublisher.publishNow).not.toHaveBeenCalled();
  });
});
