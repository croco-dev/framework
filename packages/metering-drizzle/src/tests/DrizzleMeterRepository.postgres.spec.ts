import { TxManager } from "@croco/tx-core";
import { createDrizzleTxAdapter } from "@croco/tx-drizzle";
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import { describe, expect, it } from "vitest";
import { DrizzleMeterRepository } from "../libs/DrizzleMeterRepository";
import { metersPg, usageRecordsPg } from "../libs/schema";

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
  },
);
