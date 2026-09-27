import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { DomainEvent, RegisterEvent, restoreSerializedEventIdentity } from "@croco/events-core";
import {
  DrizzleTransactionalEventStore,
  TransactionalOutbox,
  type DrizzleTransactionalEventStoreDb,
  type TransactionalEventStore,
} from "@croco/events-tx";
import {
  GoalConflictProblem,
  GoalEpisodeNotFoundProblem,
  GoalReceiptInvalidProblem,
  GoalStore,
  type GoalAchievedEventIntent,
  type GoalDefinition,
  type GoalDefinitionPublication,
  type GoalEpisode,
  type GoalEpisodeKey,
  type GoalEvidence,
  type GoalObservationResult,
  type GoalScope,
} from "@croco/onboarding-core";
import type { TxManager } from "@croco/tx-core";
import { and, desc, eq, isNull, sql, type SQL } from "drizzle-orm";
import type { DrizzleOnboardingClient } from "./DrizzleOnboardingStore";
import {
  onboardingGoalDefinitions,
  onboardingGoalEpisodes,
  onboardingGoalReceipts,
} from "./goalSchema";

export type DrizzleGoalClient = DrizzleOnboardingClient;

type DefinitionRow = typeof onboardingGoalDefinitions.$inferSelect;
type EpisodeRow = typeof onboardingGoalEpisodes.$inferSelect;

function scopeWhere(scope: GoalScope) {
  return and(
    eq(onboardingGoalDefinitions.tenantId, scope.tenantId),
    eq(onboardingGoalDefinitions.appId, scope.appId),
    eq(onboardingGoalDefinitions.environmentId, scope.environmentId),
  );
}

function episodeWhere(key: GoalEpisodeKey) {
  return and(
    eq(onboardingGoalEpisodes.tenantId, key.scope.tenantId),
    eq(onboardingGoalEpisodes.appId, key.scope.appId),
    eq(onboardingGoalEpisodes.environmentId, key.scope.environmentId),
    eq(onboardingGoalEpisodes.subjectId, key.subject.id),
    eq(onboardingGoalEpisodes.episodeId, key.episodeId),
  );
}

function receiptWhere(key: GoalEpisodeKey) {
  return and(
    eq(onboardingGoalReceipts.tenantId, key.scope.tenantId),
    eq(onboardingGoalReceipts.appId, key.scope.appId),
    eq(onboardingGoalReceipts.environmentId, key.scope.environmentId),
    eq(onboardingGoalReceipts.subjectId, key.subject.id),
    eq(onboardingGoalReceipts.episodeId, key.episodeId),
  );
}

function mapDefinition(row: DefinitionRow): GoalDefinitionPublication {
  return {
    scope: { tenantId: row.tenantId, appId: row.appId, environmentId: row.environmentId },
    definition: {
      id: row.definitionId,
      version: row.version,
      anchor: row.anchor as GoalDefinition["anchor"],
      actionId: row.actionId,
      windowMs: row.windowMs,
      allowedLatenessMs: row.allowedLatenessMs,
      timezone: row.timezone,
      countMode: row.countMode,
      threshold: row.threshold,
      deletedObjectPolicy: row.deletedObjectPolicy,
      ...row.presentation,
    },
    revision: row.revision,
    actorId: row.actorId,
    reason: row.reason,
    idempotencyKey: row.idempotencyKey,
    publishedAt: row.publishedAt,
  };
}

function semanticPublication(publication: GoalDefinitionPublication): unknown {
  const { scope, definition, revision, actorId, reason, idempotencyKey } = publication;
  return JSON.parse(
    JSON.stringify({ scope, definition, revision, actorId, reason, idempotencyKey }),
  );
}

function mapEpisode(row: EpisodeRow): GoalEpisode {
  return {
    id: row.episodeId,
    scope: { tenantId: row.tenantId, appId: row.appId, environmentId: row.environmentId },
    subject: { id: row.subjectId, verified: true },
    definitionId: row.definitionId,
    definitionVersion: row.definitionVersion,
    actionId: row.actionId,
    startedAt: row.startedAt,
    endsAt: row.endsAt,
    allowedLatenessMs: row.allowedLatenessMs,
    timezone: row.timezone,
    countMode: row.countMode,
    threshold: row.threshold,
    deletedObjectPolicy: row.deletedObjectPolicy,
    progress: row.progress,
    status: row.status,
    achievedAt: row.achievedAt ?? undefined,
  };
}

function achievementId(key: GoalEpisodeKey): string {
  const identity = JSON.stringify([
    key.scope.tenantId,
    key.scope.appId,
    key.scope.environmentId,
    key.subject.id,
    key.episodeId,
    "achieved",
  ]);
  return `onboarding.goal.achieved:${createHash("sha256").update(identity).digest("hex")}`;
}

function objectDigest(key: GoalEpisodeKey, objectId: string): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        key.scope.tenantId,
        key.scope.appId,
        key.scope.environmentId,
        key.subject.id,
        key.episodeId,
        objectId,
      ]),
    )
    .digest("hex");
}

export class GoalAchievedDomainEvent extends DomainEvent {
  static readonly eventName = "onboarding.goal.achieved";

  readonly episodeId: string;
  readonly scope: GoalScope;
  readonly id: string;
  readonly subject: GoalAchievedEventIntent["subject"];
  readonly definitionId: string;
  readonly definitionVersion: string;
  readonly achievedAt: Date;

  constructor(intent: GoalAchievedEventIntent) {
    super(intent.id);
    this.id = intent.id;
    this.episodeId = intent.episodeId;
    this.scope = intent.scope;
    this.subject = intent.subject;
    this.definitionId = intent.definitionId;
    this.definitionVersion = intent.definitionVersion;
    this.achievedAt = intent.achievedAt;
    restoreSerializedEventIdentity(this, intent.id, intent.achievedAt.toISOString());
  }

  static fromPayload(payload: Record<string, unknown>): GoalAchievedDomainEvent {
    const scope = payload.scope;
    const subject = payload.subject;
    if (
      typeof payload.episodeId !== "string" ||
      typeof payload.id !== "string" ||
      typeof payload.definitionId !== "string" ||
      typeof payload.definitionVersion !== "string" ||
      typeof payload.achievedAt !== "string" ||
      typeof scope !== "object" ||
      scope === null ||
      typeof subject !== "object" ||
      subject === null ||
      !("id" in subject) ||
      !("verified" in subject) ||
      typeof subject.id !== "string" ||
      subject.verified !== true ||
      !("tenantId" in scope) ||
      !("appId" in scope) ||
      !("environmentId" in scope) ||
      typeof scope.tenantId !== "string" ||
      typeof scope.appId !== "string" ||
      typeof scope.environmentId !== "string" ||
      Number.isNaN(new Date(payload.achievedAt).getTime())
    ) {
      throw new GoalReceiptInvalidProblem("invalid-achievement-event-payload");
    }
    return new GoalAchievedDomainEvent({
      id: payload.id,
      episodeId: payload.episodeId,
      scope: { tenantId: scope.tenantId, appId: scope.appId, environmentId: scope.environmentId },
      subject: { id: subject.id, verified: true },
      definitionId: payload.definitionId,
      definitionVersion: payload.definitionVersion,
      achievedAt: new Date(payload.achievedAt),
    });
  }
}

RegisterEvent()(GoalAchievedDomainEvent);

/** PostgreSQL goal store. The outbox must share this store's TxManager. */
export class DrizzleGoalStore extends GoalStore {
  private readonly outbox: TransactionalOutbox<DrizzleGoalClient>;

  constructor(
    private readonly db: DrizzleGoalClient,
    private readonly txManager: TxManager<DrizzleGoalClient>,
  ) {
    super();
    const eventStore = new DrizzleTransactionalEventStore({
      db: db as unknown as DrizzleTransactionalEventStoreDb,
      txManager: txManager as unknown as TxManager<DrizzleTransactionalEventStoreDb>,
    }) as unknown as TransactionalEventStore<DrizzleGoalClient>;
    this.outbox = new TransactionalOutbox({ store: eventStore, txManager });
  }

  async publishDefinition(
    publication: GoalDefinitionPublication,
  ): Promise<{ status: "published" | "duplicate"; publication: GoalDefinitionPublication }> {
    return this.txManager.run(async () => {
      const client = this.client();
      const { scope, definition } = publication;
      const lockKey = JSON.stringify([
        scope.tenantId,
        scope.appId,
        scope.environmentId,
        definition.id,
      ]);
      await client.execute(sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`);
      const duplicate = await client
        .select()
        .from(onboardingGoalDefinitions)
        .where(
          and(
            scopeWhere(scope),
            eq(onboardingGoalDefinitions.definitionId, definition.id),
            eq(onboardingGoalDefinitions.idempotencyKey, publication.idempotencyKey),
          ),
        )
        .limit(1);
      if (duplicate[0]) {
        const existing = mapDefinition(duplicate[0]);
        if (!isDeepStrictEqual(semanticPublication(existing), semanticPublication(publication))) {
          throw new GoalConflictProblem("publication-idempotency-key-reused");
        }
        return { status: "duplicate", publication: existing };
      }
      const latest = await client
        .select({ revision: onboardingGoalDefinitions.revision })
        .from(onboardingGoalDefinitions)
        .where(and(scopeWhere(scope), eq(onboardingGoalDefinitions.definitionId, definition.id)))
        .orderBy(desc(onboardingGoalDefinitions.revision))
        .limit(1);
      if (publication.revision !== (latest[0]?.revision ?? 0) + 1) {
        throw new GoalConflictProblem("publication-revision");
      }
      const inserted = await client
        .insert(onboardingGoalDefinitions)
        .values({
          tenantId: scope.tenantId,
          appId: scope.appId,
          environmentId: scope.environmentId,
          definitionId: definition.id,
          version: definition.version,
          actionId: definition.actionId,
          anchor: definition.anchor,
          windowMs: definition.windowMs,
          allowedLatenessMs: definition.allowedLatenessMs,
          timezone: definition.timezone,
          countMode: definition.countMode,
          threshold: definition.threshold,
          deletedObjectPolicy: definition.deletedObjectPolicy,
          presentation: {
            ...(definition.title === undefined ? {} : { title: definition.title }),
            ...(definition.description === undefined
              ? {}
              : { description: definition.description }),
            ...(definition.nextActionHref === undefined
              ? {}
              : { nextActionHref: definition.nextActionHref }),
            ...(definition.guidanceSteps === undefined
              ? {}
              : { guidanceSteps: definition.guidanceSteps }),
          },
          revision: publication.revision,
          actorId: publication.actorId,
          reason: publication.reason,
          idempotencyKey: publication.idempotencyKey,
          publishedAt: publication.publishedAt,
        })
        .onConflictDoNothing()
        .returning();
      if (!inserted[0]) throw new GoalConflictProblem("definition-version-exists");
      return { status: "published", publication: mapDefinition(inserted[0]) };
    });
  }

  async getPublishedDefinition(
    scope: GoalScope,
    definitionId: string,
    version?: string,
  ): Promise<GoalDefinitionPublication | null> {
    const rows = await this.client()
      .select()
      .from(onboardingGoalDefinitions)
      .where(
        and(
          scopeWhere(scope),
          eq(onboardingGoalDefinitions.definitionId, definitionId),
          version === undefined ? undefined : eq(onboardingGoalDefinitions.version, version),
        ),
      )
      .orderBy(desc(onboardingGoalDefinitions.revision))
      .limit(1);
    return rows[0] ? mapDefinition(rows[0]) : null;
  }

  async beginEpisode(
    episode: GoalEpisode,
  ): Promise<{ status: "created" | "existing"; episode: GoalEpisode }> {
    return this.txManager.run(async () => {
      const key = { scope: episode.scope, subject: episode.subject, episodeId: episode.id };
      const inserted = await this.client()
        .insert(onboardingGoalEpisodes)
        .values({
          tenantId: episode.scope.tenantId,
          appId: episode.scope.appId,
          environmentId: episode.scope.environmentId,
          subjectId: episode.subject.id,
          episodeId: episode.id,
          definitionId: episode.definitionId,
          definitionVersion: episode.definitionVersion,
          actionId: episode.actionId,
          startedAt: episode.startedAt,
          endsAt: episode.endsAt,
          allowedLatenessMs: episode.allowedLatenessMs,
          timezone: episode.timezone,
          countMode: episode.countMode,
          threshold: episode.threshold,
          deletedObjectPolicy: episode.deletedObjectPolicy,
          progress: episode.progress,
          status: episode.status,
          achievedAt: episode.achievedAt ?? null,
          updatedAt: episode.startedAt,
        })
        .onConflictDoNothing()
        .returning();
      if (inserted[0]) return { status: "created", episode: mapEpisode(inserted[0]) };
      const existing = await this.getEpisode(key);
      if (
        !existing ||
        existing.definitionId !== episode.definitionId ||
        existing.definitionVersion !== episode.definitionVersion ||
        existing.startedAt.getTime() !== episode.startedAt.getTime()
      ) {
        throw new GoalConflictProblem("episode-id-reused");
      }
      return { status: "existing", episode: existing };
    });
  }

  async getEpisode(key: GoalEpisodeKey): Promise<GoalEpisode | null> {
    const rows = await this.client()
      .select()
      .from(onboardingGoalEpisodes)
      .where(episodeWhere(key))
      .limit(1);
    return rows[0] ? mapEpisode(rows[0]) : null;
  }

  async observeAction(input: {
    key: GoalEpisodeKey;
    receipt: GoalEvidence;
    receivedAt: Date;
  }): Promise<GoalObservationResult> {
    return this.txManager.run(async () => {
      const client = this.client();
      const { key, receipt, receivedAt } = input;
      const rows = await client
        .select()
        .from(onboardingGoalEpisodes)
        .where(episodeWhere(key))
        .for("update")
        .limit(1);
      const row = rows[0];
      if (!row) throw new GoalEpisodeNotFoundProblem();
      const previous = mapEpisode(row);
      const duplicate = await client
        .select()
        .from(onboardingGoalReceipts)
        .where(and(receiptWhere(key), eq(onboardingGoalReceipts.eventId, receipt.eventId)))
        .limit(1);
      if (duplicate[0]) {
        if (duplicate[0].receiptHash !== evidenceHash(receipt))
          throw new GoalConflictProblem("receipt-event-id-reused");
        return { status: "duplicate", episode: previous };
      }
      if (receipt.actionId !== previous.actionId)
        throw new GoalReceiptInvalidProblem("action-mismatch");
      if (
        "correction" in receipt &&
        receipt.correction.kind === "delete_object" &&
        previous.deletedObjectPolicy === "retain"
      ) {
        throw new GoalReceiptInvalidProblem("object-deletion-policy-retain");
      }
      if (
        previous.countMode === "distinct_objects" &&
        !("correction" in receipt) &&
        !receipt.objectId
      ) {
        throw new GoalReceiptInvalidProblem("object-id-required");
      }
      const deadline = previous.endsAt.getTime() + previous.allowedLatenessMs;
      const late = receivedAt.getTime() >= deadline;
      const inWindow =
        receipt.occurredAt >= previous.startedAt && receipt.occurredAt < previous.endsAt;
      if (!("correction" in receipt) && !inWindow) {
        throw new GoalReceiptInvalidProblem("outside-episode-window");
      }
      const kind = "correction" in receipt ? receipt.correction.kind : "action";
      const digest =
        "correction" in receipt || receipt.objectId === undefined
          ? null
          : objectDigest(key, receipt.objectId);
      const deletedObject = digest
        ? await client
            .select({ eventId: onboardingGoalReceipts.eventId })
            .from(onboardingGoalReceipts)
            .where(
              and(
                receiptWhere(key),
                eq(onboardingGoalReceipts.kind, "delete_object"),
                eq(onboardingGoalReceipts.accepted, "counted"),
                eq(onboardingGoalReceipts.objectDigest, digest),
              ),
            )
            .limit(1)
        : [];
      if ("correction" in receipt && receipt.correction.kind === "retract_event" && !late) {
        const target = await client
          .select()
          .from(onboardingGoalReceipts)
          .where(
            and(
              receiptWhere(key),
              eq(onboardingGoalReceipts.eventId, receipt.correction.targetEventId),
            ),
          )
          .limit(1);
        if (!target[0] || target[0].kind !== "action")
          throw new GoalReceiptInvalidProblem("target-event-missing");
      }
      await client.insert(onboardingGoalReceipts).values({
        tenantId: key.scope.tenantId,
        appId: key.scope.appId,
        environmentId: key.scope.environmentId,
        subjectId: key.subject.id,
        episodeId: key.episodeId,
        eventId: receipt.eventId,
        actionId: receipt.actionId,
        objectDigest:
          "correction" in receipt
            ? receipt.correction.kind === "delete_object"
              ? objectDigest(key, receipt.correction.objectId)
              : null
            : digest,
        occurredAt: receipt.occurredAt,
        receivedAt,
        receiptHash: evidenceHash(receipt),
        accepted: late ? "late_correction" : "counted",
        kind,
        targetEventId:
          "correction" in receipt && receipt.correction.kind === "retract_event"
            ? receipt.correction.targetEventId
            : null,
        retractedAt: deletedObject.length > 0 ? receivedAt : null,
      });
      if (!late && "correction" in receipt) {
        if (receipt.correction.kind === "retract_event") {
          await client
            .update(onboardingGoalReceipts)
            .set({ retractedAt: receivedAt })
            .where(
              and(
                receiptWhere(key),
                eq(onboardingGoalReceipts.eventId, receipt.correction.targetEventId),
              ),
            );
        } else {
          await client
            .update(onboardingGoalReceipts)
            .set({ retractedAt: receivedAt })
            .where(
              and(
                receiptWhere(key),
                eq(
                  onboardingGoalReceipts.objectDigest,
                  objectDigest(key, receipt.correction.objectId),
                ),
                eq(onboardingGoalReceipts.kind, "action"),
              ),
            );
        }
      }
      const progressRows = await client
        .select({ value: this.progressExpression(previous) })
        .from(onboardingGoalReceipts)
        .where(
          and(
            receiptWhere(key),
            eq(onboardingGoalReceipts.accepted, "counted"),
            eq(onboardingGoalReceipts.kind, "action"),
            isNull(onboardingGoalReceipts.retractedAt),
          ),
        );
      const progress = progressRows[0]?.value ?? 0;
      const achievedNow =
        previous.status !== "achieved" &&
        previous.status !== "canceled" &&
        !late &&
        progress >= previous.threshold;
      const status = achievedNow
        ? "achieved"
        : previous.status === "achieved" || previous.status === "canceled"
          ? previous.status
          : receivedAt.getTime() >= deadline
            ? "expired"
            : receivedAt >= previous.endsAt
              ? "closing"
              : "in_progress";
      const achievedAt = achievedNow ? receivedAt : previous.achievedAt;
      const updated = await client
        .update(onboardingGoalEpisodes)
        .set({ progress, status, achievedAt: achievedAt ?? null, updatedAt: receivedAt })
        .where(episodeWhere(key))
        .returning();
      if (!updated[0]) throw new GoalEpisodeNotFoundProblem();
      const episode = mapEpisode(updated[0]);
      if (!achievedNow) return { status: late ? "late_correction" : "recorded", episode };
      const achievedEvent: GoalAchievedEventIntent = {
        id: achievementId(key),
        episodeId: episode.id,
        scope: episode.scope,
        subject: episode.subject,
        definitionId: episode.definitionId,
        definitionVersion: episode.definitionVersion,
        achievedAt: receivedAt,
      };
      await this.outbox.append(new GoalAchievedDomainEvent(achievedEvent), {
        id: achievedEvent.id,
        aggregateId: achievementId(key),
        idempotencyKey: achievedEvent.id,
      });
      return { status: "recorded", episode, achievedEvent };
    });
  }

  private progressExpression(episode: GoalEpisode): SQL<number> {
    switch (episode.countMode) {
      case "events":
        return sql<number>`count(*)::bigint`.mapWith(Number);
      case "distinct_objects":
        return sql<number>`count(distinct ${onboardingGoalReceipts.objectDigest})::bigint`.mapWith(
          Number,
        );
      case "distinct_calendar_days":
        return sql<number>`count(distinct (${onboardingGoalReceipts.occurredAt} at time zone ${episode.timezone})::date)::bigint`.mapWith(
          Number,
        );
    }
    throw new GoalConflictProblem("count-mode-invalid");
  }

  private client(): DrizzleGoalClient {
    return this.txManager.getClient() ?? this.db;
  }
}

function evidenceHash(receipt: GoalEvidence): string {
  const correction =
    "correction" in receipt
      ? [
          receipt.correction.kind,
          receipt.correction.kind === "retract_event"
            ? receipt.correction.targetEventId
            : receipt.correction.objectId,
        ]
      : receipt.objectId;
  return createHash("sha256")
    .update(
      JSON.stringify([
        receipt.eventId,
        receipt.actionId,
        receipt.occurredAt.getTime(),
        receipt.confirmation.source,
        receipt.confirmation.evidenceId,
        correction,
      ]),
    )
    .digest("hex");
}
