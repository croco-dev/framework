import "reflect-metadata";
import { DefaultEventSerializer } from "@croco/events-core";
import {
  GoalManager,
  type GoalDefinitionPublication,
  type GoalScope,
} from "@croco/onboarding-core";
import {
  DrizzleTransactionalEventStore,
  TransactionalOutboxRelay,
  type DrizzleTransactionalEventStoreDb,
  type TransactionalEventStore,
} from "@croco/events-tx";
import { TxManager } from "@croco/tx-core";
import { createDrizzleTxAdapter } from "@croco/tx-drizzle";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DrizzleGoalStore, type DrizzleGoalClient } from "../libs/DrizzleGoalStore";
import { addOnboardingGoals, removeOnboardingGoals } from "../migrations/addOnboardingGoals";

const connectionString = process.env.ONBOARDING_POSTGRES_URL ?? "";
const scope: GoalScope = { tenantId: "tenant-goals", appId: "app-goals", environmentId: "test" };
const subject = { id: "subject-goals", verified: true } as const;
const startedAt = new Date("2026-09-01T00:00:00.000Z");

function publication(
  countMode: GoalDefinitionPublication["definition"]["countMode"],
  overrides: Partial<GoalDefinitionPublication["definition"]> = {},
  revision = 1,
): GoalDefinitionPublication {
  return {
    scope,
    definition: {
      id: "goal",
      version: `v${revision}`,
      anchor: "signup",
      actionId: "report.saved",
      windowMs: 7 * 86_400_000,
      allowedLatenessMs: 86_400_000,
      timezone: "Asia/Seoul",
      countMode,
      threshold: 3,
      deletedObjectPolicy: "retract",
      ...overrides,
    },
    revision,
    actorId: "operator",
    reason: "activation target",
    idempotencyKey: `publication-${revision}`,
    publishedAt: new Date("2026-08-31T00:00:00.000Z"),
  };
}

function receipt(eventId: string, occurredAt: Date, objectId = eventId) {
  return {
    eventId,
    actionId: "report.saved",
    objectId,
    occurredAt,
    confirmation: { source: "server" as const, evidenceId: `domain-${eventId}` },
  };
}

type Worker = {
  pool: Pool;
  db: DrizzleGoalClient;
  manager: GoalManager;
  store: DrizzleGoalStore;
  txManager: TxManager<DrizzleGoalClient>;
  eventStore: TransactionalEventStore<DrizzleGoalClient>;
};

function createWorker(pool: Pool): Worker {
  const db = drizzle(pool) as unknown as DrizzleGoalClient;
  const txManager = new TxManager(createDrizzleTxAdapter(db));
  const eventStore = new DrizzleTransactionalEventStore({
    db: db as unknown as DrizzleTransactionalEventStoreDb,
    txManager: txManager as unknown as TxManager<DrizzleTransactionalEventStoreDb>,
  }) as unknown as TransactionalEventStore<DrizzleGoalClient>;
  const store = new DrizzleGoalStore(db, txManager);
  const manager = new GoalManager(
    store,
    { verify: async () => undefined },
    { authorize: async () => true },
    { verify: async () => true },
  );
  return { pool, db, manager, store, txManager, eventStore };
}

describe.skipIf(!connectionString)("DrizzleGoalStore PostgreSQL", () => {
  let first!: Worker;
  let second!: Worker;

  beforeAll(async () => {
    first = createWorker(new Pool({ connectionString, max: 2 }));
    second = createWorker(new Pool({ connectionString, max: 2 }));
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
    await addOnboardingGoals({ execute: (query) => first.db.execute(query) });
  });

  beforeEach(async () => {
    await first.pool.query(
      "truncate onboarding_goal_receipts, onboarding_goal_episodes, onboarding_goal_definitions, croco_outbox_messages cascade",
    );
  });

  afterAll(async () => {
    if (first) {
      await removeOnboardingGoals({ execute: (query) => first.db.execute(query) });
      await first.pool.query("drop table if exists croco_outbox_messages");
      await first.pool.end();
      await second.pool.end();
    }
  });

  async function begin(
    mode: GoalDefinitionPublication["definition"]["countMode"] = "events",
    threshold = 3,
  ) {
    await first.manager.publishDefinition(publication(mode, { threshold }));
    return first.manager.beginEpisode({
      id: "episode",
      scope,
      subject,
      definitionId: "goal",
      anchor: "signup",
      startedAt,
    });
  }

  const observe = (
    worker: Worker,
    eventId: string,
    occurredAt: Date,
    objectId = eventId,
    receivedAt = occurredAt,
  ) =>
    worker.manager.observeAction({
      scope,
      subject,
      episodeId: "episode",
      receipt: receipt(eventId, occurredAt, objectId),
      receivedAt,
    });

  it("counts events and distinct units while suppressing the same event identity", async () => {
    for (const [mode, expected] of [
      ["events", 3],
      ["distinct_objects", 2],
      ["distinct_calendar_days", 1],
    ] as const) {
      await first.pool.query(
        "truncate onboarding_goal_receipts, onboarding_goal_episodes, onboarding_goal_definitions, croco_outbox_messages cascade",
      );
      await begin(mode, 4);
      const time = new Date("2026-09-01T04:00:00.000Z");
      await observe(first, "event-1", time, "object-1");
      await observe(first, "event-2", new Date(time.getTime() + 1_000), "object-1");
      await observe(first, "event-3", new Date(time.getTime() + 2_000), "object-2");
      expect(
        (await observe(second, "event-3", new Date(time.getTime() + 2_000), "object-2")).status,
      ).toBe("duplicate");
      const progress = await second.manager.getProgress({
        scope,
        subject,
        episodeId: "episode",
        asOf: time,
      });
      expect(progress.progress).toBe(expected);
    }
  });

  it("replays a published definition by idempotency key while rejecting changed policy", async () => {
    const firstPublication = publication("events");
    const published = await first.manager.publishDefinition(firstPublication);
    expect(published.status).toBe("published");
    const replay = await second.manager.publishDefinition({
      ...firstPublication,
      publishedAt: new Date("2026-09-02T00:00:00.000Z"),
    });
    expect(replay).toEqual({ status: "duplicate", publication: published.publication });
    await expect(
      second.manager.publishDefinition({
        ...firstPublication,
        definition: { ...firstPublication.definition, threshold: 5 },
      }),
    ).rejects.toMatchObject({ code: "onboarding/goal-conflict" });
  });

  it("uses publication keys independently for separate goal definitions", async () => {
    await first.manager.publishDefinition(publication("events"));
    const result = await second.manager.publishDefinition(
      publication("events", { id: "second-goal" }),
    );
    expect(result.status).toBe("published");
  });

  it("persists policy durations and thresholds beyond PostgreSQL int32", async () => {
    const longWindowMs = 40 * 86_400_000;
    const longLatenessMs = 35 * 86_400_000;
    const largeThreshold = 2_147_483_648;
    await first.manager.publishDefinition(
      publication("events", {
        windowMs: longWindowMs,
        allowedLatenessMs: longLatenessMs,
        threshold: largeThreshold,
      }),
    );
    const begun = await second.manager.beginEpisode({
      id: "episode-long",
      scope,
      subject,
      definitionId: "goal",
      anchor: "signup",
      startedAt,
    });
    expect(begun.episode.endsAt.getTime()).toBe(startedAt.getTime() + longWindowMs);
    expect(begun.episode.allowedLatenessMs).toBe(longLatenessMs);
    expect(begun.episode.threshold).toBe(largeThreshold);
  });

  it("serializes simultaneous final actions into one achieved transition and outbox message", async () => {
    await begin("events", 2);
    const time = new Date("2026-09-01T04:00:00.000Z");
    await observe(first, "event-1", time);
    const [a, b] = await Promise.all([
      observe(first, "event-2", new Date(time.getTime() + 1_000)),
      observe(second, "event-2", new Date(time.getTime() + 1_000)),
    ]);
    expect([a.status, b.status].sort()).toEqual(["duplicate", "recorded"]);
    expect([a.achievedEvent, b.achievedEvent].filter(Boolean)).toHaveLength(1);
    const rows = await first.pool.query(
      "select event_id, event_type, occurred_at, payload from croco_outbox_messages",
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]).toMatchObject({
      event_id: a.achievedEvent?.id ?? b.achievedEvent?.id,
      event_type: "onboarding.goal.achieved",
    });
    const event = new DefaultEventSerializer().deserialize({
      eventId: rows.rows[0].event_id,
      eventType: rows.rows[0].event_type,
      occurredAt: rows.rows[0].occurred_at.toISOString(),
      payload: rows.rows[0].payload,
    });
    expect(event).toMatchObject({
      id: a.achievedEvent?.id ?? b.achievedEvent?.id,
      subject,
      definitionId: "goal",
    });
    expect(
      (await second.store.getEpisode({ scope, subject, episodeId: "episode" }))?.progress,
    ).toBe(2);
  });

  it("keeps receipts and outbox pending across rollback, failed publish, and restart", async () => {
    await begin("events", 1);
    const time = new Date("2026-09-01T04:00:00.000Z");
    await expect(
      first.txManager.run(async () => {
        await observe(first, "rolled-back", time);
        throw new Error("domain rolled back");
      }),
    ).rejects.toThrow("domain rolled back");
    expect((await first.store.getEpisode({ scope, subject, episodeId: "episode" }))?.progress).toBe(
      0,
    );
    expect(
      (await first.pool.query("select count(*)::integer as count from croco_outbox_messages"))
        .rows[0]?.count,
    ).toBe(0);

    const result = await observe(first, "committed", time);
    expect(result.achievedEvent).toBeDefined();
    const failedPublish = vi.fn(async () => {
      throw new Error("transport unavailable");
    });
    const failedRelay = new TransactionalOutboxRelay({
      store: first.eventStore,
      publish: failedPublish,
      retry: { baseDelayMs: 0, maxDelayMs: 0, multiplier: 1 },
    });
    await failedRelay.publishBatch();
    const publish = vi.fn(async () => undefined);
    const restartedRelay = new TransactionalOutboxRelay({ store: second.eventStore, publish });
    await restartedRelay.publishBatch();
    expect(publish).toHaveBeenCalledTimes(1);
    expect((await observe(second, "committed", time)).status).toBe("duplicate");
    expect(
      (await first.pool.query("select count(*)::integer as count from croco_outbox_messages"))
        .rows[0]?.count,
    ).toBe(1);
  });

  it("pins v1 episode policy when v2 is published and records late evidence without achievement", async () => {
    await begin("events", 2);
    await first.manager.publishDefinition(
      publication("distinct_calendar_days", { threshold: 10, timezone: "UTC" }, 2),
    );
    const end = new Date(startedAt.getTime() + 7 * 86_400_000);
    const closing = await observe(first, "event-1", new Date(end.getTime() - 1), "object-1", end);
    expect(closing.episode.status).toBe("closing");
    const late = await observe(
      second,
      "event-2",
      new Date(end.getTime() - 2),
      "object-2",
      new Date(end.getTime() + 86_400_001),
    );
    expect(late.status).toBe("late_correction");
    expect(late.episode).toMatchObject({
      definitionVersion: "v1",
      threshold: 2,
      timezone: "Asia/Seoul",
      progress: 1,
      status: "expired",
    });
  });

  it("retracts a deleted object's distinct count without retaining raw identifiers", async () => {
    await begin("distinct_objects", 3);
    const time = new Date("2026-09-01T04:00:00.000Z");
    await observe(first, "event-private-1", time, "private-object-1");
    await observe(first, "event-private-2", new Date(time.getTime() + 1_000), "private-object-2");
    const end = new Date(startedAt.getTime() + 7 * 86_400_000);
    await expect(
      first.store.observeAction({
        key: { scope, subject, episodeId: "episode" },
        receipt: receipt("outside-window", end),
        receivedAt: end,
      }),
    ).rejects.toMatchObject({ code: "onboarding/goal-receipt-invalid" });
    const correction = {
      eventId: "delete-private-object-1",
      actionId: "report.saved",
      occurredAt: end,
      confirmation: { source: "server" as const, evidenceId: "private-evidence" },
      correction: { kind: "delete_object" as const, objectId: "private-object-1" },
    };
    const result = await second.manager.observeAction({
      scope,
      subject,
      episodeId: "episode",
      receipt: correction,
      receivedAt: correction.occurredAt,
    });
    expect(result.episode.progress).toBe(1);
    const delayed = await observe(
      first,
      "event-private-delayed",
      new Date(time.getTime() + 2_000),
      "private-object-1",
      new Date(end.getTime() + 1_000),
    );
    expect(delayed.episode.progress).toBe(1);
    const stored = await first.pool.query(
      "select object_digest, receipt_hash from onboarding_goal_receipts order by event_id",
    );
    expect(JSON.stringify(stored.rows)).not.toContain("private-object-1");
    expect(JSON.stringify(stored.rows)).not.toContain("private-evidence");
    expect(
      (
        await second.manager.observeAction({
          scope,
          subject,
          episodeId: "episode",
          receipt: {
            ...correction,
            confirmation: {
              evidenceId: correction.confirmation.evidenceId,
              source: correction.confirmation.source,
            },
          },
          receivedAt: correction.occurredAt,
        })
      ).status,
    ).toBe("duplicate");
  });

  it("expires before accepting an action received at the exact deadline", async () => {
    await begin("events", 1);
    const end = new Date(startedAt.getTime() + 7 * 86_400_000);
    const deadline = new Date(end.getTime() + 86_400_000);
    const result = await observe(
      first,
      "deadline-event",
      new Date(end.getTime() - 1),
      "object-deadline",
      deadline,
    );
    expect(result).toMatchObject({
      status: "late_correction",
      episode: { status: "expired", progress: 0 },
    });
  });
});
