import { describe, expect, it } from "vitest";
import { EventSourceEnvelopeProblem, parseEventSourceEnvelope } from "../source";

const envelope = {
  sourceRef: "payments",
  outboxMessageId: "outbox-1",
  eventId: "event-1",
  eventType: "payment.captured",
  schemaVersion: 1,
  subject: "capture-1",
  occurredAt: "2026-09-28T12:00:00.000Z",
  origin: "payment-service",
};

describe("EventSourceEnvelope", () => {
  it("validates source identity and normalizes occurrence time", () => {
    expect(
      parseEventSourceEnvelope({ ...envelope, occurredAt: "2026-09-28T21:00:00+09:00" }),
    ).toEqual(envelope);
  });

  it.each([
    { ...envelope, eventId: "" },
    { ...envelope, schemaVersion: 0 },
    { ...envelope, schemaVersion: 1.5 },
    { ...envelope, subject: " " },
    { ...envelope, occurredAt: "not-a-date" },
    { ...envelope, occurredAt: "2026-02-30T00:00:00Z" },
    { ...envelope, occurredAt: "2026-09-28T12:00:00" },
    { ...envelope, occurredAt: "2026-09-28T12:00:00+14:01" },
    { ...envelope, origin: "" },
    null,
  ])("rejects invalid server event metadata without echoing it", (input) => {
    expect(() => parseEventSourceEnvelope(input)).toThrow(EventSourceEnvelopeProblem);
  });
});
