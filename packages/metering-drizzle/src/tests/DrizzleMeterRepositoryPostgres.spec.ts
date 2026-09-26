import { MeterRegistry } from "@croco/metering-core";
import type { BillableUsageJournal } from "@croco/metering-core";
import { TxManager } from "@croco/tx-core";
import { createDrizzleTxAdapter } from "@croco/tx-drizzle";
import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import { describe, expect, it } from "vitest";
import { DrizzleMeterRepository } from "../libs/DrizzleMeterRepository";
import { metersPg, usageRecordsPg } from "../libs/schema";
import { addMeterDefinitionFieldsPostgres } from "../migrations/addMeterDefinitionFields";
import { widenUsageRecordIdsPostgres } from "../migrations/widenUsageRecordIds";

const connectionString = process.env.METERING_POSTGRES_URL ?? "";

async function createUsageRecordsTable(client: Client): Promise<void> {
  await client.query(`
    CREATE TEMPORARY TABLE usage_records (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      tenant_id text NOT NULL,
      meter_id text NOT NULL,
      value bigint NOT NULL DEFAULT 1,
      recorded_at timestamp NOT NULL DEFAULT now(),
      metadata jsonb NOT NULL DEFAULT '{}',
      idempotency_key text,
      event_id text,
      dimensions jsonb
    )
  `);
  await client.query(`
    CREATE UNIQUE INDEX usage_records_idempotency_unique
    ON usage_records (tenant_id, meter_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL
  `);
}

async function createLegacyMetersTable(client: Client): Promise<void> {
  await client.query(`
    CREATE TEMPORARY TABLE meters (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id text NOT NULL,
      meter_id text NOT NULL,
      type text NOT NULL,
      quota bigint,
      allow_over_quota integer NOT NULL DEFAULT 0,
      metadata jsonb NOT NULL DEFAULT '{}',
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `);
}

async function listMeterColumns(client: Client): Promise<string[]> {
  const result = await client.query<{ name: string }>(`
    SELECT attname AS name
    FROM pg_attribute
    WHERE attrelid = 'meters'::regclass AND attnum > 0 AND NOT attisdropped
    ORDER BY attnum
  `);
  return result.rows.map((row) => row.name);
}

async function hasMeterUniqueIndex(client: Client): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(`
    SELECT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'meters' AND indexname = 'meters_tenant_meter_unique'
    ) AS "exists"
  `);
  return result.rows[0]?.exists === true;
}

function createRepository(db: NodePgDatabase): DrizzleMeterRepository {
  return new DrizzleMeterRepository(db, new TxManager(createDrizzleTxAdapter(db)), {
    meterTable: metersPg,
    meterSchema: metersPg,
    usageRecordTable: usageRecordsPg,
    usageRecordSchema: usageRecordsPg,
  });
}

describe.skipIf(connectionString.length === 0)(
  "DrizzleMeterRepository PostgreSQL round trip",
  () => {
    it("persists a batch larger than PostgreSQL's bind-parameter limit", async () => {
      const client = new Client({ connectionString });
      await client.connect();
      try {
        await createUsageRecordsTable(client);
        const repository = createRepository(drizzle(client));
        const records = Array.from({ length: 8_000 }, (_, index) => ({
          id: `usage-${index}`,
          tenantId: "tenant-1",
          meterId: "api_calls",
          value: 1,
          timestamp: new Date("2026-01-15T00:00:00.000Z"),
          idempotencyKey: `request-${index}`,
        }));

        await expect(repository.saveUsageRecords(records)).resolves.toBeUndefined();

        const { rows } = await client.query("SELECT COUNT(*)::int AS count FROM usage_records");
        expect(rows).toEqual([{ count: 8_000 }]);
      } finally {
        await client.end();
      }
    });

    it("preserves a non-UUID usage ID, timestamp, and nested JSONB metadata", async () => {
      const client = new Client({ connectionString });
      await client.connect();
      try {
        await createUsageRecordsTable(client);
        const db = drizzle(client);
        const repository = new DrizzleMeterRepository(
          db,
          new TxManager(createDrizzleTxAdapter(db)),
          {
            meterTable: metersPg,
            meterSchema: metersPg,
            usageRecordTable: usageRecordsPg,
            usageRecordSchema: usageRecordsPg,
          },
        );
        const record = {
          id: "usage-postgres-round-trip",
          tenantId: "postgres-tenant",
          meterId: "api-requests",
          value: 7,
          timestamp: new Date("2026-09-01T12:34:56.789Z"),
          metadata: { source: "postgres", nested: { enabled: true, values: [1, "two", null] } },
          idempotencyKey: "postgres-round-trip",
        };

        await repository.saveUsageRecords([record]);

        expect(await db.select().from(usageRecordsPg)).toEqual([
          {
            id: record.id,
            tenantId: record.tenantId,
            meterId: record.meterId,
            value: record.value,
            recordedAt: record.timestamp,
            metadata: record.metadata,
            idempotencyKey: record.idempotencyKey,
            eventId: null,
            dimensions: null,
          },
        ]);
      } finally {
        await client.end();
      }
    });

    it("rejects a reused usage ID when the idempotency identity is different", async () => {
      const client = new Client({ connectionString });
      await client.connect();
      try {
        await createUsageRecordsTable(client);
        const db = drizzle(client);
        const repository = new DrizzleMeterRepository(
          db,
          new TxManager(createDrizzleTxAdapter(db)),
          {
            meterTable: metersPg,
            meterSchema: metersPg,
            usageRecordTable: usageRecordsPg,
            usageRecordSchema: usageRecordsPg,
          },
        );
        const firstRecord = {
          id: "usage-shared-id",
          tenantId: "postgres-tenant",
          meterId: "api-requests",
          value: 1,
          timestamp: new Date("2026-09-01T12:34:56.789Z"),
          metadata: { source: "first" },
          idempotencyKey: "postgres-first",
        };

        await repository.saveUsageRecords([firstRecord]);

        await expect(
          repository.saveUsageRecords([
            {
              ...firstRecord,
              value: 2,
              metadata: { source: "second" },
              idempotencyKey: "postgres-second",
            },
          ]),
        ).rejects.toMatchObject({
          cause: expect.objectContaining({ code: "23505" }),
        });
        expect(await db.select().from(usageRecordsPg)).toEqual([
          expect.objectContaining({
            id: firstRecord.id,
            idempotencyKey: firstRecord.idempotencyKey,
            value: firstRecord.value,
          }),
        ]);
      } finally {
        await client.end();
      }
    });

    it("keeps billing-required meters required across re-registration and restart", async () => {
      const client = new Client({ connectionString });
      await client.connect();
      try {
        await createLegacyMetersTable(client);
        const db = drizzle(client);
        await addMeterDefinitionFieldsPostgres(db);
        const repository = createRepository(db);
        const journal = { durability: "persistent" } as BillableUsageJournal;
        const registration = {
          tenantId: "t2",
          meterId: "llm-tokens",
          type: "CUSTOM_EVENT" as const,
          billing: "required" as const,
          aggregation: "SUM" as const,
          unit: "token",
          quota: 1000,
          metadata: { plan: "starter" },
        };

        const registry = new MeterRegistry(repository, 60_000, journal);
        const first = await registry.register(registration);
        expect(registry.getCachedBillingRequirement("t2", "llm-tokens")).toBe("required");

        registry.clearCache();
        await registry.loadAll();
        expect(registry.getCachedBillingRequirement("t2", "llm-tokens")).toBe("required");

        const localRegistration = await new MeterRegistry(repository, 60_000, journal).register({
          tenantId: "t2",
          meterId: "llm-tokens",
          type: "COUNT",
          aggregation: "COUNT",
          unit: "request",
          quota: 5000,
        });
        expect(localRegistration).toMatchObject({
          id: first.id,
          billing: "local",
          aggregation: "COUNT",
          unit: "request",
          quota: 5000,
          metadata: undefined,
        });

        const restartedRegistry = new MeterRegistry(repository, 60_000, journal);
        const { metadata: _metadata, ...reregistration } = registration;
        const final = await restartedRegistry.register({ ...reregistration, quota: 7000 });
        await restartedRegistry.loadAll();
        expect(restartedRegistry.getCachedBillingRequirement("t2", "llm-tokens")).toBe("required");

        expect(final).toEqual({
          ...reregistration,
          id: first.id,
          quota: 7000,
          allowOverQuota: false,
          metadata: undefined,
          createdAt: first.createdAt,
          updatedAt: expect.any(Date),
        });
        const rows = await client.query(
          "SELECT billing, aggregation, unit, quota, metadata FROM meters WHERE tenant_id = $1",
          ["t2"],
        );
        expect(rows.rows).toEqual([
          { billing: "required", aggregation: "SUM", unit: "token", quota: "7000", metadata: {} },
        ]);
        expect(await repository.findByMeterIdAndTenant("llm-tokens", "t2")).toEqual(final);
      } finally {
        await client.end();
      }
    });

    it("reports duplicate legacy meters and adds the unique index once they are resolved", async () => {
      const client = new Client({ connectionString });
      await client.connect();
      try {
        await createLegacyMetersTable(client);
        await client.query(`
          INSERT INTO meters (tenant_id, meter_id, type, quota) VALUES
            ('t1', 'ai-tokens', 'COUNT', 1000),
            ('t1', 'ai-tokens', 'COUNT', 5000),
            ('t2', 'ai-tokens', 'COUNT', 1000)
        `);
        const legacyColumns = await listMeterColumns(client);
        const db = drizzle(client);

        await expect(addMeterDefinitionFieldsPostgres(db)).rejects.toMatchObject({
          code: "metering-drizzle/duplicate-meter-definitions",
          extensions: { duplicates: [{ tenantId: "t1", meterId: "ai-tokens", rowCount: 2 }] },
        });
        expect(await listMeterColumns(client)).toEqual(legacyColumns);
        expect(await hasMeterUniqueIndex(client)).toBe(false);

        await client.query("DELETE FROM meters WHERE tenant_id = 't1' AND quota = 1000");
        await addMeterDefinitionFieldsPostgres(db);
        await addMeterDefinitionFieldsPostgres(db);

        expect(await hasMeterUniqueIndex(client)).toBe(true);
        expect(await createRepository(db).findByTenant("t1")).toEqual([
          expect.objectContaining({
            billing: "local",
            aggregation: undefined,
            unit: undefined,
            quota: 5000,
          }),
        ]);
      } finally {
        await client.end();
      }
    });

    it("widens legacy UUID IDs to text without changing existing values or the UUID default", async () => {
      const client = new Client({ connectionString });
      await client.connect();
      try {
        await client.query(`
          CREATE TEMPORARY TABLE usage_records (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid()
          )
        `);
        const legacyId = "7c06af3e-b493-48b7-8d92-844b5c6a54e3";
        await client.query("INSERT INTO usage_records (id) VALUES ($1)", [legacyId]);

        const db = drizzle(client);
        await widenUsageRecordIdsPostgres(db);

        const existingRecord = await client.query<{ id: string; idType: string }>(
          `SELECT id, pg_typeof(id)::text AS "idType" FROM usage_records WHERE id = $1`,
          [legacyId],
        );
        expect(existingRecord.rows).toEqual([{ id: legacyId, idType: "text" }]);

        const defaultExpression = await client.query<{ expression: string }>(`
          SELECT pg_get_expr(definition.adbin, definition.adrelid) AS expression
          FROM pg_attribute AS attribute
          JOIN pg_attrdef AS definition
            ON definition.adrelid = attribute.attrelid
            AND definition.adnum = attribute.attnum
          WHERE attribute.attrelid = 'usage_records'::regclass
            AND attribute.attname = 'id'
        `);
        expect(defaultExpression.rows).toEqual([{ expression: "(gen_random_uuid())::text" }]);

        const generatedRecord = await client.query<{ id: string; idType: string }>(
          `INSERT INTO usage_records DEFAULT VALUES RETURNING id, pg_typeof(id)::text AS "idType"`,
        );
        expect(generatedRecord.rows).toHaveLength(1);
        expect(generatedRecord.rows[0]?.idType).toBe("text");
        expect(generatedRecord.rows[0]?.id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        );
      } finally {
        await client.end();
      }
    });
  },
);
