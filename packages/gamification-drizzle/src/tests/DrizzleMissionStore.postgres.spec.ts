import "reflect-metadata";
import { DefaultEventSerializer } from "@croco/events-core";
import {
  DrizzleTransactionalEventStore,
  TransactionalOutbox,
  TransactionalOutboxRelay,
  type DrizzleTransactionalEventStoreDb,
  type TransactionalEventStore,
} from "@croco/events-tx";
import {
  MissionConflictProblem,
  MissionService,
  type MissionCommand,
  type MissionPublication,
} from "@croco/gamification-core";
import { TxManager } from "@croco/tx-core";
import { createDrizzleTxAdapter } from "@croco/tx-drizzle";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  DrizzleMissionStore,
  MissionCompletedDomainEvent,
  type DrizzleMissionClient,
  addGamificationMissions,
  removeGamificationMissions,
} from "../index";

const connectionString = process.env.MISSIONS_POSTGRES_URL;
const scope = { appId: "app", environmentId: "test", tenantId: "tenant" };
const command: MissionCommand = {
  actor: { id: "user" },
  key: {
    scope,
    subjectId: "user",
    missionId: "save",
    version: 1,
    episodeId: "first",
    periodKey: "2026-03-02",
  },
};
const publication: MissionPublication = {
  scope,
  definition: {
    id: "save",
    version: 1,
    actionId: "save-result",
    countMode: "events",
    unit: "event",
    timezone: "America/New_York",
    period: "week",
    anchor: "2026-03-02",
    target: 3,
    perPeriodCap: 5,
    lateAcceptanceMs: 3600000,
    closedCorrection: "recalculate",
  },
  actorId: "user",
  reason: "Initial mission",
  revision: 1,
  idempotencyKey: "publish-1",
  publishedAt: "2026-03-01T00:00:00Z",
};
const evidence = (eventId: string) => ({
  eventId,
  actionId: "save-result",
  occurredAt: "2026-03-03T15:00:00Z",
});
function worker(withOutbox = true) {
  const pool = new Pool({ connectionString, max: 2 });
  const db = drizzle(pool) as unknown as DrizzleMissionClient;
  const txManager = new TxManager(createDrizzleTxAdapter(db));
  const eventStore = new DrizzleTransactionalEventStore({
    db: db as unknown as DrizzleTransactionalEventStoreDb,
    txManager: txManager as unknown as TxManager<DrizzleTransactionalEventStoreDb>,
  }) as unknown as TransactionalEventStore<DrizzleMissionClient>;
  const outbox = new TransactionalOutbox({ store: eventStore, txManager });
  const store = new DrizzleMissionStore(db, txManager, withOutbox ? outbox : undefined);
  const service = new MissionService({
    store,
    authorization: { authorize: async () => true },
    verifier: { verify: async () => true },
    clock: () => new Date("2026-03-08T20:00:00Z"),
  });
  return { pool, db, txManager, store, service, eventStore };
}

describe.skipIf(!connectionString)("DrizzleMissionStore PostgreSQL", () => {
  let first: ReturnType<typeof worker>;
  let second: ReturnType<typeof worker>;
  beforeAll(async () => {
    first = worker();
    second = worker();
    await first.pool.query(`
      create table if not exists croco_outbox_messages (
        id varchar(128) primary key,
        event_id varchar(128) not null,
        event_type text not null,
        aggregate_id text,
        idempotency_key varchar(255) not null unique,
        payload jsonb not null,
        metadata jsonb not null,
        trace_context jsonb,
        attempts integer not null default 0,
        max_attempts integer not null default 3,
        status text not null,
        visible_at timestamp not null,
        occurred_at timestamp not null,
        created_at timestamp not null default now(),
        updated_at timestamp not null default now(),
        locked_until timestamp,
        published_at timestamp,
        last_error jsonb,
        dead_lettered_at timestamp,
        dead_letter_reason text,
        diagnostics jsonb not null
      )
    `);
    await addGamificationMissions(first.db);
    await addGamificationMissions(first.db);
  });
  beforeEach(async () => {
    await first.pool.query(
      "TRUNCATE gamification_completions, gamification_evidence, gamification_instances, gamification_definitions, croco_outbox_messages",
    );
    await first.service.publishDefinition({ actor: command.actor, publication });
  });
  afterAll(async () => {
    await removeGamificationMissions(first.db);
    await first.pool.query("DROP TABLE IF EXISTS croco_outbox_messages");
    await first.pool.end();
    await second.pool.end();
  });
  const ingest = (w: ReturnType<typeof worker>, id: string) =>
    w.service.ingestEvidence({ ...command, evidence: evidence(id) });

  it("serializes simultaneous last evidence and persists exactly one completion", async () => {
    await ingest(first, "1");
    await ingest(first, "2");
    const results = await Promise.all([ingest(first, "3"), ingest(second, "3")]);
    expect(results.map((r) => r.duplicate).sort()).toEqual([false, true]);
    expect(results.filter((r) => r.completionCreated)).toHaveLength(1);
    expect((await second.service.getProgress(command)).instance.progress).toBe(3);
    expect((await first.pool.query("SELECT * FROM gamification_completions")).rows).toHaveLength(1);
    expect((await first.pool.query("SELECT * FROM gamification_evidence")).rows).toHaveLength(3);
    const outbox = await first.eventStore.listOutboxMessages();
    expect(outbox).toHaveLength(1);
    const row = outbox[0];
    const event = new DefaultEventSerializer().deserialize({
      eventType: row.eventType,
      eventId: row.eventId,
      occurredAt: row.occurredAt.toISOString(),
      payload: row.payload,
    });
    expect(event).toBeInstanceOf(MissionCompletedDomainEvent);
    expect(event).toMatchObject({
      key: command.key,
      completion: results.find((result) => result.completionCreated)?.progress.instance.completion,
    });
    expect(event.eventId).toBe(row.id);
    expect(event.timestamp.toISOString()).toBe("2026-03-08T20:00:00.000Z");
  });

  it("serializes concurrent evidence inside one ambient transaction", async () => {
    await ingest(first, "1");
    const results = await first.txManager.run(() =>
      Promise.all([ingest(first, "2"), ingest(first, "3")]),
    );
    expect(results.filter((result) => result.completionCreated)).toHaveLength(1);
    expect((await second.service.getProgress(command)).instance.progress).toBe(3);
    expect((await first.pool.query("SELECT * FROM gamification_evidence")).rows).toHaveLength(3);
    expect((await first.pool.query("SELECT * FROM gamification_completions")).rows).toHaveLength(1);
    expect((await first.pool.query("SELECT * FROM croco_outbox_messages")).rows).toHaveLength(1);
  });

  it("rolls back all completion writes when selected outbox persistence fails", async () => {
    await ingest(first, "1");
    await ingest(first, "2");
    await first.pool.query(
      "ALTER TABLE croco_outbox_messages ADD CONSTRAINT reject_mission_events CHECK (event_type <> 'gamification.mission.completed')",
    );
    try {
      await expect(ingest(first, "3")).rejects.toBeDefined();
      expect((await second.service.getProgress(command)).instance.progress).toBe(2);
      expect((await first.pool.query("SELECT * FROM gamification_evidence")).rows).toHaveLength(2);
      expect((await first.pool.query("SELECT * FROM gamification_completions")).rows).toHaveLength(
        0,
      );
      expect((await first.pool.query("SELECT * FROM croco_outbox_messages")).rows).toHaveLength(0);
    } finally {
      await first.pool.query(
        "ALTER TABLE croco_outbox_messages DROP CONSTRAINT reject_mission_events",
      );
    }
    expect((await ingest(first, "3")).completionCreated).toBe(true);
  });

  it("delivers a stable completion identity through the existing relay after publish failure", async () => {
    await ingest(first, "1");
    await ingest(first, "2");
    await ingest(first, "3");
    const failed = new TransactionalOutboxRelay({
      store: first.eventStore,
      publish: async () => {
        throw new Error("transport unavailable");
      },
      retry: { baseDelayMs: 0, maxDelayMs: 0, multiplier: 1 },
    });
    await failed.publishBatch();
    const deliveries: string[] = [];
    const relay = new TransactionalOutboxRelay({
      store: second.eventStore,
      publish: async (message) => {
        const event = new DefaultEventSerializer().deserialize({
          eventType: message.eventType,
          eventId: message.eventId,
          occurredAt: message.occurredAt.toISOString(),
          payload: message.payload,
        });
        expect(event).toBeInstanceOf(MissionCompletedDomainEvent);
        deliveries.push(event.eventId);
      },
    });
    await relay.publishBatch();
    await relay.publishBatch();
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].length).toBeLessThan(128);
    expect((await ingest(second, "3")).duplicate).toBe(true);
    expect((await first.pool.query("SELECT * FROM croco_outbox_messages")).rows).toHaveLength(1);
  });

  it("keeps standalone completion persistence independent of an unselected outbox", async () => {
    const standalone = worker(false);
    try {
      await ingest(standalone, "1");
      await ingest(standalone, "2");
      expect((await ingest(standalone, "3")).completionCreated).toBe(true);
      expect((await first.pool.query("SELECT * FROM gamification_completions")).rows).toHaveLength(
        1,
      );
      expect((await first.pool.query("SELECT * FROM croco_outbox_messages")).rows).toHaveLength(0);
    } finally {
      await standalone.pool.end();
    }
  });

  it("accepts opaque event identities that overlap object property names", async () => {
    for (const eventId of ["toString", "constructor", "__proto__"]) {
      expect((await ingest(first, eventId)).duplicate).toBe(false);
      expect((await ingest(second, eventId)).duplicate).toBe(true);
    }
    expect((await second.service.getProgress(command)).instance.progress).toBe(3);
  });

  it("serializes different concurrent final events without losing progress", async () => {
    await ingest(first, "1");
    await ingest(first, "2");
    const results = await Promise.all([ingest(first, "3"), ingest(second, "4")]);
    expect(results.filter((r) => r.completionCreated)).toHaveLength(1);
    expect((await second.service.getProgress(command)).instance.progress).toBe(4);
    expect((await first.pool.query("SELECT * FROM gamification_completions")).rows).toHaveLength(1);
  });

  it("retains correction receipts and historical completion after a fresh connection restart", async () => {
    await ingest(first, "1");
    await ingest(first, "2");
    await ingest(first, "3");
    await second.service.ingestEvidence({
      ...command,
      evidence: { ...evidence("undo-3"), reversalOf: "3" },
    });
    const restarted = worker();
    try {
      const aggregate = await restarted.store.read(command.key);
      expect(aggregate?.instances[command.key.periodKey].progress).toBe(2);
      expect(Object.keys(aggregate?.receipts ?? {})).toHaveLength(4);
      expect(Object.keys(aggregate?.completions ?? {})).toHaveLength(1);
      expect((await ingest(restarted, "3")).duplicate).toBe(true);
      await expect(
        restarted.service.ingestEvidence({
          ...command,
          evidence: { ...evidence("3"), occurredAt: "2026-03-04T15:00:00Z" },
        }),
      ).rejects.toBeInstanceOf(MissionConflictProblem);
    } finally {
      await restarted.pool.end();
    }
  });

  it("rolls back instance evidence and completion in the caller transaction", async () => {
    await expect(
      first.txManager.run(async () => {
        await ingest(first, "1");
        throw new Error("domain rejected");
      }),
    ).rejects.toThrow("domain rejected");
    expect(await second.store.read(command.key)).toBeUndefined();
    expect((await first.pool.query("SELECT * FROM gamification_evidence")).rows).toHaveLength(0);
    expect((await first.pool.query("SELECT * FROM gamification_completions")).rows).toHaveLength(0);
  });

  it("keeps publication audit immutable with scoped revision and idempotency conflicts", async () => {
    expect(await second.store.publish(publication)).toEqual(publication);
    await expect(
      second.store.publish({ ...publication, publishedAt: "2026-03-02T00:00:00Z" }),
    ).rejects.toBeInstanceOf(MissionConflictProblem);
    await expect(
      second.store.publish({ ...publication, reason: "Changed" }),
    ).rejects.toBeInstanceOf(MissionConflictProblem);
    await expect(
      second.store.publish({
        ...publication,
        revision: 3,
        idempotencyKey: "gap",
        definition: { ...publication.definition, version: 2 },
      }),
    ).rejects.toBeInstanceOf(MissionConflictProblem);
    await expect(
      second.store.publish({ ...publication, revision: 2, idempotencyKey: "rewrite" }),
    ).rejects.toBeInstanceOf(MissionConflictProblem);
    expect(
      await second.store.getDefinition({ ...scope, tenantId: "other" }, "save", 1),
    ).toBeUndefined();
    expect(await second.store.getDefinition(scope, "save", 1)).toEqual(publication);
  });

  it("rejects event reuse across versions and timezone changes atomically", async () => {
    await ingest(first, "1");
    await first.store.publish({
      ...publication,
      definition: { ...publication.definition, version: 2, timezone: "Asia/Seoul" },
      revision: 2,
      idempotencyKey: "v2",
    });
    const next = { ...command, key: { ...command.key, version: 2, episodeId: "return" } };
    await expect(
      second.service.ingestEvidence({ ...next, evidence: evidence("1") }),
    ).rejects.toBeInstanceOf(MissionConflictProblem);
    expect(await second.store.read(next.key)).toBeUndefined();
    expect((await first.service.getProgress(command)).definition.timezone).toBe("America/New_York");
  });

  it("isolates app environment tenant and subject for evidence identities", async () => {
    await ingest(first, "same");
    for (const changed of [
      { ...scope, appId: "other" },
      { ...scope, environmentId: "other" },
      { ...scope, tenantId: "other" },
    ]) {
      await second.store.publish({ ...publication, scope: changed });
      const result = await second.service.ingestEvidence({
        ...command,
        key: { ...command.key, scope: changed },
        evidence: evidence("same"),
      });
      expect(result.progress.instance.progress).toBe(1);
    }
    const result = await second.service.ingestEvidence({
      ...command,
      key: { ...command.key, subjectId: "other" },
      evidence: evidence("same"),
    });
    expect(result.progress.instance.progress).toBe(1);
    expect((await first.service.getProgress(command)).instance.progress).toBe(1);
  });
});
