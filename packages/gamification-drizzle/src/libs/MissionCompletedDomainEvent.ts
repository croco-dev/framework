import { createHash } from "node:crypto";
import { DomainEvent, RegisterEvent, restoreSerializedEventIdentity } from "@croco/events-core";
import { MissionInvalidProblem, missionDate } from "@croco/gamification-core";
import type { MissionAggregateKey, MissionCompletion } from "@croco/gamification-core";

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new MissionInvalidProblem("Invalid completion event payload");
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0)
    throw new MissionInvalidProblem("Invalid completion event identifier");
  return value;
}

/** Logical completion only; consumers own their effects and delivery idempotency. */
export class MissionCompletedDomainEvent extends DomainEvent {
  static readonly eventName = "gamification.mission.completed";
  readonly key: MissionAggregateKey;
  readonly completion: MissionCompletion;

  constructor(key: MissionAggregateKey, completion: MissionCompletion) {
    const identity = JSON.stringify([
      key.scope.tenantId,
      key.scope.appId,
      key.scope.environmentId,
      key.subjectId,
      key.missionId,
      key.version,
      key.episodeId,
      key.periodKey,
      completion.id,
    ]);
    const id = `gamification.mission.completed:${createHash("sha256").update(identity).digest("hex")}`;
    super(id);
    this.key = structuredClone(key);
    this.completion = structuredClone(completion);
    restoreSerializedEventIdentity(this, id, completion.achievedAt);
  }

  static fromPayload(payload: Record<string, unknown>): MissionCompletedDomainEvent {
    const key = record(payload.key);
    const scope = record(key.scope);
    const completion = record(payload.completion);
    const version = key.version;
    if (typeof version !== "number" || !Number.isSafeInteger(version) || version < 1)
      throw new MissionInvalidProblem("Invalid completion event version");
    const periodKey = text(key.periodKey);
    missionDate(periodKey);
    if (completion.periodKey !== periodKey)
      throw new MissionInvalidProblem("Completion event period mismatch");
    const achievedAt = text(completion.achievedAt);
    if (
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(achievedAt) ||
      !Number.isFinite(Date.parse(achievedAt)) ||
      new Date(achievedAt).toISOString().slice(0, 19) !== achievedAt.slice(0, 19)
    )
      throw new MissionInvalidProblem("Invalid completion event timestamp");
    return new MissionCompletedDomainEvent(
      {
        scope: {
          tenantId: text(scope.tenantId),
          appId: text(scope.appId),
          environmentId: text(scope.environmentId),
        },
        subjectId: text(key.subjectId),
        missionId: text(key.missionId),
        version,
        episodeId: text(key.episodeId),
        periodKey,
      },
      { id: text(completion.id), periodKey, achievedAt, eventId: text(completion.eventId) },
    );
  }
}

RegisterEvent()(MissionCompletedDomainEvent);
