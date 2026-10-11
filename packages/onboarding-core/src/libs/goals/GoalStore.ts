import { Token } from "@croco/framework-context";
import { GoalConflictProblem, GoalReceiptInvalidProblem } from "./GoalProblems";
import type {
  ActionReceipt,
  GoalDefinitionPublication,
  GoalEpisode,
  GoalEpisodeKey,
  GoalEvidence,
  GoalObservationResult,
  GoalScope,
} from "./types";

function scopeKey(scope: GoalScope): string {
  return JSON.stringify([scope.tenantId, scope.appId, scope.environmentId]);
}

function episodeKey(key: GoalEpisodeKey): string {
  return JSON.stringify([scopeKey(key.scope), key.subject.id, key.episodeId]);
}

function definitionKey(scope: GoalScope, definitionId: string): string {
  return JSON.stringify([scopeKey(scope), definitionId]);
}

function samePublication(a: GoalDefinitionPublication, b: GoalDefinitionPublication): boolean {
  const fields = (publication: GoalDefinitionPublication): unknown[] => {
    const definition = publication.definition;
    return [
      scopeKey(publication.scope),
      publication.revision,
      publication.actorId,
      publication.reason,
      publication.idempotencyKey,
      definition.id,
      definition.version,
      definition.anchor,
      definition.actionId,
      definition.windowMs,
      definition.allowedLatenessMs,
      definition.timezone,
      definition.countMode,
      definition.threshold,
      definition.deletedObjectPolicy,
      definition.title,
      definition.description,
      definition.nextActionHref,
      definition.guidanceSteps?.map((step) => [step.id, step.title, step.description, step.href]),
    ];
  };
  return JSON.stringify(fields(a)) === JSON.stringify(fields(b));
}

function sameEvidence(a: GoalEvidence, b: GoalEvidence): boolean {
  const fields = (evidence: GoalEvidence): unknown[] => [
    evidence.eventId,
    evidence.actionId,
    evidence.occurredAt.getTime(),
    evidence.confirmation.source,
    evidence.confirmation.evidenceId,
    "correction" in evidence
      ? [
          evidence.correction.kind,
          evidence.correction.kind === "retract_event"
            ? evidence.correction.targetEventId
            : evidence.correction.objectId,
        ]
      : evidence.objectId,
  ];
  return JSON.stringify(fields(a)) === JSON.stringify(fields(b));
}

function calendarDay(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

type StoredEvidence = { evidence: GoalEvidence; receivedAt: Date; late: boolean };
type StoredEpisode = { episode: GoalEpisode; evidence: Map<string, StoredEvidence> };

export abstract class GoalStore {
  static readonly token = new Token<GoalStore>("GoalStore");

  abstract publishDefinition(
    publication: GoalDefinitionPublication,
  ): Promise<{ status: "published" | "duplicate"; publication: GoalDefinitionPublication }>;
  abstract getPublishedDefinition(
    scope: GoalScope,
    definitionId: string,
    version?: string,
  ): Promise<GoalDefinitionPublication | null>;
  abstract beginEpisode(
    episode: GoalEpisode,
  ): Promise<{ status: "created" | "existing"; episode: GoalEpisode }>;
  abstract getEpisode(key: GoalEpisodeKey): Promise<GoalEpisode | null>;
  abstract observeAction(input: {
    key: GoalEpisodeKey;
    receipt: GoalEvidence;
    receivedAt: Date;
  }): Promise<GoalObservationResult>;
}

export class InMemoryGoalStore extends GoalStore {
  private readonly definitions = new Map<string, GoalDefinitionPublication[]>();
  private readonly episodes = new Map<string, StoredEpisode>();

  async publishDefinition(
    publication: GoalDefinitionPublication,
  ): Promise<{ status: "published" | "duplicate"; publication: GoalDefinitionPublication }> {
    const key = definitionKey(publication.scope, publication.definition.id);
    const history = this.definitions.get(key) ?? [];
    const existingKey = history.find(
      (entry) => entry.idempotencyKey === publication.idempotencyKey,
    );
    if (existingKey) {
      if (!samePublication(existingKey, publication)) {
        throw new GoalConflictProblem("publication-idempotency-key-reused");
      }
      return { status: "duplicate", publication: structuredClone(existingKey) };
    }
    if (history.some((entry) => entry.definition.version === publication.definition.version)) {
      throw new GoalConflictProblem("definition-version-exists");
    }
    if (publication.revision !== history.length + 1) {
      throw new GoalConflictProblem("publication-revision");
    }
    const stored = structuredClone(publication);
    this.definitions.set(key, [...history, stored]);
    return { status: "published", publication: structuredClone(stored) };
  }

  async getPublishedDefinition(
    scope: GoalScope,
    definitionId: string,
    version?: string,
  ): Promise<GoalDefinitionPublication | null> {
    const history = this.definitions.get(definitionKey(scope, definitionId)) ?? [];
    const publication = version
      ? history.find((entry) => entry.definition.version === version)
      : history.at(-1);
    return publication ? structuredClone(publication) : null;
  }

  async beginEpisode(
    episode: GoalEpisode,
  ): Promise<{ status: "created" | "existing"; episode: GoalEpisode }> {
    const key = episodeKey({
      scope: episode.scope,
      subject: episode.subject,
      episodeId: episode.id,
    });
    const existing = this.episodes.get(key);
    if (existing) {
      if (
        existing.episode.definitionId !== episode.definitionId ||
        existing.episode.startedAt.getTime() !== episode.startedAt.getTime()
      ) {
        throw new GoalConflictProblem("episode-id-reused");
      }
      return { status: "existing", episode: structuredClone(existing.episode) };
    }
    const stored = structuredClone(episode);
    this.episodes.set(key, { episode: stored, evidence: new Map() });
    return { status: "created", episode: structuredClone(stored) };
  }

  async getEpisode(key: GoalEpisodeKey): Promise<GoalEpisode | null> {
    const stored = this.episodes.get(episodeKey(key));
    return stored ? structuredClone(stored.episode) : null;
  }

  async observeAction(input: {
    key: GoalEpisodeKey;
    receipt: GoalEvidence;
    receivedAt: Date;
  }): Promise<GoalObservationResult> {
    const stored = this.episodes.get(episodeKey(input.key));
    if (!stored) throw new GoalConflictProblem("episode-missing");
    const { receipt, receivedAt } = input;
    const existing = stored.evidence.get(receipt.eventId);
    if (existing) {
      if (!sameEvidence(existing.evidence, receipt)) {
        throw new GoalConflictProblem("receipt-event-id-reused");
      }
      return { status: "duplicate", episode: structuredClone(stored.episode) };
    }
    if (receipt.actionId !== stored.episode.actionId) {
      throw new GoalReceiptInvalidProblem("action-mismatch");
    }
    if ("correction" in receipt && receipt.correction.kind === "retract_event") {
      const target = stored.evidence.get(receipt.correction.targetEventId);
      if (!target || "correction" in target.evidence) {
        throw new GoalReceiptInvalidProblem("target-event-missing");
      }
    }
    if ("correction" in receipt && receipt.correction.kind === "delete_object") {
      if (stored.episode.deletedObjectPolicy === "retain") {
        throw new GoalReceiptInvalidProblem("object-deletion-policy-retain");
      }
    }
    if (
      !("correction" in receipt) &&
      stored.episode.countMode === "distinct_objects" &&
      !receipt.objectId
    ) {
      throw new GoalReceiptInvalidProblem("object-id-required");
    }
    const deadline = stored.episode.endsAt.getTime() + stored.episode.allowedLatenessMs;
    const late = receivedAt.getTime() >= deadline;
    stored.evidence.set(receipt.eventId, {
      evidence: structuredClone(receipt),
      receivedAt: new Date(receivedAt),
      late,
    });
    const previous = stored.episode;
    const progress = countProgress(previous, stored.evidence);
    const achievedNow = previous.status !== "achieved" && progress >= previous.threshold && !late;
    const status = achievedNow
      ? "achieved"
      : previous.status === "achieved" || previous.status === "canceled"
        ? previous.status
        : receivedAt.getTime() >= deadline
          ? "expired"
          : receivedAt.getTime() >= previous.endsAt.getTime()
            ? "closing"
            : "in_progress";
    const next: GoalEpisode = {
      ...previous,
      progress,
      status,
      achievedAt: achievedNow ? new Date(receivedAt) : previous.achievedAt,
    };
    stored.episode = next;
    return {
      status: late ? "late_correction" : "recorded",
      episode: structuredClone(next),
      achievedEvent: achievedNow
        ? {
            id: JSON.stringify([scopeKey(next.scope), next.subject.id, next.id, "achieved"]),
            episodeId: next.id,
            scope: structuredClone(next.scope),
            subject: structuredClone(next.subject),
            definitionId: next.definitionId,
            definitionVersion: next.definitionVersion,
            achievedAt: new Date(receivedAt),
          }
        : undefined,
    };
  }
}

function countProgress(episode: GoalEpisode, evidence: Map<string, StoredEvidence>): number {
  const retracted = new Set<string>();
  const deletedObjects = new Set<string>();
  for (const entry of evidence.values()) {
    if (entry.late || !("correction" in entry.evidence)) continue;
    if (entry.evidence.correction.kind === "retract_event") {
      retracted.add(entry.evidence.correction.targetEventId);
    } else {
      deletedObjects.add(entry.evidence.correction.objectId);
    }
  }
  const units = new Set<string>();
  for (const [eventId, entry] of evidence) {
    const receipt = entry.evidence;
    if (
      entry.late ||
      "correction" in receipt ||
      retracted.has(eventId) ||
      receipt.occurredAt < episode.startedAt ||
      receipt.occurredAt >= episode.endsAt ||
      (receipt.objectId && deletedObjects.has(receipt.objectId))
    )
      continue;
    units.add(countKey(episode, receipt));
  }
  return units.size;
}

function countKey(episode: GoalEpisode, receipt: ActionReceipt): string {
  switch (episode.countMode) {
    case "events":
      return receipt.eventId;
    case "distinct_objects":
      if (!receipt.objectId) throw new GoalReceiptInvalidProblem("object-id-required");
      return receipt.objectId;
    case "distinct_calendar_days":
      return calendarDay(receipt.occurredAt, episode.timezone);
  }
}
