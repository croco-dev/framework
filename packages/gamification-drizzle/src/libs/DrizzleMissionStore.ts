import { isDeepStrictEqual } from "node:util";
import type { TransactionalOutbox } from "@croco/events-tx";
import { MissionCompletedDomainEvent } from "./MissionCompletedDomainEvent";
import { MissionConflictProblem } from "@croco/gamification-core";
import type {
  MissionAggregate,
  MissionAggregateKey,
  MissionPublication,
  MissionScope,
  MissionStore,
} from "@croco/gamification-core";
import type { TxManager } from "@croco/tx-core";
import type { DrizzleDb } from "@croco/tx-drizzle";
import { and, desc, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  missionCompletions,
  missionDefinitions,
  missionEvidence,
  missionInstances,
} from "./schema";

export type DrizzleMissionClient = DrizzleDb & NodePgDatabase<Record<string, never>>;
const keyValues = (key: MissionAggregateKey) => ({
  ...key.scope,
  subjectId: key.subjectId,
  missionId: key.missionId,
  version: key.version,
  episodeId: key.episodeId,
  periodKey: key.periodKey,
});
function keyWhere(
  table: typeof missionInstances | typeof missionEvidence | typeof missionCompletions,
  key: MissionAggregateKey,
) {
  return and(
    eq(table.tenantId, key.scope.tenantId),
    eq(table.appId, key.scope.appId),
    eq(table.environmentId, key.scope.environmentId),
    eq(table.subjectId, key.subjectId),
    eq(table.missionId, key.missionId),
    eq(table.version, key.version),
    eq(table.episodeId, key.episodeId),
    eq(table.periodKey, key.periodKey),
  );
}
function definitionWhere(scope: MissionScope, missionId: string) {
  return and(
    eq(missionDefinitions.tenantId, scope.tenantId),
    eq(missionDefinitions.appId, scope.appId),
    eq(missionDefinitions.environmentId, scope.environmentId),
    eq(missionDefinitions.missionId, missionId),
  );
}

export class DrizzleMissionStore implements MissionStore {
  constructor(
    private readonly db: DrizzleMissionClient,
    private readonly txManager: TxManager<DrizzleMissionClient>,
    private readonly outbox?: TransactionalOutbox<DrizzleMissionClient>,
  ) {}

  async transaction<T>(
    key: MissionAggregateKey,
    operation: (current: MissionAggregate | undefined) => {
      aggregate: MissionAggregate;
      result: T;
    },
  ): Promise<T> {
    return this.txManager.run(
      async () => {
        await this.lock(key);
        const current = await this.load(key);
        const { aggregate, result } = operation(
          current === undefined ? undefined : structuredClone(current),
        );
        if (!isDeepStrictEqual(aggregate.key, key))
          throw new MissionConflictProblem("aggregate-key-changed");
        const client = this.client();
        await client
          .insert(missionInstances)
          .values({
            ...keyValues(key),
            definition: aggregate.definition,
            instances: aggregate.instances,
          })
          .onConflictDoUpdate({
            target: [
              missionInstances.tenantId,
              missionInstances.appId,
              missionInstances.environmentId,
              missionInstances.subjectId,
              missionInstances.missionId,
              missionInstances.version,
              missionInstances.episodeId,
              missionInstances.periodKey,
            ],
            set: { instances: aggregate.instances },
          });
        for (const [eventId, receipt] of Object.entries(aggregate.receipts)) {
          const previous =
            current && Object.hasOwn(current.receipts, eventId)
              ? current.receipts[eventId]
              : undefined;
          if (previous) {
            if (!isDeepStrictEqual(previous, receipt))
              throw new MissionConflictProblem("evidence-receipt-changed");
            continue;
          }
          const rows = await client
            .insert(missionEvidence)
            .values({ ...keyValues(key), eventId, receipt })
            .onConflictDoNothing()
            .returning({ eventId: missionEvidence.eventId });
          if (!rows[0]) throw new MissionConflictProblem("event-already-used-by-another-instance");
        }
        for (const [periodKey, completion] of Object.entries(aggregate.completions)) {
          const previous = current?.completions[periodKey];
          if (previous) {
            if (!isDeepStrictEqual(previous, completion))
              throw new MissionConflictProblem("completion-changed");
            continue;
          }
          await client
            .insert(missionCompletions)
            .values({ ...keyValues(key), completionPeriodKey: periodKey, completion });
          if (this.outbox) {
            const event = new MissionCompletedDomainEvent(key, completion);
            await this.outbox.append(event, {
              id: event.eventId,
              aggregateId: event.eventId,
              idempotencyKey: event.eventId,
            });
          }
        }
        return result;
      },
      { nesting: "savepoint" },
    );
  }

  async read(key: MissionAggregateKey): Promise<MissionAggregate | undefined> {
    return this.txManager.run(
      async () => {
        await this.lock(key);
        return this.load(key);
      },
      { nesting: "savepoint" },
    );
  }

  async publish(publication: MissionPublication): Promise<MissionPublication> {
    return this.txManager.run(
      async () => {
        const client = this.client();
        const { scope, definition } = publication;
        const lock = JSON.stringify([
          "mission-definition",
          scope.tenantId,
          scope.appId,
          scope.environmentId,
          definition.id,
        ]);
        await client.execute(sql`select pg_advisory_xact_lock(hashtextextended(${lock}, 0))`);
        const where = definitionWhere(scope, definition.id);
        const duplicates = await client
          .select()
          .from(missionDefinitions)
          .where(and(where, eq(missionDefinitions.idempotencyKey, publication.idempotencyKey)))
          .limit(1);
        if (duplicates[0]) {
          if (!isDeepStrictEqual(duplicates[0].publication, publication))
            throw new MissionConflictProblem("publication-idempotency-key-reused");
          return duplicates[0].publication;
        }
        const latest = await client
          .select()
          .from(missionDefinitions)
          .where(where)
          .orderBy(desc(missionDefinitions.revision))
          .limit(1);
        if (publication.revision !== (latest[0]?.revision ?? 0) + 1)
          throw new MissionConflictProblem("publication-revision");
        const inserted = await client
          .insert(missionDefinitions)
          .values({
            ...scope,
            missionId: definition.id,
            version: definition.version,
            revision: publication.revision,
            idempotencyKey: publication.idempotencyKey,
            publication,
          })
          .onConflictDoNothing()
          .returning();
        if (!inserted[0]) throw new MissionConflictProblem("definition-version-exists");
        return inserted[0].publication;
      },
      { nesting: "savepoint" },
    );
  }

  async getDefinition(
    scope: MissionScope,
    missionId: string,
    version: number,
  ): Promise<MissionPublication | undefined> {
    const rows = await this.client()
      .select()
      .from(missionDefinitions)
      .where(and(definitionWhere(scope, missionId), eq(missionDefinitions.version, version)))
      .limit(1);
    return rows[0]?.publication;
  }

  private client(): DrizzleMissionClient {
    return this.txManager.getClient() ?? this.db;
  }
  private async lock(key: MissionAggregateKey): Promise<void> {
    const identity = JSON.stringify([
      "mission-instance",
      key.scope.tenantId,
      key.scope.appId,
      key.scope.environmentId,
      key.subjectId,
      key.missionId,
      key.version,
      key.episodeId,
      key.periodKey,
    ]);
    await this.client().execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${identity}, 0))`,
    );
  }
  private async load(key: MissionAggregateKey): Promise<MissionAggregate | undefined> {
    const client = this.client();
    const rows = await client
      .select()
      .from(missionInstances)
      .where(keyWhere(missionInstances, key))
      .for("update")
      .limit(1);
    if (!rows[0]) return undefined;
    const receipts = await client
      .select()
      .from(missionEvidence)
      .where(keyWhere(missionEvidence, key));
    const completions = await client
      .select()
      .from(missionCompletions)
      .where(keyWhere(missionCompletions, key));
    return {
      key,
      definition: rows[0].definition,
      instances: rows[0].instances,
      receipts: Object.fromEntries(receipts.map((row) => [row.eventId, row.receipt])),
      completions: Object.fromEntries(
        completions.map((row) => [row.completionPeriodKey, row.completion]),
      ),
    };
  }
}
