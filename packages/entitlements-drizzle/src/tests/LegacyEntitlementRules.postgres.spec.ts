import "reflect-metadata";
import { drizzle } from "drizzle-orm/node-postgres";
import { PgDialect } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  type DrizzleEntitlementsClient,
  DrizzlePlanEntitlementRegistry,
} from "../libs/DrizzlePlanEntitlementRegistry";
import { planEntitlements, planEntitlementSets } from "../libs/schema";
import {
  addPlanVersionEntitlementsPostgres,
  type EntitlementMigrationClient,
} from "../migrations/addPlanVersionEntitlements";

const connectionString = process.env.ENTITLEMENTS_POSTGRES_URL ?? "";

describe.skipIf(connectionString.length === 0)("legacy entitlement PostgreSQL invariants", () => {
  let pool!: Pool;
  let registry!: DrizzlePlanEntitlementRegistry;
  let migrationClient!: EntitlementMigrationClient;

  beforeAll(() => {
    pool = new Pool({ connectionString, max: 4 });
  });

  beforeEach(async () => {
    await pool.query("DROP TABLE IF EXISTS plan_entitlements, plan_entitlement_sets CASCADE");
    await pool.query(`
      CREATE TABLE plan_entitlements (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL,
        plan_version_ref TEXT,
        feature_key TEXT NOT NULL,
        type TEXT NOT NULL,
        value INTEGER,
        meter_id TEXT,
        meter_billing TEXT,
        quota INTEGER,
        overage_policy TEXT DEFAULT 'block',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    const db = drizzle(pool, { schema: { planEntitlements, planEntitlementSets } });
    registry = new DrizzlePlanEntitlementRegistry(db as unknown as DrizzleEntitlementsClient);
    migrationClient = {
      execute: (query) => db.execute(query),
      transaction: async <T>(migrate: (tx: EntitlementMigrationClient) => Promise<T>): Promise<T> =>
        db.transaction((tx) => migrate({ execute: (query) => tx.execute(query) })),
    };
  });

  afterAll(async () => {
    await pool.end();
  });

  it("reports existing duplicate plan and feature identifiers before creating the index", async () => {
    await pool.query(`
      INSERT INTO plan_entitlements (id, plan_id, feature_key, type)
      VALUES ('rule-1', 'pro', 'reports', 'boolean'),
             ('rule-2', 'pro', 'reports', 'boolean')
    `);

    await expect(registry.getEntitlements("pro")).rejects.toMatchObject({
      code: "entitlements-core/definition-invalid",
    });
    await expect(registry.findRule("pro", "reports")).rejects.toMatchObject({
      code: "entitlements-core/definition-invalid",
    });
    await expect(addPlanVersionEntitlementsPostgres(migrationClient)).rejects.toThrow(
      "plan 'pro', feature 'reports' (2 rows)",
    );

    const indexes = await pool.query<{ indexname: string }>(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'plan_entitlements'
        AND indexname = 'plan_entitlements_legacy_plan_feature_unique'
    `);
    expect(indexes.rows).toEqual([]);
  });

  it("keeps unique legacy rules readable and rejects later duplicates", async () => {
    await pool.query(`
      INSERT INTO plan_entitlements (id, plan_id, feature_key, type, quota, meter_id)
      VALUES ('rule-1', 'pro', 'reports', 'metered', 10, 'reports')
    `);
    await addPlanVersionEntitlementsPostgres(migrationClient);

    await expect(registry.getEntitlements("pro")).resolves.toMatchObject([
      { featureKey: "reports", meterId: "reports", quota: 10, type: "metered" },
    ]);
    await expect(
      pool.query(`
        INSERT INTO plan_entitlements (id, plan_id, feature_key, type)
        VALUES ('rule-2', 'pro', 'reports', 'boolean')
      `),
    ).rejects.toMatchObject({
      code: "23505",
      constraint: "plan_entitlements_legacy_plan_feature_unique",
    });
    await expect(
      pool.query(`
        INSERT INTO plan_entitlements (id, plan_id, feature_key, type)
        VALUES ('rule-3', 'enterprise', 'reports', 'boolean')
      `),
    ).resolves.toBeDefined();
  });

  it("rejects invalid metered and billable-overage rows through the production validator", async () => {
    await pool.query(`
      INSERT INTO plan_entitlements
        (id, plan_id, feature_key, type, quota, meter_id, meter_billing, overage_policy)
      VALUES ('rule-1', 'invalid-quota', 'reports', 'metered', -1, 'reports', 'local', 'block'),
             ('rule-2', 'invalid-overage', 'events', 'metered', 10, 'events', 'local', 'allow')
    `);

    await expect(registry.getEntitlements("invalid-quota")).rejects.toMatchObject({
      code: "entitlements-core/definition-invalid",
    });
    await expect(registry.findRule("invalid-overage", "events")).rejects.toMatchObject({
      code: "entitlements-core/definition-invalid",
    });
  });

  it("reports a duplicate committed between preflight and index creation", async () => {
    await pool.query(`
      INSERT INTO plan_entitlements (id, plan_id, feature_key, type)
      VALUES ('rule-1', 'pro', 'reports', 'boolean')
    `);

    let reportPreflight!: () => void;
    const preflightObserved = new Promise<void>((resolve) => {
      reportPreflight = resolve;
    });
    let continueMigration!: () => void;
    const migrationReleased = new Promise<void>((resolve) => {
      continueMigration = resolve;
    });
    const dialect = new PgDialect();
    const db = drizzle(pool, { schema: { planEntitlements, planEntitlementSets } });
    const racingClient: EntitlementMigrationClient = {
      execute: async (query) => {
        const result = await db.execute(query);
        if (dialect.sqlToQuery(query).sql.includes("HAVING COUNT(*) > 1")) {
          reportPreflight();
          await migrationReleased;
        }
        return result;
      },
    };

    const migration = addPlanVersionEntitlementsPostgres(racingClient);
    await preflightObserved;
    await pool.query(`
      INSERT INTO plan_entitlements (id, plan_id, feature_key, type)
      VALUES ('rule-2', 'pro', 'reports', 'boolean')
    `);
    continueMigration();

    await expect(migration).rejects.toThrow("plan 'pro', feature 'reports' (2 rows)");
  });
});
