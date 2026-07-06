import { createHmac } from "node:crypto";
import type { BillingStore } from "@croco/billing-core";
import type { EventPublisher } from "@croco/events-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PolarWebhookHandler } from "../libs/PolarWebhookHandler";
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
  return {
    publish: vi.fn(),
    publishNow: vi.fn(),
    publishMany: vi.fn(),
  } as unknown as EventPublisher;
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

describe("PolarWebhookHandler SDK-backed webhook verification", () => {
  const webhookSecret = "test-secret";
  const now = new Date("2026-01-31T00:00:00Z");
  let handler!: PolarWebhookHandler;
  let mockStore!: BillingStore;
  let mockEventPublisher!: EventPublisher;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    mockStore = createMockStore();
    mockEventPublisher = createMockEventPublisher();
    const config: PolarConfig = {
      accessToken: "test-token",
      environment: "sandbox",
      webhookSecret,
    };
    handler = new PolarWebhookHandler(config, {
      store: mockStore,
      eventPublisher: mockEventPublisher,
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
    vi.mocked(mockStore.completeWebhook).mockResolvedValue(undefined);
    vi.mocked(mockStore.reserveWebhook)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("duplicate webhook event"));

    const firstResult = await handler.handle(body, headers);
    const replayResult = await handler.handle(body, headers);

    expect(firstResult).toEqual({ success: true, eventId });
    expect(replayResult).toEqual({ success: true, eventId });
    expect(mockStore.reserveWebhook).toHaveBeenCalledTimes(2);
    expect(mockStore.saveSubscription).toHaveBeenCalledTimes(1);
    expect(mockEventPublisher.publishNow).toHaveBeenCalledTimes(1);
    expect(mockStore.completeWebhook).toHaveBeenCalledTimes(1);
    expect(mockStore.failWebhook).not.toHaveBeenCalled();
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
