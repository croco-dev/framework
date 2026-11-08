import "reflect-metadata";
import { planVersionRef } from "@croco/billing-core";
import type { EntitlementRule } from "@croco/entitlements-core";
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
import { widenEntitlementNumericColumnsPostgres } from "../migrations/widenEntitlementNumericColumns";

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

  it("preserves valid numeric rules through the exported schema and both registry paths", async () => {
    // Exercise the supplied column definitions rather than the old integer fixture.
    await pool.query(`
      ALTER TABLE plan_entitlements
        ALTER COLUMN value TYPE ${planEntitlements.value.getSQLType()},
        ALTER COLUMN quota TYPE ${planEntitlements.quota.getSQLType()}
    `);
    await addPlanVersionEntitlementsPostgres(migrationClient);
    const ref = planVersionRef("pro@numeric");
    const db = drizzle(pool, { schema: { planEntitlements, planEntitlementSets } });
    await db.insert(planEntitlementSets).values({ planId: "pro", planVersionRef: ref });

    const rules: EntitlementRule[] = [
      { featureKey: "disk", type: "static", value: 1.5, overagePolicy: "BLOCK" },
      { featureKey: "fractional", type: "metered", quota: 2.75, overagePolicy: "WARN" },
      { featureKey: "requests", type: "metered", quota: 3_000_000_000, overagePolicy: "BLOCK" },
      { featureKey: "zero", type: "static", value: 0, overagePolicy: "BLOCK" },
      { featureKey: "int32", type: "static", value: 2_147_483_647, overagePolicy: "BLOCK" },
      { featureKey: "enabled", type: "boolean", overagePolicy: "BLOCK" },
    ];
    for (const version of [null, ref]) {
      await db.insert(planEntitlements).values(
        rules.map((rule) => ({
          id: `${version ?? "legacy"}:${rule.featureKey}`,
          planId: "pro",
          planVersionRef: version,
          featureKey: rule.featureKey,
          type: rule.type,
          value: rule.value,
          quota: rule.quota,
          overagePolicy: rule.overagePolicy === "WARN" ? ("warn" as const) : ("block" as const),
        })),
      );
    }
    expect(await registry.getEntitlements("pro")).toEqual(expect.arrayContaining(rules));
    expect(await registry.getEntitlementsByPlanVersion(ref, "pro")).toEqual(
      expect.arrayContaining(rules),
    );
    await db.insert(planEntitlements).values({
      id: "legacy:unbounded",
      planId: "pro",
      featureKey: "unbounded",
      type: "metered",
      quota: null,
    });
    await expect(registry.findRule("pro", "unbounded")).resolves.toMatchObject({
      quota: undefined,
    });
  });

  it("widens populated integer columns atomically without changing identities or constraints", async () => {
    await addPlanVersionEntitlementsPostgres(migrationClient);
    await pool.query(`
      INSERT INTO plan_entitlement_sets (plan_version_ref, plan_id) VALUES ('pro@old', 'pro');
      INSERT INTO plan_entitlements
        (id, plan_id, plan_version_ref, feature_key, type, value, quota, meter_id, meter_billing, overage_policy)
      VALUES ('legacy', 'pro', NULL, 'disk', 'static', 2147483647, NULL, NULL, NULL, 'block'),
             ('versioned', 'pro', 'pro@old', 'requests', 'metered', NULL, 42, 'requests', 'required', 'allow');
    `);
    const rowsBefore = await pool.query("SELECT * FROM plan_entitlements ORDER BY id");
    const constraintsBefore = await pool.query(`
      SELECT conname, pg_get_constraintdef(oid) AS definition
      FROM pg_constraint WHERE conrelid = 'plan_entitlements'::regclass ORDER BY conname
    `);
    const indexesBefore = await pool.query(`
      SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'plan_entitlements' ORDER BY indexname
    `);

    await widenEntitlementNumericColumnsPostgres(migrationClient);
    await widenEntitlementNumericColumnsPostgres(migrationClient);

    expect((await pool.query("SELECT * FROM plan_entitlements ORDER BY id")).rows).toEqual(
      rowsBefore.rows,
    );
    expect(
      (
        await pool.query(`
      SELECT conname, pg_get_constraintdef(oid) AS definition
      FROM pg_constraint WHERE conrelid = 'plan_entitlements'::regclass ORDER BY conname
    `)
      ).rows,
    ).toEqual(constraintsBefore.rows);
    expect(
      (
        await pool.query(`
      SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'plan_entitlements' ORDER BY indexname
    `)
      ).rows,
    ).toEqual(indexesBefore.rows);

    await pool.query(`UPDATE plan_entitlements SET value = 1.5 WHERE id = 'legacy'`);
    await pool.query(`UPDATE plan_entitlements SET quota = 3000000000 WHERE id = 'versioned'`);
    await expect(registry.findRule("pro", "disk")).resolves.toMatchObject({ value: 1.5 });
    await expect(
      registry.findRuleByPlanVersion(planVersionRef("pro@old"), "requests", "pro"),
    ).resolves.toMatchObject({
      quota: 3_000_000_000,
      meterId: "requests",
      meterBilling: "required",
      overagePolicy: "ALLOW_WITH_OVERAGE",
    });
    await expect(
      pool.query(`
      INSERT INTO plan_entitlements (id, plan_id, feature_key, type)
      VALUES ('duplicate-legacy', 'pro', 'disk', 'boolean')
    `),
    ).rejects.toMatchObject({
      code: "23505",
      constraint: "plan_entitlements_legacy_plan_feature_unique",
    });
    await expect(
      pool.query(`
      INSERT INTO plan_entitlements (id, plan_id, plan_version_ref, feature_key, type)
      VALUES ('duplicate-version', 'pro', 'pro@old', 'requests', 'boolean')
    `),
    ).rejects.toMatchObject({
      code: "23505",
      constraint: "plan_entitlements_version_feature_unique",
    });
    await expect(
      pool.query(`
      INSERT INTO plan_entitlements (id, plan_id, plan_version_ref, feature_key, type)
      VALUES ('wrong-plan', 'other', 'pro@old', 'disk', 'boolean')
    `),
    ).rejects.toMatchObject({ code: "23503", constraint: "plan_entitlements_version_plan_fk" });
  });

  it("leaves the first column unchanged if widening the second column fails", async () => {
    await pool.query("ALTER TABLE plan_entitlements DROP COLUMN quota");
    await expect(widenEntitlementNumericColumnsPostgres(migrationClient)).rejects.toMatchObject({
      cause: { code: "42703" },
    });
    const columns = await pool.query(`
      SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'plan_entitlements' AND column_name = 'value'
    `);
    expect(columns.rows).toEqual([{ data_type: "integer" }]);
  });

  it.each([
    ["static", "NaN"],
    ["static", "Infinity"],
    ["static", "-Infinity"],
    ["static", "-0.25"],
    ["metered", "NaN"],
    ["metered", "Infinity"],
    ["metered", "-Infinity"],
    ["metered", "-0.25"],
  ])("rejects invalid %s number %s on both persisted read paths", async (type, value) => {
    await addPlanVersionEntitlementsPostgres(migrationClient);
    await widenEntitlementNumericColumnsPostgres(migrationClient);
    await pool.query(
      `INSERT INTO plan_entitlement_sets (plan_version_ref, plan_id) VALUES ('pro@invalid', 'pro')`,
    );
    const column = type === "static" ? "value" : "quota";
    for (const ref of [null, "pro@invalid"]) {
      await pool.query(
        `
        INSERT INTO plan_entitlements (id, plan_id, plan_version_ref, feature_key, type, ${column})
        VALUES ($1, 'pro', $2, 'invalid', $3, $4)
      `,
        [ref ?? "legacy", ref, type, value],
      );
    }
    await expect(registry.getEntitlements("pro")).rejects.toMatchObject({
      code: "entitlements-core/definition-invalid",
    });
    await expect(
      registry.getEntitlementsByPlanVersion(planVersionRef("pro@invalid"), "pro"),
    ).rejects.toMatchObject({
      code: "entitlements-core/definition-invalid",
    });
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
