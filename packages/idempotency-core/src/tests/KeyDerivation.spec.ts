import { describe, expect, it } from "vitest";
import {
  deriveEventConsumerIdempotencyKey,
  deriveHttpIdempotencyKey,
  deriveIdempotencyKey,
  deriveTaskIdempotencyKey,
  deriveWebhookIdempotencyKey,
  InvalidIdempotencyKeyProblem,
} from "../index";

describe("idempotency key derivation", () => {
  it("reflects tenant scope in the storage namespace and telemetry attributes", () => {
    const tenantKey = deriveIdempotencyKey({
      namespace: "checkout",
      tenantId: "tenant-a",
      source: {
        kind: "explicit",
        key: "request-1",
        fingerprint: "body-a",
      },
    });

    expect(tenantKey.storageKey).toBe("checkout:tenant:tenant-a:explicit:request-1");
    expect(tenantKey.telemetryAttributes).toEqual({
      "croco.idempotency.key": "request-1",
      "croco.idempotency.namespace": "checkout",
      "croco.idempotency.scope": "tenant",
      "croco.idempotency.tenant_id": "tenant-a",
      "croco.idempotency.source": "explicit",
      "croco.idempotency.fingerprint": "body-a",
    });
  });

  it("derives different storage keys for the same logical key in different tenants", () => {
    const tenantAKey = deriveIdempotencyKey({
      namespace: "billing",
      tenantId: "tenant-a",
      source: { kind: "explicit", key: "invoice-1", fingerprint: "payload" },
    });
    const tenantBKey = deriveIdempotencyKey({
      namespace: "billing",
      tenantId: "tenant-b",
      source: { kind: "explicit", key: "invoice-1", fingerprint: "payload" },
    });

    expect(tenantAKey.storageKey).not.toBe(tenantBKey.storageKey);
    expect(tenantAKey.key).toBe(tenantBKey.key);
  });

  it("uses request fingerprint evidence when an HTTP idempotency key is explicit", () => {
    const key = deriveHttpIdempotencyKey({
      tenantId: "tenant-a",
      idempotencyKey: "checkout-1",
      method: "post",
      path: "/orders",
      bodyFingerprint: "sha256:body",
      queryFingerprint: "status=open",
      headerFingerprint: "content-type=application/json",
    });

    expect(key.namespace).toBe("http");
    expect(key.key).toBe("checkout-1");
    expect(key.fingerprint).toBe(
      '{"body":"sha256:body","headers":"content-type=application/json","method":"POST","path":"/orders","query":"status=open"}',
    );
  });

  it("provides reusable helpers for webhook, task, and event consumer integration points", () => {
    const webhookKey = deriveWebhookIdempotencyKey({
      provider: "stripe",
      eventId: "evt_123",
      tenantId: "tenant-a",
    });
    const taskKey = deriveTaskIdempotencyKey({
      taskName: "invoice.send",
      taskId: "job-1",
      tenantId: "tenant-a",
      payloadFingerprint: "payload-a",
    });
    const eventConsumerKey = deriveEventConsumerIdempotencyKey({
      consumerName: "billing-projection",
      eventId: "event-1",
      eventType: "invoice.created",
      tenantId: "tenant-a",
    });

    expect(webhookKey).toMatchObject({
      namespace: "webhook",
      key: '{"eventId":"evt_123","provider":"stripe"}',
      source: "provider-event",
      tenantId: "tenant-a",
    });
    expect(taskKey).toMatchObject({
      namespace: "task",
      key: '{"taskId":"job-1","taskName":"invoice.send"}',
      fingerprint: "payload-a",
    });
    expect(eventConsumerKey).toMatchObject({
      namespace: "event-consumer",
      key: '{"consumerName":"billing-projection","eventId":"event-1"}',
      fingerprint:
        '{"consumerName":"billing-projection","eventId":"event-1","eventType":"invoice.created"}',
    });
  });

  it("keeps helper source keys structurally unambiguous", () => {
    const webhookA = deriveWebhookIdempotencyKey({ provider: "a:b", eventId: "c" });
    const webhookB = deriveWebhookIdempotencyKey({ provider: "a", eventId: "b:c" });
    const taskA = deriveTaskIdempotencyKey({ taskName: "a:b", taskId: "c" });
    const taskB = deriveTaskIdempotencyKey({ taskName: "a", taskId: "b:c" });
    const consumerA = deriveEventConsumerIdempotencyKey({ consumerName: "a:b", eventId: "c" });
    const consumerB = deriveEventConsumerIdempotencyKey({ consumerName: "a", eventId: "b:c" });

    expect(webhookA.key).not.toBe(webhookB.key);
    expect(taskA.key).not.toBe(taskB.key);
    expect(consumerA.key).not.toBe(consumerB.key);
  });

  it("rejects a tenant-scoped source that conflicts with the requested scope", () => {
    expect(() =>
      deriveIdempotencyKey({
        tenantId: "tenant-a",
        source: {
          kind: "tenant-scoped",
          tenantId: "tenant-b",
          key: "shared",
        },
      }),
    ).toThrow(InvalidIdempotencyKeyProblem);
  });

  it("derives tenant-scoped source keys without a separate tenant scope option", () => {
    const key = deriveIdempotencyKey({
      namespace: "tenant-events",
      source: {
        kind: "tenant-scoped",
        tenantId: "tenant-a",
        key: "billing-event-1",
        fingerprint: "payload-a",
      },
    });

    expect(key).toMatchObject({
      namespace: "tenant-events",
      tenantId: "tenant-a",
      scope: "tenant",
      source: "tenant-scoped",
      storageKey: "tenant-events:tenant:tenant-a:tenant-scoped:billing-event-1",
    });
  });
});
