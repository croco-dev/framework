import { TxManager } from "@croco/tx-core";
import { createDrizzleTxAdapter } from "@croco/tx-drizzle";
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import { describe, expect, it } from "vitest";
import { DrizzleMeterRepository } from "../libs/DrizzleMeterRepository";
import { metersPg, usageRecordsPg } from "../libs/schema";
import { widenUsageRecordIdsPostgres } from "../migrations/widenUsageRecordIds";

const connectionString = process.env.METERING_POSTGRES_URL ?? "";

describe.skipIf(connectionString.length === 0)(
  "DrizzleMeterRepository PostgreSQL round trip",
  () => {
    it("preserves a non-UUID usage ID, timestamp, and nested JSONB metadata", async () => {
      const client = new Client({ connectionString });
      await client.connect();
      try {
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
