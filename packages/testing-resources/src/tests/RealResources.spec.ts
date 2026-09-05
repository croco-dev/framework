import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DomainEvent } from "@croco/events-core";
import {
  DrizzleTransactionalEventStore,
  OutboxIdempotencyConflictProblem,
  type DrizzleTransactionalEventStoreDb,
  TransactionalOutbox,
} from "@croco/events-tx";
import { Token } from "@croco/framework-context";
import { createTestKernel } from "@croco/testing";
import { createApp } from "@croco/transports-http";
import { type TxAdapter, TxManager } from "@croco/tx-core";
import { createDrizzleTxAdapter } from "@croco/tx-drizzle";
import { drizzle } from "drizzle-orm/node-postgres";
import { afterEach, describe, expect, it } from "vitest";
import {
  type PostgresTestConnection,
  postgresResource,
  type RedisTestConnection,
  redisResource,
  testResourceProvider,
} from "../index";

const realResourcesEnabled = process.env.CROCO_TEST_REAL_RESOURCES === "1";
const temporaryDirectories: string[] = [];

class ResourceCommittedEvent extends DomainEvent {
  static eventName = "testing.resource-committed";

  constructor(readonly value: string) {
    super();
  }
}

function bootstrapEmptyApplication() {
  return createApp({
    controllers: [],
    diValidation: "off",
    securityValidation: "off",
  });
}

async function createMigrationDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "croco-testing-resources-"));
  temporaryDirectories.push(directory);
  await writeFile(
    join(directory, "0001_resource_tables.sql"),
    `
      create table resource_values (
        id text primary key,
        value text not null
      );
      create table croco_outbox_messages (
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
      );
    `,
  );
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe.skipIf(!realResourcesEnabled)("real TestKernel resources", () => {
  it("keeps Drizzle writes isolated inside rollback mode", async () => {
    const postgres = postgresResource({ mode: "rollback" });
    await using kernel = await createTestKernel({
      bootstrap: bootstrapEmptyApplication,
      fidelity: "application",
      resources: [postgres],
      validation: { di: "off", security: "off" },
      workerId: "rollback-worker",
    });
    const connection = kernel.resource(postgres);
    const db = drizzle(connection.client ?? connection.pool);

    await db.execute("create table rollback_values (id text primary key, value text not null)");
    await db.execute("insert into rollback_values (id, value) values ('inside', 'uncommitted')");

    const outside = await connection.pool.query(
      "select to_regclass('public.rollback_values') as table_name",
    );
    expect(outside.rows).toEqual([{ table_name: null }]);
    expect(kernel.resourceEvidence[0]?.fidelity).toMatchObject({
      isolation: "database-per-worker",
      kind: "postgresql",
      mode: "rollback",
    });
  });

  it("migrates an empty PostgreSQL database and commits a real Drizzle outbox transaction", async () => {
    const migrations = await createMigrationDirectory();
    const postgres = postgresResource({ migrations, mode: "migration" });
    await using kernel = await createTestKernel({
      bootstrap: bootstrapEmptyApplication,
      fidelity: "application",
      obligations: [{ kind: "outbox", resource: postgres }],
      resources: [postgres],
      validation: { di: "off", security: "off" },
      workerId: "commit-worker",
    });
    const connection = kernel.resource(postgres);
    const db = drizzle(connection.pool);
    // Drizzle's concrete fluent builders are narrower than the structural ports exposed by
    // events-tx and tx-drizzle, even though this node-postgres database implements both at runtime.
    const eventDb = db as unknown as DrizzleTransactionalEventStoreDb;
    const txManager = new TxManager<DrizzleTransactionalEventStoreDb>(
      createDrizzleTxAdapter(db as never) as unknown as TxAdapter<DrizzleTransactionalEventStoreDb>,
    );
    const store = new DrizzleTransactionalEventStore({
      db: eventDb,
      txManager,
    });
    const outbox = new TransactionalOutbox({
      idFactory: () => "message-1",
      now: () => new Date("2026-01-01T00:00:00.000Z"),
      store,
      txManager,
    });

    await txManager.run(() =>
      outbox.append(new ResourceCommittedEvent("committed"), {
        aggregateId: "resource-1",
        idempotencyKey: "resource-commit",
      }),
    );

    const result = await connection.pool.query(
      "select id, idempotency_key from croco_outbox_messages",
    );
    expect(result.rows).toEqual([{ id: "message-1", idempotency_key: "resource-commit" }]);

    const occurredAt = new Date("2026-01-01T00:00:00.000Z");
    const jsonReplayInput = {
      id: "message-json-1",
      eventId: "event-json-1",
      eventType: "resource.json-stored",
      aggregateId: "resource-json",
      idempotencyKey: "resource-json",
      payload: { observedAt: occurredAt, omitted: undefined },
      metadata: { producer: "resource-test", omitted: undefined },
      maxAttempts: 3,
      visibleAt: occurredAt,
      occurredAt,
    };
    const jsonStored = await store.appendOutbox(jsonReplayInput);
    await expect(
      store.appendOutbox({
        ...jsonReplayInput,
        id: "message-json-replay",
        maxAttempts: 9,
        visibleAt: new Date("2026-01-01T00:01:00.000Z"),
      }),
    ).resolves.toMatchObject({ id: jsonStored.id });

    const concurrent = await Promise.allSettled([
      store.appendOutbox({
        id: "message-concurrent-1",
        eventId: "event-concurrent-1",
        eventType: "resource.created",
        aggregateId: "resource-concurrent",
        idempotencyKey: "resource-concurrent",
        payload: { observedAt: occurredAt, omitted: undefined },
        metadata: { producer: "resource-test", omitted: undefined },
        maxAttempts: 3,
        visibleAt: occurredAt,
        occurredAt,
      }),
      store.appendOutbox({
        id: "message-concurrent-2",
        eventId: "event-concurrent-2",
        eventType: "resource.replaced",
        aggregateId: "resource-concurrent",
        idempotencyKey: "resource-concurrent",
        payload: { observedAt: occurredAt, omitted: undefined },
        metadata: { producer: "resource-test", omitted: undefined },
        maxAttempts: 3,
        visibleAt: occurredAt,
        occurredAt,
      }),
    ]);

    expect(concurrent.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(concurrent.filter(({ status }) => status === "rejected")).toMatchObject([
      {
        reason: {
          code: "events-tx/outbox-idempotency-conflict",
        },
      },
    ]);
    expect(concurrent.find(({ status }) => status === "rejected")).toMatchObject({
      reason: expect.any(OutboxIdempotencyConflictProblem),
    });
    expect(kernel.resourceEvidence[0]?.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stage: "migration", status: "passed" }),
        expect.objectContaining({ stage: "health-check", status: "passed" }),
      ]),
    );
  });

  it("claims disjoint PostgreSQL outbox batches while another worker holds row locks", async () => {
    const postgres = postgresResource({
      migrations: await createMigrationDirectory(),
      mode: "migration",
    });
    await using kernel = await createTestKernel({
      bootstrap: bootstrapEmptyApplication,
      fidelity: "application",
      resources: [postgres],
      validation: { di: "off", security: "off" },
      workerId: "outbox-lock-workers",
    });
    const { pool } = kernel.resource(postgres);
    const db = drizzle(pool);
    const store = new DrizzleTransactionalEventStore({
      db: db as unknown as DrizzleTransactionalEventStoreDb,
    });
    const now = new Date("2026-01-01T00:00:00.000Z");
    const options = { limit: 2, now, visibilityTimeoutMs: 1000 };
    for (const id of ["a", "b", "c", "d", "z-follow"]) {
      await store.appendOutbox({
        id,
        eventId: id,
        eventType: "resource.claim",
        aggregateId: id === "z-follow" ? "a" : id,
        idempotencyKey: id,
        payload: {},
        maxAttempts: 3,
        visibleAt: now,
        occurredAt: now,
        diagnostics: [{ code: "seed", message: "Seeded.", at: now }],
      });
    }
    const firstClient = await pool.connect();
    const secondClient = await pool.connect();
    try {
      await firstClient.query("begin");
      await secondClient.query("begin");
      // Bound a broken implementation's lock wait instead of relying on scheduler timing.
      await secondClient.query("set local statement_timeout = '2s'");
      const first = await store.claimOutboxBatch(options, {
        client: drizzle(firstClient) as unknown as DrizzleTransactionalEventStoreDb,
      });
      expect(first.map(({ id }) => id)).toEqual(["a", "b"]);
      const second = await store.claimOutboxBatch(options, {
        client: drizzle(secondClient) as unknown as DrizzleTransactionalEventStoreDb,
      });
      expect(second.map(({ id }) => id)).toEqual(["c", "d"]);
      expect(new Set([...first, ...second].map(({ id }) => id)).size).toBe(4);
      for (const message of [...first, ...second]) {
        expect(message).toMatchObject({ attempts: 1, status: "publishing" });
        expect(message.diagnostics).toEqual([
          { code: "seed", message: "Seeded.", at: now },
          {
            code: "events-tx/outbox-claimed",
            message: "Outbox message claimed.",
            at: now,
            details: { attempts: 1 },
          },
        ]);
      }
      await firstClient.query("rollback");
      await secondClient.query("commit");
      expect(await store.findOutboxById("a")).toMatchObject({
        attempts: 0,
        status: "pending",
        diagnostics: [{ code: "seed", message: "Seeded.", at: now }],
      });
      expect((await store.claimOutboxBatch(options)).map(({ id }) => id)).toEqual(["a", "b"]);
      expect(await store.claimOutboxBatch(options)).toEqual([]);
    } finally {
      await firstClient.query("rollback");
      await secondClient.query("rollback");
      firstClient.release();
      secondClient.release();
    }
  });

  it("preserves PostgreSQL outbox aggregate ordering, visibility, and claim history", async () => {
    const postgres = postgresResource({
      migrations: await createMigrationDirectory(),
      mode: "migration",
    });
    await using kernel = await createTestKernel({
      bootstrap: bootstrapEmptyApplication,
      fidelity: "application",
      resources: [postgres],
      validation: { di: "off", security: "off" },
      workerId: "outbox-order-worker",
    });
    const { pool } = kernel.resource(postgres);
    const db = drizzle(pool);
    const txManager = new TxManager<DrizzleTransactionalEventStoreDb>(
      createDrizzleTxAdapter(db as never) as unknown as TxAdapter<DrizzleTransactionalEventStoreDb>,
    );
    const store = new DrizzleTransactionalEventStore({
      db: db as unknown as DrizzleTransactionalEventStoreDb,
      txManager,
    });
    const now = new Date("2026-01-01T00:00:00.000Z");
    const future = new Date(now.getTime() + 1000);
    const options = { limit: 100, now, visibilityTimeoutMs: 1000 };
    const scenarios = [
      { name: "pending", status: "pending", visibleAt: now, lockedUntil: null, eligible: "a" },
      {
        name: "scheduled",
        status: "pending",
        visibleAt: future,
        lockedUntil: null,
        eligible: null,
      },
      { name: "active", status: "publishing", visibleAt: now, lockedUntil: future, eligible: null },
      { name: "expired", status: "publishing", visibleAt: now, lockedUntil: now, eligible: "a" },
      { name: "retry", status: "retrying", visibleAt: future, lockedUntil: null, eligible: null },
      { name: "published", status: "published", visibleAt: now, lockedUntil: null, eligible: "b" },
      { name: "poisoned", status: "poisoned", visibleAt: now, lockedUntil: null, eligible: "b" },
      { name: "dead", status: "dead_lettered", visibleAt: now, lockedUntil: null, eligible: "b" },
    ];
    for (const scenario of scenarios) {
      // Insert the follower first: equal timestamps must use id, not insertion order.
      for (const suffix of ["b", "a"]) {
        await store.appendOutbox({
          id: `${scenario.name}-${suffix}`,
          eventId: `${scenario.name}-${suffix}`,
          eventType: "resource.ordered",
          aggregateId: scenario.name,
          idempotencyKey: `${scenario.name}-${suffix}`,
          payload: {},
          maxAttempts: 5,
          visibleAt: suffix === "a" ? scenario.visibleAt : now,
          occurredAt: now,
          diagnostics: [{ code: "seed", message: "Seeded.", at: now }],
        });
      }
      await pool.query(
        "update croco_outbox_messages set status = $1, locked_until = $2 where id = $3",
        [scenario.status, scenario.lockedUntil, `${scenario.name}-a`],
      );
    }
    for (const id of ["null-a", "null-b"]) {
      await store.appendOutbox({
        id,
        eventId: id,
        eventType: "resource.independent",
        idempotencyKey: id,
        payload: {},
        maxAttempts: 5,
        visibleAt: now,
        occurredAt: now,
        diagnostics: [{ code: "seed", message: "Seeded.", at: now }],
      });
    }
    for (const id of ["chronology-z", "chronology-a"]) {
      await store.appendOutbox({
        id,
        eventId: id,
        eventType: "resource.ordered",
        aggregateId: "chronology",
        idempotencyKey: id,
        payload: {},
        maxAttempts: 5,
        visibleAt: now,
        occurredAt: now,
        diagnostics: [
          {
            code: "seed",
            message: "Seeded.",
            at: id === "chronology-z" ? new Date(now.getTime() - 1) : now,
          },
        ],
      });
    }
    const expected = [
      "chronology-z",
      ...[
        ...scenarios
          .filter(({ eligible }) => eligible !== null)
          .map(({ name, eligible }) => `${name}-${eligible}`),
        "null-a",
        "null-b",
      ].sort(),
    ];
    const rollback = new Error("roll back outbox claims");
    await expect(
      txManager.run(async () => {
        expect((await store.claimOutboxBatch(options)).map(({ id }) => id)).toEqual(expected);
        throw rollback;
      }),
    ).rejects.toBe(rollback);
    const claimed = await store.claimOutboxBatch(options);
    expect(claimed.map(({ id }) => id)).toEqual(expected);
    expect(claimed.every(({ attempts }) => attempts === 1)).toBe(true);
    expect(await store.claimOutboxBatch(options)).toEqual([]);

    // Keep one aggregate to exercise lease expiry and retry boundaries without unrelated rows.
    await pool.query(
      "delete from croco_outbox_messages where aggregate_id is distinct from 'pending'",
    );
    expect(
      await store.claimOutboxBatch({ ...options, now: new Date(future.getTime() - 1) }),
    ).toEqual([]);
    expect(await store.claimOutboxBatch({ ...options, now: future })).toMatchObject([
      { id: "pending-a", attempts: 2, status: "publishing" },
    ]);
    expect(
      await store.markOutboxPublished({ id: "pending-a", expectedAttempts: 1, now: future }),
    ).toBeNull();
    const retryAt = new Date(future.getTime() + 1000);
    await store.markOutboxFailed({
      id: "pending-a",
      expectedAttempts: 2,
      now: future,
      nextVisibleAt: retryAt,
      error: { name: "Error", message: "Retry publication." },
      diagnostic: { code: "retry", message: "Retry scheduled.", at: future },
    });
    expect(
      await store.claimOutboxBatch({ ...options, now: new Date(retryAt.getTime() - 1) }),
    ).toEqual([]);
    expect(await store.claimOutboxBatch({ ...options, now: retryAt })).toMatchObject([
      { id: "pending-a", attempts: 3 },
    ]);
    const released = await store.releaseOutboxClaim({
      id: "pending-a",
      expectedAttempts: 3,
      now: retryAt,
      diagnostic: { code: "release", message: "Claim released.", at: retryAt },
    });
    expect(released).toMatchObject({ attempts: 2, status: "retrying" });
    expect(
      await store.markOutboxPublished({ id: "pending-a", expectedAttempts: 3, now: retryAt }),
    ).toBeNull();
    const [reclaimed] = await store.claimOutboxBatch({ ...options, now: retryAt });
    expect(reclaimed?.diagnostics.map(({ code }) => code)).toEqual([
      "seed",
      "events-tx/outbox-claimed",
      "events-tx/outbox-claimed",
      "retry",
      "events-tx/outbox-claimed",
      "release",
      "events-tx/outbox-claimed",
    ]);
    expect(
      reclaimed?.diagnostics
        .filter(({ code }) => code === "events-tx/outbox-claimed")
        .map(({ details }) => details?.["attempts"]),
    ).toEqual([1, 2, 3, 3]);
    await store.markOutboxPublished({ id: "pending-a", expectedAttempts: 3, now: retryAt });
    expect(await store.claimOutboxBatch({ ...options, now: retryAt })).toMatchObject([
      { id: "pending-b", attempts: 1 },
    ]);
  });

  it("isolates concurrent PostgreSQL workers in separate databases", async () => {
    const firstResource = postgresResource({
      id: "postgres-first",
      mode: "commit",
    });
    const secondResource = postgresResource({
      id: "postgres-second",
      mode: "commit",
    });
    const [first, second] = await Promise.all([
      createTestKernel({
        bootstrap: bootstrapEmptyApplication,
        fidelity: "application",
        resources: [firstResource],
        validation: { di: "off", security: "off" },
        workerId: "first-worker",
      }),
      createTestKernel({
        bootstrap: bootstrapEmptyApplication,
        fidelity: "application",
        resources: [secondResource],
        validation: { di: "off", security: "off" },
        workerId: "second-worker",
      }),
    ]);

    try {
      const firstConnection = first.resource(firstResource);
      const secondConnection = second.resource(secondResource);
      expect(firstConnection.database).not.toBe(secondConnection.database);

      await Promise.all([
        firstConnection.query(
          "create table worker_values (id text primary key, value text not null)",
        ),
        secondConnection.query(
          "create table worker_values (id text primary key, value text not null)",
        ),
      ]);
      await Promise.all([
        firstConnection.query("insert into worker_values values ('shared', 'first')"),
        secondConnection.query("insert into worker_values values ('shared', 'second')"),
      ]);

      const [firstRows, secondRows] = await Promise.all([
        firstConnection.query("select value from worker_values where id = 'shared'"),
        secondConnection.query("select value from worker_values where id = 'shared'"),
      ]);
      expect(firstRows.rows).toEqual([{ value: "first" }]);
      expect(secondRows.rows).toEqual([{ value: "second" }]);
    } finally {
      await Promise.all([first.dispose(), second.dispose()]);
    }
  });

  it("isolates concurrent Redis kernels with a prefix per test", async () => {
    const firstResource = redisResource({ id: "redis-first" });
    const secondResource = redisResource({ id: "redis-second" });
    const [first, second] = await Promise.all([
      createTestKernel({
        bootstrap: bootstrapEmptyApplication,
        fidelity: "application",
        resources: [firstResource],
        testId: "first",
        validation: { di: "off", security: "off" },
        workerId: "shared-worker",
      }),
      createTestKernel({
        bootstrap: bootstrapEmptyApplication,
        fidelity: "application",
        resources: [secondResource],
        testId: "second",
        validation: { di: "off", security: "off" },
        workerId: "shared-worker",
      }),
    ]);

    try {
      const firstConnection = first.resource(firstResource);
      const secondConnection = second.resource(secondResource);
      expect(firstConnection.keyPrefix).not.toBe(secondConnection.keyPrefix);

      await Promise.all([
        firstConnection.client.set("same-key", "first"),
        secondConnection.client.set("same-key", "second"),
      ]);
      await expect(firstConnection.client.get("same-key")).resolves.toBe("first");
      await expect(secondConnection.client.get("same-key")).resolves.toBe("second");
    } finally {
      await Promise.all([first.dispose(), second.dispose()]);
    }
  });

  it("closes live PostgreSQL and Redis resources when provider registration fails", async () => {
    let resolvePostgres!: (connection: PostgresTestConnection) => void;
    let resolveRedis!: (connection: RedisTestConnection) => void;
    const observedPostgres = new Promise<PostgresTestConnection>((resolve) => {
      resolvePostgres = resolve;
    });
    const observedRedis = new Promise<RedisTestConnection>((resolve) => {
      resolveRedis = resolve;
    });
    const postgresToken = new Token<string>("testing-resources.postgres-provider-failure");
    const redisToken = new Token<string>("testing-resources.redis-provider-failure");
    const postgres = postgresResource({
      mode: "commit",
      providers: [
        testResourceProvider(postgresToken, (connection) => {
          resolvePostgres(connection);
          throw new Error("PostgreSQL provider construction failed");
        }),
      ],
    });
    const redis = redisResource({
      providers: [
        testResourceProvider(redisToken, (connection) => {
          resolveRedis(connection);
          throw new Error("Redis provider construction failed");
        }),
      ],
    });

    await Promise.all([
      expect(
        createTestKernel({
          bootstrap: bootstrapEmptyApplication,
          fidelity: "application",
          resources: [postgres],
          validation: { di: "off", security: "off" },
        }),
      ).rejects.toMatchObject({
        code: "testing-resources/startup-failed",
      }),
      expect(
        createTestKernel({
          bootstrap: bootstrapEmptyApplication,
          fidelity: "application",
          resources: [redis],
          validation: { di: "off", security: "off" },
        }),
      ).rejects.toMatchObject({
        code: "testing-resources/startup-failed",
      }),
    ]);

    const [postgresConnection, redisConnection] = await Promise.all([
      observedPostgres,
      observedRedis,
    ]);
    await expect(postgresConnection.pool.query("select 1")).rejects.toThrow(
      "Cannot use a pool after calling end on the pool",
    );
    expect(redisConnection.client.status).toBe("end");
  });
});
