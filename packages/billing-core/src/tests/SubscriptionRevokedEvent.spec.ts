import { DefaultEventSerializer, EventRegistry } from "@croco/events-core";
import { describe, expect, it } from "vitest";
import { SubscriptionRevokedEvent } from "../libs/events/SubscriptionRevokedEvent";
import { planVersionRef } from "../libs/planVersionRef";

describe("SubscriptionRevokedEvent", () => {
  const serializer = new DefaultEventSerializer(
    new EventRegistry().register(SubscriptionRevokedEvent),
  );

  it("retains the pinned plan and event identity through JSON serialization", () => {
    const ref = planVersionRef("pro@v1");
    const event = new SubscriptionRevokedEvent("tenant-1", "sub-1", ref);
    const serialized = JSON.parse(JSON.stringify(serializer.serialize(event)));
    const restored = serializer.deserialize<SubscriptionRevokedEvent>(serialized);

    expect(serialized.payload.planVersionRef).toBe(ref);
    expect(restored).toBeInstanceOf(SubscriptionRevokedEvent);
    expect(restored).toMatchObject({
      tenantId: "tenant-1",
      externalSubscriptionId: "sub-1",
      eventId: event.eventId,
      planVersionRef: ref,
      timestamp: event.timestamp,
    });
  });

  it("deserializes legacy payloads without a plan reference", () => {
    const restored = serializer.deserialize<SubscriptionRevokedEvent>({
      eventType: SubscriptionRevokedEvent.eventName,
      eventId: "legacy-1",
      occurredAt: "2026-01-01T00:00:00.000Z",
      payload: { tenantId: "tenant-1", externalSubscriptionId: "sub-1" },
    });

    expect(restored.planVersionRef).toBeUndefined();
    expect(restored.eventId).toBe("legacy-1");
    expect(restored.tenantId).toBe("tenant-1");
    expect(restored.externalSubscriptionId).toBe("sub-1");
  });
});
