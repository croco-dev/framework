import { describe, expect, it } from "vitest";
import { createWebhookEventRouter, WebhookGatewayConfigurationProblem } from "../index";

type FixtureEvents = {
  "subscription.created": {
    payload: { subscriptionId: string };
    result: { savedId: string };
  };
};

describe("WebhookEventRouter", () => {
  it("dispatches typed handlers by event type", async () => {
    const router = createWebhookEventRouter<FixtureEvents>().register(
      "subscription.created",
      (event) => ({ savedId: event.payload.subscriptionId }),
    );

    const result = await router.dispatch(
      {
        id: "evt-1",
        provider: "fixture",
        type: "subscription.created",
        payload: { subscriptionId: "sub-1" },
      },
      {
        provider: "fixture",
        eventId: "evt-1",
        eventType: "subscription.created",
        rawBody: "{}",
        headers: {},
        receivedAt: new Date("2026-06-21T00:00:00.000Z"),
        replay: false,
        idempotencyKey: {
          key: "key",
          fingerprint: "fingerprint",
          namespace: "webhook",
          tenantId: null,
          scope: "global",
          source: "provider-event",
          storageKey: "webhook:global:global:provider-event:key",
          telemetryAttributes: {
            "croco.idempotency.key": "key",
            "croco.idempotency.namespace": "webhook",
            "croco.idempotency.scope": "global",
            "croco.idempotency.source": "provider-event",
            "croco.idempotency.fingerprint": "fingerprint",
          },
        },
      },
    );

    expect(result).toEqual({ savedId: "sub-1" });
  });

  it("throws a stable Problem when dispatched directly without a registered handler", async () => {
    const router = createWebhookEventRouter<FixtureEvents>();

    await expect(
      router.dispatch(
        {
          id: "evt-1",
          provider: "fixture",
          type: "subscription.created",
          payload: { subscriptionId: "sub-1" },
        },
        {
          provider: "fixture",
          eventId: "evt-1",
          eventType: "subscription.created",
          rawBody: "{}",
          headers: {},
          receivedAt: new Date("2026-06-21T00:00:00.000Z"),
          replay: false,
          idempotencyKey: {
            key: "key",
            fingerprint: "fingerprint",
            namespace: "webhook",
            tenantId: null,
            scope: "global",
            source: "provider-event",
            storageKey: "webhook:global:global:provider-event:key",
            telemetryAttributes: {
              "croco.idempotency.key": "key",
              "croco.idempotency.namespace": "webhook",
              "croco.idempotency.scope": "global",
              "croco.idempotency.source": "provider-event",
              "croco.idempotency.fingerprint": "fingerprint",
            },
          },
        },
      ),
    ).rejects.toBeInstanceOf(WebhookGatewayConfigurationProblem);
  });
});
