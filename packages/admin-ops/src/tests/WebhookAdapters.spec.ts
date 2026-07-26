import { describe, expect, it } from "vitest";

import {
  operationsTimelineEventFromWebhookDelivery,
  retryConsoleItemFromWebhookDelivery,
  type WebhookOperationsFailureEvidence,
} from "../index";

const evidence: WebhookOperationsFailureEvidence = {
  deliveryId: "delivery-1",
  eventId: "event-1",
  endpointId: "endpoint-1",
  tenantId: "tenant-1",
  eventName: "order.created",
  schemaVersion: "v1",
  subject: "order-42",
  status: "dead",
  endpointStatus: "active",
  attemptCount: 3,
  maxAttempts: 3,
  createdAt: new Date("2026-07-26T00:00:00.000Z"),
  updatedAt: new Date("2026-07-26T00:01:00.000Z"),
  correlationId: "correlation-1",
  problem: {
    code: "webhooks-core/outbound-permanent-failure",
    message: "HTTP 400",
    retryable: false,
  },
  replay: {
    allowed: true,
    reason: "Core delivery state allows replay",
  },
};

describe("outbound webhook admin-ops adapters", () => {
  it("adds failed delivery evidence to the operations timeline structurally", () => {
    expect(operationsTimelineEventFromWebhookDelivery(evidence)).toMatchObject({
      source: "webhook",
      severity: "error",
      tenantId: "tenant-1",
      correlationId: "correlation-1",
      primaryEntity: {
        type: "webhook-delivery",
        id: "delivery-1",
      },
      problem: {
        code: "webhooks-core/outbound-permanent-failure",
      },
      recoveryAction: "replay-delivery",
      extension: {
        source: "webhook",
        deliveryId: "delivery-1",
      },
    });
  });

  it("uses core replay eligibility in the retry console instead of inferring from failure", () => {
    expect(retryConsoleItemFromWebhookDelivery(evidence)).toMatchObject({
      id: "delivery-1",
      source: { kind: "webhook" },
      state: "terminal_failed",
      retryable: false,
      recoveryActions: [
        {
          kind: "replay",
          allowed: true,
          requiresAudit: true,
          requiresIdempotencyKey: true,
        },
      ],
    });

    expect(
      retryConsoleItemFromWebhookDelivery({
        ...evidence,
        status: "acceptance-unknown",
        replay: {
          allowed: false,
          reason: "Operator confirmation is required before replay",
        },
      }),
    ).toMatchObject({
      state: "non_retryable",
      recoveryActions: [
        {
          kind: "inspect",
          allowed: true,
          reason: "Operator confirmation is required before replay",
        },
      ],
    });

    expect(
      retryConsoleItemFromWebhookDelivery({
        ...evidence,
        endpointStatus: "paused",
        status: "pending",
        replay: { allowed: true, reason: "Hostile caller-forged replay flag" },
      }),
    ).toMatchObject({
      recoveryActions: [{ kind: "inspect", allowed: false }],
    });
  });

  it("does not place payloads, headers, signatures, or secret values in shared evidence", () => {
    const hostileEvidence = {
      ...evidence,
      problem: {
        code: "webhooks-core/outbound-permanent-failure",
        message:
          "upstream Authorization: ApiKey hostile-token\nProxy-Authorization: Digest digest-value\nCookie: first=one; second=two\nSet-Cookie: session=value; HttpOnly",
      },
    };
    const serialized = JSON.stringify({
      timeline: operationsTimelineEventFromWebhookDelivery(hostileEvidence),
      retry: retryConsoleItemFromWebhookDelivery(hostileEvidence),
    });

    expect(serialized).not.toContain("payload");
    expect(serialized).not.toContain("headers");
    expect(serialized).not.toContain("signature");
    expect(serialized).not.toContain("secret");
    expect(serialized).not.toContain("hostile-token");
    expect(serialized).not.toContain("session-value");
    expect(serialized).not.toContain("digest-value");
    expect(serialized).not.toContain("first=one");
    expect(serialized).not.toContain("second=two");
  });
});
