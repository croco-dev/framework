import { describe, expect, it, vi } from "vitest";
import { createWebhookEventRouter, WebhookGatewayConfigurationProblem } from "../index";

import type { WebhookDispatchContext } from "../index";

type FixtureEvents = {
  "subscription.created": {
    payload: { subscriptionId: string };
    result: { savedId: string };
  };
  "subscription.canceled": {
    payload: { subscriptionId: string };
    result: { canceledId: string };
  };
};

const dispatchContext: WebhookDispatchContext = {
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
      dispatchContext,
    );

    expect(result).toEqual({ savedId: "sub-1" });
  });

  it("rejects duplicate handlers without replacing the first registration", async () => {
    const firstHandler = vi.fn((event: { payload: { subscriptionId: string } }) => ({
      savedId: event.payload.subscriptionId,
    }));
    const duplicateHandler = vi.fn(() => ({ savedId: "replacement" }));
    const router = createWebhookEventRouter<FixtureEvents>().register(
      "subscription.created",
      firstHandler,
    );

    let registrationFailure: unknown;
    try {
      router.register("subscription.created", duplicateHandler);
    } catch (error) {
      registrationFailure = error;
    }

    expect(registrationFailure).toBeInstanceOf(WebhookGatewayConfigurationProblem);
    expect(registrationFailure).toMatchObject({
      code: "webhooks-core/configuration",
      extensions: { eventType: "subscription.created" },
    });

    await expect(
      router.dispatch(
        {
          id: "evt-1",
          provider: "fixture",
          type: "subscription.created",
          payload: { subscriptionId: "sub-1" },
        },
        dispatchContext,
      ),
    ).resolves.toEqual({ savedId: "sub-1" });
    expect(firstHandler).toHaveBeenCalledOnce();
    expect(duplicateHandler).not.toHaveBeenCalled();
  });

  it("preserves fluent registration and dispatch for distinct event types", async () => {
    const router = createWebhookEventRouter<FixtureEvents>()
      .register("subscription.created", (event) => ({
        savedId: event.payload.subscriptionId,
      }))
      .register("subscription.canceled", (event) => ({
        canceledId: event.payload.subscriptionId,
      }));

    await expect(
      router.dispatch(
        {
          id: "evt-2",
          provider: "fixture",
          type: "subscription.canceled",
          payload: { subscriptionId: "sub-2" },
        },
        {
          ...dispatchContext,
          eventId: "evt-2",
          eventType: "subscription.canceled",
        },
      ),
    ).resolves.toEqual({ canceledId: "sub-2" });
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
        dispatchContext,
      ),
    ).rejects.toBeInstanceOf(WebhookGatewayConfigurationProblem);
  });
});
