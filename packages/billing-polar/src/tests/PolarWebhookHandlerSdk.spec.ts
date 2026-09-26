import { createHmac } from "node:crypto";
import { webhookOrderPaidPayloadFromJSON } from "@polar-sh/sdk/models/components/webhookorderpaidpayload.js";
import type { BillingStore, PlanRegistry, PlanVersionDefinition } from "@croco/billing-core";
import {
  InMemoryBillingStore,
  OrderPaidEvent,
  PlanChangedEvent,
  planVersionRef,
  SubscriptionPastDueEvent,
  WebhookAlreadyProcessedProblem,
} from "@croco/billing-core";
import type { DomainEvent, EventPublisher } from "@croco/events-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PolarWebhookHandler } from "../libs/PolarWebhookHandler";
import type { WebhookDependencies } from "../libs/PolarWebhookHandler";
import { WebhookValidationProblem } from "../libs/problems/WebhookValidationProblem";
import { verifyPolarWebhook } from "../libs/verifyPolarWebhook";
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
  vi.spyOn(store, "saveOrder");
  vi.spyOn(store, "findOrdersByAccount");
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

const POLAR_TEAM_PLAN_VERSION = {
  ...POLAR_PLAN_VERSION,
  ref: planVersionRef("plan-team@v1"),
  planId: "plan-team",
  name: "Team",
  amount: 9900,
  providerBindings: [{ provider: "polar", productId: "plan-team", priceIds: [] }],
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

function createSdkSubscriptionEvent(params: {
  readonly eventId: string;
  readonly type: string;
  readonly status: string;
  readonly productId: string;
  readonly modifiedAt: string;
}) {
  const payload = createSdkSubscriptionPayload(params.eventId);
  return {
    ...payload,
    type: params.type,
    data: {
      ...payload.data,
      status: params.status,
      modified_at: params.modifiedAt,
      product_id: params.productId,
      product: { ...payload.data.product, id: params.productId },
    },
  };
}

function signPolarWebhook(params: {
  readonly body: string;
  readonly eventId: string;
  readonly secret: string | Buffer;
  readonly timestamp: number;
}) {
  return `v1,${createHmac("sha256", params.secret)
    .update(`${params.eventId}.${params.timestamp}.${params.body}`)
    .digest("base64")}`;
}

function createSignedHeaders(params: {
  readonly body: string;
  readonly eventId: string;
  readonly secret: string | Buffer;
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

const standardWebhookKey = Buffer.from(Array.from({ length: 32 }, (_, index) => index * 8));
const prefixedWebhookSecret = `whsec_${standardWebhookKey.toString("base64")}`;

describe.each([
  { format: "raw UTF-8", webhookSecret: "test-secret", signingKey: "test-secret" },
  {
    format: "Base64-looking raw UTF-8",
    webhookSecret: "dGVzdC1zZWNyZXQ=",
    signingKey: "dGVzdC1zZWNyZXQ=",
  },
  {
    format: "whsec_ Base64",
    webhookSecret: prefixedWebhookSecret,
    signingKey: standardWebhookKey,
  },
  {
    format: "legacy whsec_ UTF-8",
    webhookSecret: prefixedWebhookSecret,
    signingKey: prefixedWebhookSecret,
  },
])("PolarWebhookHandler $format signature verification", ({ webhookSecret, signingKey }) => {
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

  it.each(["string", "Buffer"])(
    "should verify a signed %s replay and preserve idempotent side effects",
    async (bodyType) => {
      const eventId = "evt-sdk-replay";
      const body = JSON.stringify(createSdkSubscriptionPayload(eventId));
      const timestamp = Math.floor(now.getTime() / 1000);
      const headers = createSignedHeaders({ body, eventId, secret: signingKey, timestamp });
      const requestBody = bodyType === "Buffer" ? Buffer.from(body) : body;

      vi.mocked(mockStore.findSubscription).mockResolvedValue(null);
      vi.mocked(mockStore.reserveWebhook)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new WebhookAlreadyProcessedProblem(eventId));

      const firstResult = await handler.handle(requestBody, headers);
      const replayResult = await handler.handle(requestBody, headers);

      expect(firstResult).toEqual({ success: true, eventId });
      expect(replayResult).toEqual({ success: true, eventId });
      expect(mockStore.reserveWebhook).not.toHaveBeenCalled();
      expect(mockStore.saveSubscription).toHaveBeenCalledTimes(1);
      expect(mockEventPublisher.publishNow).toHaveBeenCalledTimes(1);
      expect(mockStore.completeWebhook).toHaveBeenCalledTimes(1);
      expect(mockStore.failWebhook).not.toHaveBeenCalled();
    },
  );

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
    const headers = createSignedHeaders({ body, eventId, secret: signingKey, timestamp });

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
    const headers = createSignedHeaders({ body, eventId, secret: signingKey, timestamp });

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

  it.each(["tampered payload", "wrong signing key"])(
    "should reject a %s before billing side effects",
    async (failure) => {
      const eventId = "evt-sdk-tampered";
      const payload = createSdkSubscriptionPayload(eventId);
      const body = JSON.stringify(payload);
      const timestamp = Math.floor(now.getTime() / 1000);
      const headers = createSignedHeaders({
        body,
        eventId,
        secret: failure === "wrong signing key" ? "wrong-secret" : signingKey,
        timestamp,
      });
      const requestBody =
        failure === "tampered payload"
          ? JSON.stringify({ ...payload, data: { ...payload.data, amount: 1 } })
          : body;

      await expect(handler.handle(requestBody, headers)).rejects.toSatisfy((problem: unknown) => {
        expectWebhookValidationProblem(
          problem,
          "Webhook validation failed: No matching signature found",
        );
        return true;
      });
      expect(mockPlanRegistry.resolveProviderPlanVersion).not.toHaveBeenCalled();
      expect(mockStore.commitSubscriptionWebhook).not.toHaveBeenCalled();
      expect(mockStore.reserveWebhook).not.toHaveBeenCalled();
      expect(mockStore.saveSubscription).not.toHaveBeenCalled();
      expect(mockStore.completeWebhook).not.toHaveBeenCalled();
      expect(mockStore.failWebhook).not.toHaveBeenCalled();
      expect(mockEventPublisher.publishNow).not.toHaveBeenCalled();
    },
  );

  it("should preserve a JSON parsing error after authenticating the payload", () => {
    const eventId = "evt-invalid-json";
    const body = "{";
    const timestamp = Math.floor(now.getTime() / 1000);
    const headers = createSignedHeaders({ body, eventId, secret: signingKey, timestamp });

    expect(() => verifyPolarWebhook(body, headers, webhookSecret)).toThrow(SyntaxError);
  });
});

describe("PolarWebhookHandler subscription webhook ordering", () => {
  const now = new Date("2026-01-31T00:00:00Z");
  const webhookSecret = "test-secret";
  let store!: InMemoryBillingStore;
  let published!: DomainEvent[];
  let handler!: PolarWebhookHandler;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    store = new InMemoryBillingStore();
    published = [];
    const planRegistry = createMockPlanRegistry();
    vi.mocked(planRegistry.resolveProviderPlanVersion).mockImplementation(async ({ productId }) =>
      productId === "plan-team" ? POLAR_TEAM_PLAN_VERSION : POLAR_PLAN_VERSION,
    );
    const publish = async (event: DomainEvent) => {
      published.push(event);
    };
    handler = new PolarWebhookHandler(
      { accessToken: "test-token", environment: "sandbox", webhookSecret },
      {
        store,
        eventPublisher: { publishNow: publish, publishIdempotently: publish },
        planRegistry,
      },
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function deliver(event: ReturnType<typeof createSdkSubscriptionEvent>) {
    const body = JSON.stringify(event);
    const timestamp = Math.floor(now.getTime() / 1000);
    return handler.handle(
      body,
      createSignedHeaders({ body, eventId: event.id, secret: webhookSecret, timestamp }),
    );
  }

  it("should reject a subscription payload without created_at", async () => {
    const eventId = "evt-missing-created-at";
    const payload = createSdkSubscriptionPayload(eventId);
    const body = JSON.stringify({
      ...payload,
      data: { ...payload.data, created_at: undefined },
    });
    const timestamp = Math.floor(now.getTime() / 1000);

    await expect(
      handler.handle(
        body,
        createSignedHeaders({ body, eventId, secret: webhookSecret, timestamp }),
      ),
    ).rejects.toSatisfy((problem: unknown) => {
      expect(problem).toBeInstanceOf(WebhookValidationProblem);
      expect(problem).toMatchObject({ detail: expect.stringContaining("createdAt") });
      return true;
    });
    expect(await store.findSubscription("tenant-sdk-replay")).toBeNull();
    expect(published).toEqual([]);
  });

  it("should keep a newer revocation when an older subscription.updated is redelivered later", async () => {
    await deliver(
      createSdkSubscriptionEvent({
        eventId: "evt-created",
        type: "subscription.created",
        status: "active",
        productId: "plan-pro",
        modifiedAt: "2026-01-01T00:00:00Z",
      }),
    );
    await deliver(
      createSdkSubscriptionEvent({
        eventId: "evt-revoked",
        type: "subscription.revoked",
        status: "revoked",
        productId: "plan-pro",
        modifiedAt: "2026-01-10T10:00:00Z",
      }),
    );
    const publishedBeforeOlderUpdate = published.length;

    const result = await deliver(
      createSdkSubscriptionEvent({
        eventId: "evt-updated-older",
        type: "subscription.updated",
        status: "active",
        productId: "plan-pro",
        modifiedAt: "2026-01-10T09:00:00Z",
      }),
    );

    expect(result).toEqual({ success: true, eventId: "evt-updated-older" });
    expect((await store.findSubscription("tenant-sdk-replay"))?.status).toBe("revoked");
    expect(published).toHaveLength(publishedBeforeOlderUpdate);
  });

  it("should keep a newer plan change when an older subscription.updated is redelivered later", async () => {
    await deliver(
      createSdkSubscriptionEvent({
        eventId: "evt-created",
        type: "subscription.created",
        status: "active",
        productId: "plan-pro",
        modifiedAt: "2026-01-01T00:00:00Z",
      }),
    );
    await deliver(
      createSdkSubscriptionEvent({
        eventId: "evt-upgraded",
        type: "subscription.updated",
        status: "active",
        productId: "plan-team",
        modifiedAt: "2026-01-10T10:00:00Z",
      }),
    );

    await deliver(
      createSdkSubscriptionEvent({
        eventId: "evt-updated-older",
        type: "subscription.updated",
        status: "active",
        productId: "plan-pro",
        modifiedAt: "2026-01-10T09:00:00Z",
      }),
    );

    expect((await store.findSubscription("tenant-sdk-replay"))?.planId).toBe("plan-team");
    expect(
      published
        .filter((event): event is PlanChangedEvent => event instanceof PlanChangedEvent)
        .map(({ previousPlanId, newPlanId }) => [previousPlanId, newPlanId]),
    ).toEqual([["plan-pro", "plan-team"]]);
  });
});

function createSdkOrderPaidPayload(netAmount?: number) {
  const timestamp = "2026-01-31T00:00:00Z";
  return {
    type: "order.paid",
    timestamp,
    data: {
      id: "order-sdk-1",
      created_at: timestamp,
      modified_at: null,
      status: "paid",
      paid: true,
      subtotal_amount: 2900,
      discount_amount: 0,
      net_amount: netAmount,
      tax_amount: 290,
      total_amount: 3190,
      applied_balance_amount: 0,
      due_amount: 0,
      refunded_amount: 0,
      refunded_tax_amount: 0,
      currency: "usd",
      billing_reason: "subscription_create",
      billing_name: null,
      billing_address: null,
      invoice_number: "INV-1",
      is_invoice_generated: false,
      receipt_number: null,
      customer_id: "cus-sdk",
      product_id: "plan-pro",
      discount_id: null,
      subscription_id: "sub-sdk",
      checkout_id: null,
      metadata: {},
      platform_fee_amount: 0,
      platform_fee_currency: null,
      customer: {
        id: "cus-sdk",
        created_at: timestamp,
        modified_at: null,
        metadata: {},
        external_id: "tenant-sdk",
        email: "sdk@example.com",
        email_verified: true,
        type: "individual",
        name: null,
        billing_name: null,
        billing_address: null,
        tax_id: null,
        organization_id: "org-sdk",
        deleted_at: null,
        avatar_url: "",
      },
      product: {
        metadata: {},
        id: "plan-pro",
        created_at: timestamp,
        modified_at: null,
        trial_interval: null,
        trial_interval_count: null,
        name: "Pro",
        description: null,
        visibility: "public",
        recurring_interval: "month",
        recurring_interval_count: 1,
        meter_interval: null,
        meter_interval_count: null,
        is_recurring: true,
        is_archived: false,
        organization_id: "org-sdk",
      },
      discount: null,
      subscription: null,
      items: [
        {
          created_at: timestamp,
          modified_at: null,
          id: "item-1",
          label: "Pro",
          amount: 2900,
          tax_amount: 290,
          proration: false,
          product_price_id: "price-1",
        },
      ],
      description: "Pro",
      refundable_amount: 2900,
      refundable_tax_amount: 290,
    },
  };
}

describe("PolarWebhookHandler order.paid with the Polar SDK Order shape", () => {
  const now = new Date("2026-01-31T00:00:00Z");
  const webhookSecret = "test-secret";
  const signingKey = "test-secret";

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createHandler(
    store: BillingStore,
    eventPublisher: WebhookDependencies["eventPublisher"],
  ): PolarWebhookHandler {
    const config: PolarConfig = {
      accessToken: "test-token",
      environment: "sandbox",
      webhookSecret,
    };
    return new PolarWebhookHandler(config, {
      store,
      eventPublisher,
      planRegistry: createMockPlanRegistry(),
    });
  }

  function signPayload(payload: unknown, eventId: string) {
    const body = JSON.stringify(payload);
    const timestamp = Math.floor(now.getTime() / 1000);
    return {
      body,
      headers: createSignedHeaders({ body, eventId, secret: signingKey, timestamp }),
    };
  }

  it("persists net_amount as the order and OrderPaidEvent amount for an SDK-valid payload without amount", async () => {
    const payload = createSdkOrderPaidPayload(2900);
    expect(payload.data).not.toHaveProperty("amount");
    const store = createMockStore();
    const eventPublisher = createMockEventPublisher();
    const handler = createHandler(store, eventPublisher);
    const { body, headers } = signPayload(payload, "evt-sdk-order-paid");

    expect(webhookOrderPaidPayloadFromJSON(body).ok).toBe(true);

    await expect(handler.handle(body, headers)).resolves.toEqual({
      success: true,
      eventId: "evt-sdk-order-paid",
    });

    const orders = await store.findOrdersByAccount("tenant-sdk");
    expect(orders.map(({ id, amount }) => ({ id, amount }))).toEqual([
      { id: "order-sdk-1", amount: 2900 },
    ]);
    expect(eventPublisher.publishIdempotently).toHaveBeenCalledWith(expect.any(OrderPaidEvent));
    expect(eventPublisher.publishIdempotently).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 2900, externalOrderId: "order-sdk-1" }),
    );
  });

  it("persists and publishes a zero net_amount order", async () => {
    const payload = createSdkOrderPaidPayload(0);
    const store = createMockStore();
    const eventPublisher = createMockEventPublisher();
    const handler = createHandler(store, eventPublisher);
    const { body, headers } = signPayload(payload, "evt-sdk-order-zero");

    expect(webhookOrderPaidPayloadFromJSON(body).ok).toBe(true);

    await expect(handler.handle(body, headers)).resolves.toEqual({
      success: true,
      eventId: "evt-sdk-order-zero",
    });

    expect(await store.findOrdersByAccount("tenant-sdk")).toEqual([
      expect.objectContaining({ id: "order-sdk-1", amount: 0 }),
    ]);
    expect(eventPublisher.publishIdempotently).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 0, externalOrderId: "order-sdk-1" }),
    );
  });

  it.each([
    { name: "missing net_amount", netAmount: undefined },
    { name: "negative net_amount", netAmount: -1 },
    { name: "fractional net_amount", netAmount: 2900.5 },
    {
      name: "missing net_amount with a valid camelCase netAmount alias",
      netAmount: undefined,
      camelCaseNetAmount: 2900,
    },
    {
      name: "negative net_amount with a valid camelCase netAmount alias",
      netAmount: -1,
      camelCaseNetAmount: 2900,
    },
    {
      name: "fractional net_amount with a valid camelCase netAmount alias",
      netAmount: 2900.5,
      camelCaseNetAmount: 2900,
    },
  ])(
    "rejects a signed order.paid with $name as a validation Problem without side effects",
    async ({ netAmount, camelCaseNetAmount }) => {
      const payload = createSdkOrderPaidPayload(2900);
      if (netAmount === undefined) {
        delete payload.data.net_amount;
      } else {
        payload.data.net_amount = netAmount;
      }
      if (camelCaseNetAmount !== undefined) {
        (payload.data as Record<string, unknown>).netAmount = camelCaseNetAmount;
      }
      const store = createMockStore();
      const eventPublisher = createMockEventPublisher();
      const handler = createHandler(store, eventPublisher);
      const { body, headers } = signPayload(payload, `evt-sdk-order-invalid`);

      await expect(handler.handle(body, headers)).rejects.toSatisfy((problem: unknown) => {
        expectWebhookValidationProblem(problem, expect.stringContaining("netAmount"));
        return true;
      });
      expect(store.saveOrder).not.toHaveBeenCalled();
      expect(eventPublisher.publishIdempotently).not.toHaveBeenCalled();
      expect(store.completeWebhook).not.toHaveBeenCalled();
    },
  );
});

it("should not interpret a legacy prefix-only secret as an empty signing key", () => {
  const eventId = "evt-empty-key";
  const body = JSON.stringify({ id: eventId });
  const timestamp = Math.floor(Date.now() / 1000);
  const legacyHeaders = createSignedHeaders({ body, eventId, secret: "whsec_", timestamp });
  const emptyKeyHeaders = createSignedHeaders({
    body,
    eventId,
    secret: Buffer.alloc(0),
    timestamp,
  });

  expect(verifyPolarWebhook(body, legacyHeaders, "whsec_")).toEqual({ id: eventId });
  expect(() => verifyPolarWebhook(body, emptyKeyHeaders, "whsec_")).toThrow(
    "No matching signature found",
  );
});
