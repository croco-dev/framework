import {
  GoalAuthorizationProblem,
  GoalContextInvalidProblem,
  GoalDefinitionNotFoundProblem,
  GoalEpisodeNotFoundProblem,
  GoalConflictProblem,
  GoalReceiptInvalidProblem,
} from "./GoalProblems";
import type { GoalStore } from "./GoalStore";
import { validateGoalDefinition } from "./validateGoalDefinition";
import type {
  GoalAnchor,
  GoalDefinitionPublication,
  GoalEpisode,
  GoalEpisodeKey,
  GoalEvidence,
  GoalObservationResult,
  GoalProgress,
  GoalScope,
  GoalSubject,
} from "./types";

export interface GoalReceiptVerifier {
  verify(input: {
    key: GoalEpisodeKey;
    receipt: GoalEvidence;
    episode: GoalEpisode;
  }): Promise<void>;
}

export interface GoalPublicationAuthorizer {
  authorize(publication: GoalDefinitionPublication): Promise<boolean>;
}

export interface GoalSubjectVerifier {
  verify(input: {
    scope: GoalScope;
    subject: GoalSubject;
    operation: "begin" | "observe" | "read";
  }): Promise<boolean>;
}

function requireIdentifier(value: string, field: string): void {
  if (typeof value !== "string" || value.trim() === "") {
    throw new GoalContextInvalidProblem(field);
  }
}

function requireDate(value: Date, field: string): void {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new GoalContextInvalidProblem(field);
  }
}

function validateScope(scope: GoalScope): void {
  if (!scope) throw new GoalContextInvalidProblem("scope");
  requireIdentifier(scope.tenantId, "tenantId");
  requireIdentifier(scope.appId, "appId");
  requireIdentifier(scope.environmentId, "environmentId");
}

function validateSubject(subject: GoalSubject): void {
  if (!subject || subject.verified !== true) throw new GoalContextInvalidProblem("verifiedSubject");
  requireIdentifier(subject.id, "subject.id");
}

function validateKey(key: GoalEpisodeKey): void {
  validateScope(key.scope);
  validateSubject(key.subject);
  requireIdentifier(key.episodeId, "episodeId");
}

function validateEvidence(evidence: GoalEvidence): void {
  if (!evidence || !evidence.confirmation || evidence.confirmation.source !== "server") {
    throw new GoalReceiptInvalidProblem("server-confirmation-required");
  }
  for (const field of ["eventId", "actionId"] as const) {
    if (typeof evidence[field] !== "string" || evidence[field].trim() === "") {
      throw new GoalReceiptInvalidProblem(`${field}-required`);
    }
  }
  if (
    typeof evidence.confirmation.evidenceId !== "string" ||
    !evidence.confirmation.evidenceId.trim()
  ) {
    throw new GoalReceiptInvalidProblem("evidence-id-required");
  }
  if (!(evidence.occurredAt instanceof Date) || !Number.isFinite(evidence.occurredAt.getTime())) {
    throw new GoalReceiptInvalidProblem("occurred-at-invalid");
  }
  if (
    "objectId" in evidence &&
    evidence.objectId !== undefined &&
    (typeof evidence.objectId !== "string" || !evidence.objectId.trim())
  ) {
    throw new GoalReceiptInvalidProblem("object-id-invalid");
  }
  if ("correction" in evidence) {
    if (
      !evidence.correction ||
      !["retract_event", "delete_object"].includes(evidence.correction.kind)
    ) {
      throw new GoalReceiptInvalidProblem("correction-kind-invalid");
    }
    if (
      evidence.correction.kind === "retract_event" &&
      (typeof evidence.correction.targetEventId !== "string" ||
        !evidence.correction.targetEventId.trim())
    ) {
      throw new GoalReceiptInvalidProblem("target-event-id-required");
    }
    if (
      evidence.correction.kind === "delete_object" &&
      (typeof evidence.correction.objectId !== "string" || !evidence.correction.objectId.trim())
    ) {
      throw new GoalReceiptInvalidProblem("object-id-required");
    }
  }
}

export class GoalManager {
  constructor(
    private readonly store: GoalStore,
    private readonly verifier: GoalReceiptVerifier,
    private readonly publicationAuthorizer: GoalPublicationAuthorizer,
    private readonly subjectVerifier: GoalSubjectVerifier,
  ) {}

  async publishDefinition(publication: GoalDefinitionPublication): Promise<{
    status: "published" | "duplicate";
    publication: GoalDefinitionPublication;
  }> {
    validateScope(publication.scope);
    requireIdentifier(publication.actorId, "actorId");
    requireIdentifier(publication.reason, "reason");
    requireIdentifier(publication.idempotencyKey, "idempotencyKey");
    requireDate(publication.publishedAt, "publishedAt");
    if (!Number.isSafeInteger(publication.revision) || publication.revision <= 0) {
      throw new GoalContextInvalidProblem("revision");
    }
    const definition = validateGoalDefinition(publication.definition);
    const validated = { ...publication, definition };
    if (!(await this.publicationAuthorizer.authorize(validated))) {
      throw new GoalAuthorizationProblem();
    }
    return this.store.publishDefinition(validated);
  }

  async beginEpisode(input: {
    id: string;
    scope: GoalScope;
    subject: GoalSubject;
    definitionId: string;
    anchor: GoalAnchor;
    startedAt: Date;
  }): Promise<{ status: "created" | "existing"; episode: GoalEpisode }> {
    validateScope(input.scope);
    validateSubject(input.subject);
    await this.verifySubject(input.scope, input.subject, "begin");
    requireIdentifier(input.id, "episodeId");
    requireIdentifier(input.definitionId, "definitionId");
    requireDate(input.startedAt, "startedAt");
    const existing = await this.store.getEpisode({
      scope: input.scope,
      subject: input.subject,
      episodeId: input.id,
    });
    if (existing) {
      if (
        existing.definitionId !== input.definitionId ||
        existing.startedAt.getTime() !== input.startedAt.getTime()
      ) {
        throw new GoalConflictProblem("episode-id-reused");
      }
      const original = await this.store.getPublishedDefinition(
        input.scope,
        input.definitionId,
        existing.definitionVersion,
      );
      if (!original || original.definition.anchor !== input.anchor) {
        throw new GoalContextInvalidProblem("anchor");
      }
      return { status: "existing", episode: existing };
    }
    const publication = await this.store.getPublishedDefinition(input.scope, input.definitionId);
    if (!publication) throw new GoalDefinitionNotFoundProblem(input.definitionId);
    const definition = validateGoalDefinition(publication.definition);
    if (definition.anchor !== input.anchor) throw new GoalContextInvalidProblem("anchor");
    const endTime = input.startedAt.getTime() + definition.windowMs;
    if (
      !Number.isFinite(new Date(endTime).getTime()) ||
      !Number.isFinite(new Date(endTime + definition.allowedLatenessMs).getTime())
    ) {
      throw new GoalContextInvalidProblem("startedAt");
    }
    return this.store.beginEpisode({
      id: input.id,
      scope: structuredClone(input.scope),
      subject: structuredClone(input.subject),
      definitionId: definition.id,
      definitionVersion: definition.version,
      actionId: definition.actionId,
      startedAt: new Date(input.startedAt),
      endsAt: new Date(endTime),
      allowedLatenessMs: definition.allowedLatenessMs,
      timezone: definition.timezone,
      countMode: definition.countMode,
      threshold: definition.threshold,
      deletedObjectPolicy: definition.deletedObjectPolicy,
      progress: 0,
      status: "in_progress",
    });
  }

  async observeAction(input: {
    scope: GoalScope;
    subject: GoalSubject;
    episodeId: string;
    receipt: GoalEvidence;
    receivedAt: Date;
  }): Promise<GoalObservationResult> {
    const key = { scope: input.scope, subject: input.subject, episodeId: input.episodeId };
    validateKey(key);
    await this.verifySubject(input.scope, input.subject, "observe");
    requireDate(input.receivedAt, "receivedAt");
    validateEvidence(input.receipt);
    const episode = await this.store.getEpisode(key);
    if (!episode) throw new GoalEpisodeNotFoundProblem();
    if (episode.status === "canceled") throw new GoalReceiptInvalidProblem("episode-canceled");
    if (input.receipt.actionId !== episode.actionId)
      throw new GoalReceiptInvalidProblem("action-mismatch");
    if (
      !("correction" in input.receipt) &&
      episode.countMode === "distinct_objects" &&
      !input.receipt.objectId
    ) {
      throw new GoalReceiptInvalidProblem("object-id-required");
    }
    if (
      !("correction" in input.receipt) &&
      (input.receipt.occurredAt < episode.startedAt || input.receipt.occurredAt >= episode.endsAt)
    ) {
      throw new GoalReceiptInvalidProblem("outside-episode-window");
    }
    await this.verifier.verify({ key, receipt: input.receipt, episode });
    return this.store.observeAction({ key, receipt: input.receipt, receivedAt: input.receivedAt });
  }

  async getProgress(input: GoalEpisodeKey & { asOf: Date }): Promise<GoalProgress> {
    validateKey(input);
    await this.verifySubject(input.scope, input.subject, "read");
    requireDate(input.asOf, "asOf");
    const episode = await this.store.getEpisode(input);
    if (!episode) throw new GoalEpisodeNotFoundProblem();
    const publication = await this.store.getPublishedDefinition(
      input.scope,
      episode.definitionId,
      episode.definitionVersion,
    );
    if (!publication) throw new GoalDefinitionNotFoundProblem(episode.definitionId);
    const deadline = episode.endsAt.getTime() + episode.allowedLatenessMs;
    const status =
      episode.status === "achieved" || episode.status === "canceled"
        ? episode.status
        : input.asOf.getTime() >= deadline
          ? "expired"
          : input.asOf.getTime() >= episode.endsAt.getTime()
            ? "closing"
            : "in_progress";
    return {
      episode: { ...episode, status },
      progress: episode.progress,
      threshold: episode.threshold,
      remaining: Math.max(0, episode.threshold - episode.progress),
      status,
      title: publication.definition.title,
      description: publication.definition.description,
      nextActionHref: publication.definition.nextActionHref,
      guidanceSteps: publication.definition.guidanceSteps,
    };
  }

  private async verifySubject(
    scope: GoalScope,
    subject: GoalSubject,
    operation: "begin" | "observe" | "read",
  ): Promise<void> {
    if (!(await this.subjectVerifier.verify({ scope, subject, operation }))) {
      throw new GoalAuthorizationProblem();
    }
  }
}
