import { describe, expect, it } from "vitest";

import {
  assertWebhookOperationsActionRequest,
  createWebhookDeliveryAction,
  createWebhookEndpointCreationAction,
  createWebhookEndpointActions,
  executeWebhookOperationsAction,
  filterWebhookDeliveries,
  maskWebhookEndpointUrl,
  redactWebhookOperationsText,
  WebhookOperationsActionValidationProblem,
  type WebhookEndpointOperationsRow,
  type WebhookOperationsMutationExecutor,
  type WebhookOperationsReadyState,
} from "../index";

const now = new Date("2026-07-26T00:00:00.000Z");
const endpoint: WebhookEndpointOperationsRow = {
  id: "endpoint-1",
  tenantId: "tenant-1",
  maskedUrl: "https://hooks.example.com",
  subscriptions: [{ name: "order.created", schemaVersion: "v1" }],
  status: "active",
  successRate: 0.98,
  secret: {
    activeVersion: "secret-v2",
    previousVersion: "secret-v1",
    previousValidUntil: new Date("2026-07-27T00:00:00.000Z"),
  },
};

const state: WebhookOperationsReadyState = {
  kind: "ready",
  tenantId: "tenant-1",
  generatedAt: now,
  endpoints: [endpoint],
  events: [
    {
      id: "event-1",
      tenantId: "tenant-1",
      name: "order.created",
      schemaVersion: "v1",
      subject: "order-42",
      occurredAt: now,
      committedAt: now,
    },
  ],
  deliveries: [
    {
      id: "delivery-1",
      eventId: "event-1",
      endpointId: endpoint.id,
      tenantId: "tenant-1",
      status: "dead",
      attemptCount: 3,
      createdAt: now,
      updatedAt: now,
      problem: { code: "webhooks-core/outbound-permanent-failure" },
      replay: {
        allowed: true,
        reason: "Core delivery state allows replay",
      },
    },
  ],
  attempts: [],
  actions: [],
};

describe("outbound webhook operations contracts", () => {
  it("masks URL credentials and query values without accepting secret material", () => {
    expect(
      maskWebhookEndpointUrl("https://user:password@hooks.example.com/orders?token=secret"),
    ).toBe("https://hooks.example.com");
    expect(JSON.stringify(endpoint)).not.toContain("password");
    expect(JSON.stringify(endpoint)).not.toContain("material");
  });

  it("redacts hostile header, credential, and secret fixtures before diagnostics are rendered", () => {
    const hostile =
      'upstream Authorization: ApiKey super-secret\nProxy-Authorization: Digest digest-value\nCookie: first=one; second=two\nSet-Cookie: session=three; HttpOnly\nsecret="plain" token=tok';
    const redacted = redactWebhookOperationsText(hostile);

    expect(redacted).not.toContain("super-secret");
    expect(redacted).not.toContain("digest-value");
    expect(redacted).not.toContain("first=one");
    expect(redacted).not.toContain("second=two");
    expect(redacted).not.toContain("session=three");
    expect(redacted).not.toContain("plain");
    expect(redacted).not.toContain("tok");
    expect(redacted).toContain("[redacted");
  });

  it("exposes endpoint actions with explicit pause and rotation semantics", () => {
    const actions = createWebhookEndpointActions(
      endpoint,
      ["webhooks:write", "webhooks:secrets:rotate"],
      now,
    );

    expect(actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "pause-endpoint",
          allowed: true,
          reason: expect.stringContaining("not canceled"),
        }),
        expect.objectContaining({
          kind: "rotate-secret",
          allowed: true,
          reason: expect.stringContaining("presented once"),
        }),
        expect.objectContaining({
          kind: "revoke-previous-secret",
          allowed: true,
        }),
      ]),
    );
  });

  it("requires write permission before creating an endpoint with a one-time secret", () => {
    expect(createWebhookEndpointCreationAction("tenant-1", ["webhooks:write"])).toMatchObject({
      allowed: true,
      auditEvent: "webhook.create-endpoint",
      kind: "create-endpoint",
      reason: expect.stringContaining("one-time secret"),
      targetId: "tenant-1",
    });
    expect(createWebhookEndpointCreationAction("tenant-1", [])).toMatchObject({
      allowed: false,
      permission: "webhooks:write",
    });
  });

  it.each(["pending", "retrying", "accepted"] as const)(
    "does not expose replay for unsafe %s deliveries",
    (status) => {
      const action = createWebhookDeliveryAction(
        {
          ...deliveryFixture(),
          status,
          replay: { allowed: true, reason: "Hostile caller-forged replay flag" },
        },
        endpoint,
        ["webhooks:replay"],
      );

      expect(action).toMatchObject({
        allowed: false,
        kind: "replay-delivery",
        reason: expect.stringContaining("not replayable"),
      });
    },
  );

  it("allows an auditable replay of the same logical event for core-declared safe states", () => {
    expect(
      createWebhookDeliveryAction(deliveryFixture(), endpoint, ["webhooks:replay"]),
    ).toMatchObject({
      allowed: true,
      kind: "replay-delivery",
      targetId: "delivery-1",
      reason: expect.stringContaining("existing logical event"),
    });
  });

  it("keeps acceptance-unknown replay disabled unless the core contract explicitly allows it", () => {
    const acceptanceUnknown = {
      ...deliveryFixture(),
      status: "acceptance-unknown" as const,
      replay: undefined,
    };

    expect(
      createWebhookDeliveryAction(acceptanceUnknown, endpoint, ["webhooks:replay"]),
    ).toMatchObject({
      allowed: false,
      reason: expect.stringContaining("did not declare"),
    });
    expect(
      createWebhookDeliveryAction(
        {
          ...acceptanceUnknown,
          replay: { allowed: true, reason: "Core replay contract allows terminal recovery" },
        },
        endpoint,
        ["webhooks:replay"],
      ),
    ).toMatchObject({
      allowed: true,
      targetId: "delivery-1",
    });
  });

  it("requires actor, reason, and idempotency evidence for every write", () => {
    const complete = {
      action: "replay-delivery",
      actorId: "operator-1",
      idempotencyKey: "replay-1",
      reason: "Provider confirmed no receipt",
      targetId: "delivery-1",
      tenantId: "tenant-1",
    } as const;

    expect(assertWebhookOperationsActionRequest(complete)).toBe(complete);
    for (const field of ["actorId", "reason", "idempotencyKey"] as const) {
      expect(() => assertWebhookOperationsActionRequest({ ...complete, [field]: " " })).toThrow(
        WebhookOperationsActionValidationProblem,
      );
    }
  });

  it("binds permitted writes to tenant, target, action, audit, and idempotency execution", async () => {
    const action = createWebhookDeliveryAction(deliveryFixture(), endpoint, ["webhooks:replay"]);
    const request = {
      action: "replay-delivery",
      actorId: "operator-1",
      idempotencyKey: "replay-1",
      reason: "Provider confirmed no receipt",
      targetId: "delivery-1",
      tenantId: "tenant-1",
    } as const;
    const executor: WebhookOperationsMutationExecutor<string> = {
      execute: async (input) => input.request.idempotencyKey,
    };

    await expect(
      executeWebhookOperationsAction({
        action,
        executor,
        expectedTenantId: "tenant-1",
        grantedPermissions: ["webhooks:replay"],
        request,
      }),
    ).resolves.toBe("replay-1");
    await expect(
      executeWebhookOperationsAction({
        action,
        executor,
        expectedTenantId: "tenant-2",
        grantedPermissions: ["webhooks:replay"],
        request,
      }),
    ).rejects.toBeInstanceOf(WebhookOperationsActionValidationProblem);
  });

  it("filters delivery evidence through the matching logical event without mixing attempts", () => {
    expect(
      filterWebhookDeliveries(state, {
        tenantId: "tenant-1",
        eventName: "order.created",
        schemaVersion: "v1",
        subject: "order-42",
        states: ["dead"],
        problemCode: "webhooks-core/outbound-permanent-failure",
      }),
    ).toEqual(state.deliveries);
    expect(
      filterWebhookDeliveries(state, {
        tenantId: "tenant-1",
        eventName: "order.updated",
      }),
    ).toEqual([]);
  });
});

function deliveryFixture() {
  const [delivery] = state.deliveries;
  if (delivery === undefined) {
    throw new Error("Expected the state fixture to include a delivery");
  }
  return delivery;
}
