import {
  ReminderService,
  ReminderConflictProblem,
  ReminderInvalidProblem,
  ReminderDispatchProblem,
  type ReminderInput,
  type ReminderServiceOptions,
} from "@croco/engagement-core";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DrizzleReminderStore,
  createEngagementSchema,
  dropEngagementSchema,
  engagementReminderBuckets,
  engagementReminders,
  engagementReminderOccurrences,
  engagementReminderMutations,
} from "../index";

const connectionString = process.env.ENGAGEMENT_POSTGRES_URL ?? "";
const describePostgres = connectionString ? describe : describe.skip;
const schema = {
  engagementReminderBuckets,
  engagementReminders,
  engagementReminderOccurrences,
  engagementReminderMutations,
};
const scope = { app: "app", environment: "test", tenantId: "tenant" };
const access = { scope, subject: "person", actor: { id: "person", reason: "user request" } };
const input: ReminderInput = {
  topic: "task",
  resourceRef: "task-1",
  timezone: "UTC",
  schedule: { localTime: "10:00", weekdays: [0, 1, 2, 3, 4, 5, 6] },
  channel: "push",
  lateDeliveryMs: 60_000,
};
const create = { ...access, id: "r1", idempotencyKey: "create", input };
const revision = { ...access, id: "r1", expectedVersion: 1, idempotencyKey: "change" };

describePostgres("Reminder runner PostgreSQL integration", () => {
  const pools = [new Pool({ connectionString, max: 1 }), new Pool({ connectionString, max: 1 })];
  const databases = pools.map((pool) => drizzle(pool, { schema }));
  const stores = databases.map((db) => new DrizzleReminderStore(db));
  beforeAll(async () => {
    await dropEngagementSchema(databases[0]);
    await createEngagementSchema(databases[0]);
  });
  beforeEach(async () => {
    await databases[0].execute(
      sql`truncate engagement_reminder_mutations, engagement_reminder_occurrences, engagement_reminders, engagement_reminder_buckets`,
    );
  });
  afterAll(async () => {
    await dropEngagementSchema(databases[0]);
    await Promise.all(pools.map((pool) => pool.end()));
  });

  function setup(overrides: Partial<ReminderServiceOptions> = {}) {
    let now = new Date("2026-10-05T09:00:00Z");
    const send = vi
      .fn<ReminderServiceOptions["send"]>()
      .mockResolvedValue({ status: "queued", executionIds: ["execution"], channelResults: [] });
    const options = {
      clock: () => now,
      authorize: async () => true,
      validateInput: async () => {},
      resourceState: async () => "active" as const,
      send,
      ...overrides,
    };
    const services = stores.map((store) => new ReminderService({ ...options, store }));
    return {
      services,
      send,
      options,
      at: (value: string) => {
        now = new Date(value);
      },
    };
  }

  it("serializes create replay and competing revision updates across independent services", async () => {
    const { services } = setup();
    const created = await Promise.all(services.map((service) => service.create(create)));
    expect(created[0]).toEqual(created[1]);
    const changes = await Promise.allSettled(
      services.map((service, index) =>
        service.update({
          ...revision,
          idempotencyKey: `edit-${index}`,
          input: { ...input, timezone: index ? "Asia/Seoul" : "Europe/London" },
        }),
      ),
    );
    expect(changes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = changes.find((result) => result.status === "rejected");
    expect(rejected?.status === "rejected" && rejected.reason).toBeInstanceOf(
      ReminderConflictProblem,
    );
    expect((await services[1].list(access))[0]?.version).toBe(2);
    const audit = await stores[0].transact(scope, "person", async (tx) => tx.mutations);
    expect(audit).toHaveLength(2);
    expect(await services[1].create(create)).toEqual(created[0]);
  });

  it("prevents sends when cancellation commits after materialization but before worker admission", async () => {
    const { services, at, send } = setup();
    await services[0].create(create);
    at("2026-10-05T10:00:00Z");
    await services[0].dueOccurrences(access);
    await services[1].cancel(revision);
    await services[0].runDue(access);
    expect(send).not.toHaveBeenCalled();
    expect(await services[1].history(access)).toMatchObject([
      { state: "suppressed", reason: "canceled" },
    ]);
  });

  it.each(["snooze", "timezone"] as const)(
    "invalidates a materialized occurrence after %s on another connection",
    async (change) => {
      const { services, at, send } = setup();
      await services[0].create(create);
      at("2026-10-05T10:00:00Z");
      await services[0].dueOccurrences(access);
      if (change === "snooze")
        await services[1].snooze({ ...revision, until: new Date("2026-10-05T12:00:00Z") });
      else await services[1].update({ ...revision, input: { ...input, timezone: "Asia/Seoul" } });
      await services[0].runDue(access);
      expect(send).not.toHaveBeenCalled();
      expect(await services[1].history(access)).toMatchObject([
        { state: "suppressed", reason: "superseded" },
      ]);
      at(change === "snooze" ? "2026-10-05T12:00:00Z" : "2026-10-06T01:00:00Z");
      await services[0].runDue(access);
      expect(send).toHaveBeenCalledTimes(1);
      expect((await services[1].list(access))[0]).toMatchObject({ state: "active", version: 2 });
    },
  );

  it("admits one send across competing workers and recovers a persisted unadmitted claim", async () => {
    const { services, at, send } = setup();
    await services[0].create(create);
    at("2026-10-05T10:00:00Z");
    await services[0].dueOccurrences(access);
    await stores[0].transact(scope, "person", async (tx) => {
      const occurrence = tx.occurrences[0];
      if (!occurrence) throw new ReminderInvalidProblem("Missing fixture occurrence");
      tx.saveOccurrence({ ...occurrence, state: "claimed" });
    });
    await Promise.all(Array.from({ length: 8 }, (_, index) => services[index % 2].runDue(access)));
    expect(send).toHaveBeenCalledTimes(1);
    expect(await services[1].history(access)).toMatchObject([
      { state: "queued", executionIds: ["execution"] },
    ]);
  });

  it.each(["accepted", "not-accepted"] as const)(
    "retains unknown acceptance after a fresh connection and reconciles %s without resending",
    async (outcome) => {
      const send = vi
        .fn<ReminderServiceOptions["send"]>()
        .mockRejectedValue(new ReminderInvalidProblem("Uncertain provider acceptance"));
      const { services, at, options } = setup({ send });
      await services[0].create(create);
      at("2026-10-05T10:00:00Z");
      await expect(services[0].runDue(access)).rejects.toBeInstanceOf(ReminderDispatchProblem);
      const pool = new Pool({ connectionString, max: 1 });
      try {
        const store = new DrizzleReminderStore(drizzle(pool, { schema }));
        const restarted = new ReminderService({ ...options, store });
        await restarted.runDue(access);
        const occurrence = (await restarted.history(access))[0];
        if (!occurrence) throw new ReminderInvalidProblem("Missing fixture occurrence");
        expect(occurrence).toMatchObject({ state: "unknown", reason: "send-failed" });
        const resolution = {
          ...access,
          occurrenceId: occurrence.id,
          idempotencyKey: "reconcile",
          evidence: "provider-lookup-proof",
          outcome,
          executionIds: outcome === "accepted" ? ["verified-execution"] : [],
        };
        await restarted.reconcile(resolution);
        await services[1].reconcile(resolution);
        await restarted.runDue(access);
        expect(send).toHaveBeenCalledTimes(1);
        expect(await services[1].history(access)).toMatchObject([
          { state: outcome === "accepted" ? "queued" : "suppressed" },
        ]);
        const audit = await store.transact(scope, "person", async (tx) => tx.mutations);
        expect(audit).toHaveLength(2);
        expect(audit[1]).toMatchObject({
          occurrenceId: occurrence.id,
          evidence: resolution.evidence,
          outcome,
          actor: "person",
          reason: "user request",
        });
      } finally {
        await pool.end();
      }
    },
  );

  it("expires old materialized backlog and sends only the latest occurrence once", async () => {
    const { services, at, send } = setup();
    await services[0].create({ ...create, input: { ...input, lateDeliveryMs: 7 * 86_400_000 } });
    at("2026-10-05T10:00:00Z");
    await services[0].dueOccurrences(access);
    at("2026-10-09T10:00:30Z");
    await Promise.all(services.map((service) => service.runDue(access)));
    expect(send).toHaveBeenCalledTimes(1);
    expect(await services[1].history(access)).toMatchObject([
      { scheduledAt: new Date("2026-10-05T10:00:00Z"), state: "expired", reason: "skip-missed" },
      { scheduledAt: new Date("2026-10-09T10:00:00Z"), state: "queued" },
    ]);
    expect((await services[1].list(access))[0]?.nextScheduledAt).toEqual(
      new Date("2026-10-10T10:00:00Z"),
    );
  });

  it.each(["completed", "deleted"] as const)(
    "rechecks a %s resource before sending a persisted occurrence",
    async (state) => {
      let resource: "active" | "completed" | "deleted" = "active";
      const { services, at, send } = setup({ resourceState: async () => resource });
      await services[0].create(create);
      at("2026-10-05T10:00:00Z");
      await services[0].dueOccurrences(access);
      resource = state;
      await services[1].runDue(access);
      expect(send).not.toHaveBeenCalled();
      expect(await services[0].history(access)).toMatchObject([
        { state: "suppressed", reason: `resource-${state}` },
      ]);
    },
  );

  it.each(["preference", "suppression", "no-endpoint"] as const)(
    "persists the engagement bridge %s result across workers",
    async (reason) => {
      const send = vi
        .fn<ReminderServiceOptions["send"]>()
        .mockResolvedValue({ status: "suppressed", reason, channelResults: [] });
      const { services, at } = setup({ send });
      await services[0].create(create);
      at("2026-10-05T10:00:00Z");
      await services[0].runDue(access);
      await services[1].runDue(access);
      expect(send).toHaveBeenCalledTimes(1);
      expect(await services[1].history(access)).toMatchObject([{ state: "suppressed", reason }]);
    },
  );

  it.each(["cancel", "snooze"] as const)(
    "commits a queued %s before competing worker admission",
    async (mutation) => {
      const { services, at, send } = setup();
      const observer = new Pool({ connectionString, max: 1 });
      const held = barrier();
      const release = barrier();
      await services[0].create(create);
      at("2026-10-05T10:00:00Z");
      await services[0].dueOccurrences(access);
      const workerPid = (await pools[1].query<{ pid: number }>("select pg_backend_pid() as pid"))
        .rows[0].pid;
      const holding = stores[0].transact(scope, "person", async () => {
        held.resolve();
        await release.promise;
      });
      await held.promise;
      const changing =
        mutation === "cancel"
          ? services[1].cancel(revision)
          : services[1].snooze({ ...revision, until: new Date("2026-10-05T12:00:00Z") });
      let running: Promise<unknown> | undefined;
      try {
        await vi.waitFor(async () => {
          const blocked = await observer.query<{ blocked: boolean }>(
            "select cardinality(pg_blocking_pids($1)) > 0 as blocked",
            [workerPid],
          );
          expect(blocked.rows[0].blocked).toBe(true);
        });
        running = services[0].runDue(access);
        release.resolve();
        await changing;
        await running;
        expect(send).not.toHaveBeenCalled();
        expect(await services[0].history(access)).toMatchObject([
          { state: "suppressed", reason: mutation === "cancel" ? "canceled" : "superseded" },
        ]);
        expect((await services[0].list(access))[0]?.state).toBe(
          mutation === "cancel" ? "canceled" : "snoozed",
        );
      } finally {
        release.resolve();
        await Promise.allSettled([holding, changing, ...(running ? [running] : [])]);
        await observer.end();
      }
    },
  );

  it("blocks cancellation during admission then preserves already admitted delivery after cancel commits", async () => {
    const entered = barrier();
    const releaseAdmission = barrier();
    const sendStarted = barrier();
    const releaseSend = barrier();
    const send = vi.fn<ReminderServiceOptions["send"]>(async () => {
      sendStarted.resolve();
      await releaseSend.promise;
      return { status: "queued", executionIds: ["already-admitted"], channelResults: [] };
    });
    const { services, at } = setup({
      resourceState: async () => {
        entered.resolve();
        await releaseAdmission.promise;
        return "active";
      },
      send,
    });
    const observer = new Pool({ connectionString, max: 1 });
    await services[0].create(create);
    at("2026-10-05T10:00:00Z");
    await services[0].dueOccurrences(access);
    const cancelPid = (await pools[1].query<{ pid: number }>("select pg_backend_pid() as pid"))
      .rows[0].pid;
    const running = services[0].runDue(access);
    await entered.promise;
    let cancellationCompleted = false;
    const canceling = services[1].cancel(revision).then((result) => {
      cancellationCompleted = true;
      return result;
    });
    try {
      await vi.waitFor(async () => {
        const blocked = await observer.query<{ blocked: boolean }>(
          "select cardinality(pg_blocking_pids($1)) > 0 as blocked",
          [cancelPid],
        );
        expect(blocked.rows[0].blocked).toBe(true);
      });
      expect(cancellationCompleted).toBe(false);
      releaseAdmission.resolve();
      await sendStarted.promise;
      await canceling;
      expect(cancellationCompleted).toBe(true);
      expect(await services[1].history(access)).toMatchObject([
        { state: "unknown", reason: "acceptance-unknown" },
      ]);
      expect((await services[1].list(access))[0]?.state).toBe("canceled");
      releaseSend.resolve();
      await running;
      await services[1].runDue(access);
      expect(send).toHaveBeenCalledTimes(1);
      expect(await services[1].history(access)).toMatchObject([
        { state: "queued", executionIds: ["already-admitted"] },
      ]);
    } finally {
      releaseAdmission.resolve();
      releaseSend.resolve();
      await Promise.allSettled([running, canceling]);
      await observer.end();
    }
  });
});

function barrier(): { promise: Promise<void>; resolve: () => void } {
  let resolve = () => {};
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}
