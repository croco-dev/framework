import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { GenericContainer, Wait } from "testcontainers";
import { describe, expect, it } from "vitest";
import { TransactionRollbackConfirmedProblem } from "@croco/tx-core";
import { createDrizzleTxAdapter } from "../index";

describe("DrizzleTxAdapter PostgreSQL pool", () => {
  it("should reuse healthy checkouts and discard an aborted replacement checkout exactly once", async () => {
    const container = await new GenericContainer("postgres:17-alpine")
      .withEnvironment({
        POSTGRES_USER: "fixture",
        POSTGRES_PASSWORD: "fixture-secret",
        POSTGRES_DB: "fixture",
      })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage("database system is ready to accept connections", 2))
      .start();
    const pool = new Pool({
      host: container.getHost(),
      port: container.getMappedPort(5432),
      user: "fixture",
      password: "fixture-secret",
      database: "fixture",
      max: 1,
    });
    const releases: unknown[] = [];
    pool.on("release", (error) => releases.push(error ?? undefined));
    try {
      const adapter = createDrizzleTxAdapter(drizzle(pool));
      const firstPid = await adapter.transaction(
        async (tx) => {
          const result = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
          return result.rows[0]?.pid;
        },
        undefined,
        new AbortController().signal,
      );
      expect(firstPid).toBeTypeOf("number");

      // A child abort rolls back its savepoint without poisoning the root checkout.
      await adapter.transaction(
        async (tx) => {
          const child = new AbortController();
          await expect(
            adapter.savepoint(
              tx,
              async (nested) => {
                await nested.execute(sql`select 1`);
                child.abort(new Error("Savepoint cancelled"));
              },
              undefined,
              child.signal,
            ),
          ).rejects.toThrow(TransactionRollbackConfirmedProblem);
          const result = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
          expect(result.rows[0]?.pid).toBe(firstPid);
        },
        undefined,
        new AbortController().signal,
      );
      expect(releases).toEqual([undefined, undefined]);

      // pg-pool installs a new release function on this same physical connection.
      const root = new AbortController();
      const reason = new Error("Reused root checkout cancelled");
      await expect(
        adapter.transaction(
          async (tx) => {
            await adapter.savepoint(
              tx,
              async (nested) => {
                const result = await nested.execute<{ pid: number }>(
                  sql`select pg_backend_pid() as pid`,
                );
                expect(result.rows[0]?.pid).toBe(firstPid);
              },
              undefined,
              new AbortController().signal,
            );
            root.abort(reason);
          },
          undefined,
          root.signal,
        ),
      ).rejects.toThrow(TransactionRollbackConfirmedProblem);
      expect(releases).toEqual([undefined, undefined, reason]);
      expect(pool.totalCount).toBe(0);

      await adapter.transaction(
        async (tx) => {
          const result = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
          expect(result.rows[0]?.pid).not.toBe(firstPid);
        },
        undefined,
        new AbortController().signal,
      );
      expect(releases).toEqual([undefined, undefined, reason, undefined]);
      expect(pool.idleCount).toBe(1);
    } finally {
      try {
        await pool.end();
      } finally {
        await container.stop();
      }
    }
  }, 120_000);
});
