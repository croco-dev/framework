import { randomUUID } from "node:crypto";
import { TxManager } from "@croco/tx-core";
import { createDrizzleTxAdapter } from "@croco/tx-drizzle";
import { drizzle } from "drizzle-orm/node-postgres";
import { jsonb, pgTable, text, timestamp as pgTimestamp, uuid } from "drizzle-orm/pg-core";
import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DrizzleAuditLogRepository } from "../libs/DrizzleAuditLogRepository";
import type { DrizzleAuditDatabase } from "../libs/DrizzleAuditLogRepository";
import { auditLogsPg } from "../libs/schema";
import { defineBigintAuditPersistenceTests } from "./bigintAuditPersistence";

const connectionString = process.env.AUDIT_POSTGRES_URL ?? "";
const timestamp = new Date("2026-01-01T00:00:01.000Z");
const startDate = new Date("2026-01-01T00:00:00.000Z");
const endDate = new Date("2026-01-01T00:00:02.000Z");
const ids = Array.from(
  { length: 50 },
  (_, index) => `00000000-0000-4000-8000-${(index + 1).toString(16).padStart(12, "0")}`,
);

describe.skipIf(connectionString.length === 0)(
  "DrizzleAuditLogRepository PostgreSQL ordering",
  () => {
    let client: Client;
    let repository: DrizzleAuditLogRepository;
    const schema = `audit_test_${randomUUID().replaceAll("-", "")}`;

    beforeAll(async () => {
      client = new Client({ connectionString });
      await client.connect();
      await client.query("BEGIN");
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET LOCAL search_path TO "${schema}"`);
      await client.query(`
      CREATE TABLE audit_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id text NOT NULL,
        actor_id text NOT NULL,
        action text NOT NULL,
        resource_type text NOT NULL,
        resource_id text NOT NULL,
        payload jsonb NOT NULL DEFAULT '{}',
        diff jsonb,
        metadata jsonb NOT NULL DEFAULT '{}',
        created_at timestamp NOT NULL
      )
    `);
      const db = drizzle(client);
      const txManager = new TxManager<DrizzleAuditDatabase>(createDrizzleTxAdapter(db));
      repository = new DrizzleAuditLogRepository(db, txManager, {
        table: auditLogsPg,
        schema: auditLogsPg,
      });
    });

    beforeEach(async () => {
      await client.query(`TRUNCATE TABLE "${schema}".audit_logs`);
      await client.query(
        `INSERT INTO audit_logs
       (id, tenant_id, actor_id, action, resource_type, resource_id, created_at)
       SELECT id, 'tenant-1', 'actor-1', 'user.update', 'User', 'user-1', $2::timestamp
       FROM unnest($1::uuid[]) AS fixture(id)`,
        [ids, timestamp.toISOString()],
      );
    });

    afterAll(async () => {
      if (client) {
        try {
          await client.query("ROLLBACK");
        } finally {
          await client.end();
        }
      }
    });

    defineBigintAuditPersistenceTests(() => repository);

    it("preserves custom column mappings through PostgreSQL JSONB writes and every read", async () => {
      const table = pgTable("audit_logs", {
        key: uuid("id").defaultRandom().primaryKey(),
        tenant: text("tenant_id").notNull(),
        actor: text("actor_id").notNull(),
        operation: text("action").notNull(),
        kind: text("resource_type").notNull(),
        resource: text("resource_id").notNull(),
        data: jsonb("payload").notNull(),
        changes: jsonb("diff"),
        context: jsonb("metadata").notNull(),
        time: pgTimestamp("created_at").notNull(),
      });
      const db = drizzle(client);
      const mapped = new DrizzleAuditLogRepository(
        db,
        new TxManager<DrizzleAuditDatabase>(createDrizzleTxAdapter(db)),
        {
          table,
          schema: {
            id: table.key,
            tenantId: table.tenant,
            actorId: table.actor,
            action: table.operation,
            resourceType: table.kind,
            resourceId: table.resource,
            payload: table.data,
            diff: table.changes,
            metadata: table.context,
            createdAt: table.time,
          },
        },
      );
      const input = {
        tenantId: "tenant-custom",
        actorId: "actor-custom",
        action: "invoice.approve",
        resourceType: "Invoice",
        resourceId: "invoice-42",
        payload: { amount: 314 },
        diff: { status: { before: "draft", after: "approved" } },
        metadata: { requestId: "request-7" },
      };
      const created = await mapped.create(input);
      expect(created).toEqual({ ...input, id: expect.any(String), createdAt: expect.any(Date) });
      expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(Number.isFinite(created.createdAt.getTime())).toBe(true);
      const stored = await client.query(
        `SELECT id, tenant_id, actor_id, action, resource_type, resource_id, payload, diff, metadata,
           to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at
         FROM audit_logs WHERE tenant_id = $1`,
        [input.tenantId],
      );
      expect(stored.rows).toEqual([
        {
          id: created.id,
          tenant_id: input.tenantId,
          actor_id: input.actorId,
          action: input.action,
          resource_type: input.resourceType,
          resource_id: input.resourceId,
          payload: input.payload,
          diff: input.diff,
          metadata: input.metadata,
          created_at: created.createdAt.toISOString(),
        },
      ]);
      // A native SQL insert checks decoding independently of the repository's writer.
      const existingId = "00000000-0000-4000-8000-000000000099";
      await client.query(
        `INSERT INTO audit_logs
        (id, tenant_id, actor_id, action, resource_type, resource_id, payload, diff, metadata, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8, $9)`,
        [
          existingId,
          input.tenantId,
          input.actorId,
          input.action,
          input.resourceType,
          input.resourceId,
          input.payload,
          input.metadata,
          startDate.toISOString(),
        ],
      );
      const expected = [created, { ...input, id: existingId, diff: null, createdAt: startDate }];
      expect(await mapped.find({ tenantId: input.tenantId })).toEqual(expected);
      expect(
        await mapped.findByDateRange(
          input.tenantId,
          startDate,
          new Date(created.createdAt.getTime() + 1000),
        ),
      ).toEqual(expected);
      expect(await mapped.findByActor(input.tenantId, input.actorId)).toEqual(expected);
      expect(
        await mapped.findByResource(input.tenantId, input.resourceType, input.resourceId),
      ).toEqual(expected);
    });

    const queries = [
      {
        name: "find",
        read: (options: { limit: number; offset: number }) =>
          repository.find({ tenantId: "tenant-1", ...options }),
      },
      {
        name: "findByDateRange",
        read: (options: { limit: number; offset: number }) =>
          repository.findByDateRange("tenant-1", startDate, endDate, options),
      },
      {
        name: "findByActor",
        read: (options: { limit: number; offset: number }) =>
          repository.findByActor("tenant-1", "actor-1", options),
      },
      {
        name: "findByResource",
        read: (options: { limit: number; offset: number }) =>
          repository.findByResource("tenant-1", "User", "user-1", options),
      },
    ];

    it.each(queries)(
      "$name paginates tied timestamps in descending UUID order",
      async ({ read }) => {
        const expected = [...ids].reverse();
        const actual: string[] = [];
        for (let offset = 0; offset < ids.length; offset += 10) {
          const page = await read({ limit: 10, offset });
          const pageIds = page.map((entry) => entry.id);
          expect(pageIds).toEqual(expected.slice(offset, offset + 10));
          actual.push(...pageIds);
        }
        expect(actual).toEqual(expected);
        expect(new Set(actual).size).toBe(50);
        await expect(read({ limit: 10, offset: 50 })).resolves.toEqual([]);
      },
    );

    it.each(queries)("$name keeps createdAt ahead of the UUID tie-breaker", async ({ read }) => {
      await client.query("UPDATE audit_logs SET created_at = $1 WHERE id = $2", [
        endDate.toISOString(),
        ids[0],
      ]);
      await client.query("UPDATE audit_logs SET created_at = $1 WHERE id = $2", [
        startDate.toISOString(),
        ids[49],
      ]);

      const entries = await read({ limit: 50, offset: 0 });
      expect(entries.map((entry) => entry.id)).toEqual([
        ids[0],
        ...ids.slice(1, -1).reverse(),
        ids[49],
      ]);
    });
  },
);
