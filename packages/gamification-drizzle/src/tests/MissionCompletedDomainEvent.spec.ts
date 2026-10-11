import "reflect-metadata";
import { DefaultEventSerializer } from "@croco/events-core";
import { MissionInvalidProblem } from "@croco/gamification-core";
import { describe, expect, it } from "vitest";
import { MissionCompletedDomainEvent } from "../index";

const key = {
  scope: { tenantId: "tenant", appId: "app", environmentId: "test" },
  subjectId: "subject",
  missionId: "mission",
  version: 1,
  episodeId: "first",
  periodKey: "2026-03-02",
};
const completion = {
  id: "completion-identity",
  periodKey: key.periodKey,
  achievedAt: "2026-03-03T12:00:00Z",
  eventId: "evidence",
};

describe("MissionCompletedDomainEvent", () => {
  it("round-trips scope and completion while preserving stable bounded identity and occurrence", () => {
    const event = new MissionCompletedDomainEvent(key, completion);
    const serializer = new DefaultEventSerializer();
    const serialized = JSON.parse(JSON.stringify(serializer.serialize(event)));
    const restored = serializer.deserialize(serialized);
    expect(restored).toBeInstanceOf(MissionCompletedDomainEvent);
    expect(restored).toMatchObject({ key, completion, eventId: event.eventId });
    expect(restored.timestamp.toISOString()).toBe("2026-03-03T12:00:00.000Z");
    expect(event.eventId.length).toBeLessThan(128);
    expect(
      new MissionCompletedDomainEvent(
        { ...key, scope: { ...key.scope, tenantId: "other" } },
        completion,
      ).eventId,
    ).not.toBe(event.eventId);
  });

  it.each([
    {},
    { key: null, completion },
    { key: { ...key, scope: {} }, completion },
    { key: { ...key, version: 0 }, completion },
    { key, completion: { ...completion, periodKey: "2026-03-09" } },
    { key, completion: { ...completion, achievedAt: "2026-02-30T12:00:00Z" } },
    { key, completion: { ...completion, eventId: "" } },
  ])("rejects malformed payload with a stable mission Problem", (payload) => {
    expect(() => MissionCompletedDomainEvent.fromPayload(payload)).toThrow(MissionInvalidProblem);
  });
});
