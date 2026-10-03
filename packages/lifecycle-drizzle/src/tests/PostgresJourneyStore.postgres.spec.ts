import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { PostgresJourneyStore } from "../index";
import { episode } from "./fixture";
import type { JourneyPgDatabase } from "../index";

const url = process.env.JOURNEY_TEST_DATABASE_URL;
type Pool = {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  end(): Promise<void>;
};
function database(pool: Pool): JourneyPgDatabase {
  const dialect = new PgDialect();
  return {
    execute: (statement) => {
      const query = dialect.sqlToQuery(statement);
      return pool.query(query.sql, query.params);
    },
  };
}

describe.skipIf(!url)("PostgreSQL Journey persistence", () => {
  it("migrates, deduplicates concurrent entry/wake, fences pause, isolates tenants and survives reconnection", async () => {
    const require = createRequire(import.meta.url);
    const { Pool: PgPool } = require("pg") as {
      Pool: new (options: { connectionString: string; max: number }) => Pool;
    };
    const poolA = new PgPool({ connectionString: url as string, max: 1 });
    const poolB = new PgPool({ connectionString: url as string, max: 1 });
    const up = readFileSync(
      new URL("../../migrations/0001_journey.up.sql", import.meta.url),
      "utf8",
    );
    const down = readFileSync(
      new URL("../../migrations/0001_journey.down.sql", import.meta.url),
      "utf8",
    );
    let aClosed = false;
    await poolA.query(up);
    try {
      const storeA = new PostgresJourneyStore(database(poolA));
      const storeB = new PostgresJourneyStore(database(poolB));
      const value = episode();
      const entries = await Promise.all([
        storeA.create(value),
        storeB.create({ ...value, id: "duplicate" }),
      ]);
      expect(entries.filter((result) => result.created)).toHaveLength(1);
      expect(entries[0]?.episode.id).toBe(entries[1]?.episode.id);
      const current = entries[0]!.episode;
      const continuation = {
        ...value,
        id: "continuation",
        reentryKey: "continuation",
        status: "running" as const,
        wakeAt: null,
      };
      await storeA.create(continuation);
      expect(await storeB.claimDue(value.scope, "2026-09-29T00:00:00.000Z", 10, 30000)).toEqual([
        continuation,
      ]);
      const waiting = {
        ...continuation,
        revision: 1,
        status: "waiting" as const,
        wakeAt: "2026-09-29T00:01:00.000Z",
      };
      expect(await storeB.compareAndSet(value.scope, continuation.id, 0, waiting)).toBe(true);
      expect(await storeA.claimDue(value.scope, "2026-09-29T00:00:30.000Z", 10, 30000)).toEqual([]);
      expect(await storeA.claimDue(value.scope, "2026-09-29T00:01:00.000Z", 10, 30000)).toEqual([
        waiting,
      ]);
      const continued = {
        ...waiting,
        revision: 2,
        status: "running" as const,
        wakeAt: null,
        nodeId: "send",
      };
      expect(await storeA.compareAndSet(value.scope, continuation.id, 1, continued)).toBe(true);
      expect(await storeB.claimDue(value.scope, "2026-09-29T00:01:00.000Z", 10, 30000)).toEqual([
        continued,
      ]);
      expect(
        await storeB.compareAndSet(value.scope, continuation.id, 2, {
          ...continued,
          revision: 3,
          status: "completed",
        }),
      ).toBe(true);

      const wakes = await Promise.all([
        storeA.claimDue(value.scope, "2026-09-29T01:00:00.000Z", 10, 30000),
        storeB.claimDue(value.scope, "2026-09-29T01:00:00.000Z", 10, 30000),
      ]);
      expect(wakes.flat()).toHaveLength(1);
      expect(await storeB.claimDue(value.scope, "2026-09-29T01:00:29.000Z", 10, 30000)).toEqual([]);
      expect(await storeB.claimDue(value.scope, "2026-09-29T01:00:30.000Z", 10, 30000)).toEqual([
        current,
      ]);

      const admitted = {
        ...current,
        revision: 1,
        status: "indeterminate" as const,
        intents: [
          {
            episodeId: current.id,
            nodeId: "send",
            attemptIdentity: "attempt-1",
            idempotencyKey: "action-1",
            status: "admitted" as const,
            checks: {
              goal: false,
              consent: true,
              resource: true,
              evaluatedAt: "2026-09-29T01:00:00.000Z",
            },
            executionReference: "execution-1",
          },
        ],
        receipts: [
          {
            nodeId: "wait",
            evaluatedAt: "2026-09-29T01:00:00.000Z",
            reason: "due",
            sourceEventId: "wake-1",
          },
        ],
      };
      const claims = await Promise.all([
        storeA.compareAndSet(current.scope, current.id, 0, admitted),
        storeB.compareAndSet(current.scope, current.id, 0, admitted),
      ]);
      expect(claims.sort()).toEqual([false, true]);
      expect(
        await storeB.compareAndSet(current.scope, current.id, 0, {
          ...current,
          revision: 1,
          status: "paused",
        }),
      ).toBe(false);
      await poolA.end();
      aClosed = true;
      const poolRestart = new PgPool({ connectionString: url as string, max: 1 });
      try {
        const restarted = new PostgresJourneyStore(database(poolRestart));
        expect(await restarted.get(current.scope, current.id)).toEqual(admitted);
        expect(
          await restarted.compareAndSet(current.scope, current.id, 1, {
            ...admitted,
            revision: 2,
            definitionSnapshot: '{"id":"changed","version":"v1"}',
          }),
        ).toBe(false);
        expect(await restarted.get(current.scope, current.id)).toEqual(admitted);
        for (const identity of ["sourceEventId", "episodeKey", "startedAt"] as const) {
          expect(
            await restarted.compareAndSet(current.scope, current.id, 1, {
              ...admitted,
              revision: 2,
              [identity]: "mutated",
            }),
          ).toBe(false);
        }
        const otherScope = { ...current.scope, tenantId: "b" };
        expect(await restarted.get(otherScope, current.id)).toBeUndefined();
        expect(await restarted.list(otherScope)).toEqual([]);
        expect((await restarted.create({ ...value, scope: otherScope })).created).toBe(true);
        expect(
          await restarted.compareAndSet(current.scope, current.id, 1, {
            ...admitted,
            revision: 2,
            definitionVersion: "v2",
          }),
        ).toBe(false);
        expect(
          await restarted.compareAndSet(otherScope, value.id, 0, {
            ...value,
            scope: otherScope,
            revision: 1,
            status: "paused",
          }),
        ).toBe(true);
        expect(
          await restarted.compareAndSet(otherScope, value.id, 0, {
            ...admitted,
            scope: otherScope,
          }),
        ).toBe(false);
      } finally {
        await poolRestart.end();
      }
    } finally {
      await poolB.query(down);
      await poolB.query(up);
      await poolB.query(down);
      if (!aClosed) await poolA.end();
      await poolB.end();
    }
  });
});
