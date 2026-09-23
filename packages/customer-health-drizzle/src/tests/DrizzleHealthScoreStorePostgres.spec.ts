import "reflect-metadata";
import {
  CustomerHealthEventPublisher,
  CustomerHealthService,
  HealthScoreCalculator,
} from "@croco/customer-health-core";
import type {
  HealthScoreProfile,
  HealthSignalRegistry,
  TenantHealthScore,
} from "@croco/customer-health-core";
import { Container } from "@croco/framework-context";
import { TxManager } from "@croco/tx-core";
import { createDrizzleTxAdapter } from "@croco/tx-drizzle";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { type DrizzleHealthClient, DrizzleHealthScoreStore } from "../libs/DrizzleHealthScoreStore";

const connectionString = process.env.CUSTOMER_HEALTH_POSTGRES_URL ?? "";

describe.skipIf(connectionString.length === 0)(
  "DrizzleHealthScoreStore PostgreSQL transactions",
  () => {
    let pool!: Pool;
    let store!: DrizzleHealthScoreStore;
    let txManager!: TxManager<DrizzleHealthClient>;

    beforeAll(async () => {
      pool = new Pool({ connectionString, max: 4 });
      const client = drizzle(pool) as unknown as DrizzleHealthClient;
      txManager = new TxManager(createDrizzleTxAdapter(client));
      store = new DrizzleHealthScoreStore(client, txManager);

      await pool.query(`
      CREATE TABLE IF NOT EXISTS tenant_health_scores (
        transition_sequence bigserial PRIMARY KEY,
        tenant_id text NOT NULL,
        overall_score double precision NOT NULL,
        status text NOT NULL,
        category_scores jsonb NOT NULL,
        signals jsonb NOT NULL,
        trend text NOT NULL,
        previous_score double precision,
        calculated_at timestamp NOT NULL
      )
    `);
      await pool.query(`
      CREATE TABLE IF NOT EXISTS tenant_health_event_intents (
        event_id text PRIMARY KEY,
        tenant_id text NOT NULL,
        transition_sequence bigint NOT NULL,
        intent_order integer NOT NULL,
        occurred_at timestamp with time zone NOT NULL,
        data jsonb NOT NULL,
        published_at timestamp with time zone,
        created_at timestamp with time zone NOT NULL DEFAULT now()
      )
    `);
    });

    beforeEach(async () => {
      Container.reset();
      await pool.query(
        "TRUNCATE TABLE tenant_health_event_intents, tenant_health_scores RESTART IDENTITY",
      );
    });

    afterAll(async () => {
      await pool.end();
    });

    it("rolls back a transition with the caller transaction", async () => {
      const rollback = new Error("rollback caller transaction");
      const score = createScore("tenant-rollback");

      await expect(
        txManager.run(async () => {
          await expect(store.saveTransition(score, null, [])).resolves.toEqual({
            committed: true,
            eventPublicationDeferred: true,
          });
          await expect(store.findLatest(score.tenantId)).resolves.toMatchObject({
            tenantId: score.tenantId,
          });
          expect(score.transitionVersion).toBe("1");
          throw rollback;
        }),
      ).rejects.toBe(rollback);

      expect(score.transitionVersion).toBe("1");
      await expect(store.findLatest(score.tenantId)).resolves.toBeNull();

      const retry = createScore(score.tenantId, 70, "at_risk", "2026-09-22T01:00:00.000Z");
      await expect(store.saveTransition(retry, score, [])).resolves.toEqual({
        committed: false,
        latest: null,
      });
      await expect(store.saveTransition(retry, null, [])).resolves.toEqual({ committed: true });
    });

    it("keeps ambient transition versions usable through and after commit", async () => {
      const first = createScore("tenant-chain", 82.5, "healthy", "2026-09-22T00:00:00.000Z");
      const second = createScore("tenant-chain", 72, "at_risk", "2026-09-22T01:00:00.000Z");

      await txManager.run(async () => {
        await expect(store.saveTransition(first, null, [])).resolves.toEqual({
          committed: true,
          eventPublicationDeferred: true,
        });
        await expect(store.saveTransition(second, first, [])).resolves.toEqual({
          committed: true,
          eventPublicationDeferred: true,
        });
      });

      expect(first.transitionVersion).toBe("1");
      expect(second.transitionVersion).toBe("2");

      const third = createScore("tenant-chain", 62, "at_risk", "2026-09-22T02:00:00.000Z");
      await expect(store.saveTransition(third, second, [])).resolves.toEqual({ committed: true });
      expect(third.transitionVersion).toBe("3");
    });

    it("commits a transition in its own transaction outside an ambient transaction", async () => {
      const score = createScore("tenant-independent");

      await expect(store.saveTransition(score, null, [])).resolves.toEqual({ committed: true });

      await expect(store.findLatest(score.tenantId)).resolves.toMatchObject({
        tenantId: score.tenantId,
        overallScore: score.overallScore,
      });
    });

    it("holds the tenant advisory lock on the ambient transaction connection", async () => {
      const score = createScore("tenant-lock");

      await txManager.run(async () => {
        await store.saveTransition(score, null, []);
        const contender = await pool.connect();
        try {
          const result = await contender.query<{ acquired: boolean }>(
            "SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS acquired",
            [score.tenantId],
          );
          expect(result.rows[0]?.acquired).toBe(false);
        } finally {
          contender.release();
        }
      });
    });

    it("does not publish transition events before the caller transaction commits", async () => {
      const profile: HealthScoreProfile = {
        id: "profile-1",
        name: "Default Profile",
        weights: { usage: 1, business: 0, engagement: 0 },
        thresholds: { healthy: 80, atRisk: 60 },
      };
      const publisher = {
        publishIdempotently: vi.fn().mockResolvedValue(undefined),
      } as unknown as CustomerHealthEventPublisher;
      Container.set(CustomerHealthEventPublisher.token, publisher);
      await new CustomerHealthService(
        createSignalRegistry(90),
        store,
        new HealthScoreCalculator(),
      ).calculateAndStore("tenant-events", profile);
      vi.mocked(publisher.publishIdempotently).mockClear();
      const rollback = new Error("rollback event transition");

      await expect(
        txManager.run(async () => {
          await new CustomerHealthService(
            createSignalRegistry(50),
            store,
            new HealthScoreCalculator(),
          ).calculateAndStore("tenant-events", profile);
          expect(publisher.publishIdempotently).not.toHaveBeenCalled();
          throw rollback;
        }),
      ).rejects.toBe(rollback);

      expect(publisher.publishIdempotently).not.toHaveBeenCalled();
      await expect(store.findLatest("tenant-events")).resolves.toMatchObject({
        overallScore: 90,
      });
      await expect(store.listPendingEventIntents("tenant-events")).resolves.toEqual([]);
    });
  },
);

function createSignalRegistry(value: number): HealthSignalRegistry {
  return {
    getProviders: () => [
      {
        category: "usage",
        collect: async () => [
          {
            category: "usage",
            name: "api_calls",
            value,
            weight: 1,
            rawValue: value,
            collectedAt: new Date("2026-09-22T00:00:00.000Z"),
          },
        ],
      },
    ],
  } as HealthSignalRegistry;
}

function createScore(
  tenantId: string,
  overallScore = 82.5,
  status: TenantHealthScore["status"] = "healthy",
  calculatedAt = "2026-09-22T00:00:00.000Z",
): TenantHealthScore {
  return {
    tenantId,
    overallScore,
    status,
    categoryScores: { usage: overallScore, business: overallScore, engagement: overallScore },
    signals: [],
    trend: "stable",
    calculatedAt: new Date(calculatedAt),
  };
}
