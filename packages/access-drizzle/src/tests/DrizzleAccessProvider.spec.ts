import Database from "better-sqlite3";
import type { SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { integer, SQLiteSyncDialect, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DrizzleAccessProvider } from "../libs/DrizzleAccessProvider";

type DrizzleAccessDb = ConstructorParameters<typeof DrizzleAccessProvider>[0];

const testRelationTuples = sqliteTable("relation_tuples", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenantId: text("tenant_id").notNull(),
  object: text("object").notNull(),
  relation: text("relation").notNull(),
  subject: text("subject").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

describe("DrizzleAccessProvider", () => {
  let provider!: DrizzleAccessProvider;
  let db!: ReturnType<typeof drizzle>;
  let sqlite!: Database.Database;
  let executeFn!: ReturnType<typeof vi.fn>;

  function createSqliteProvider(): DrizzleAccessProvider {
    const dialect = new SQLiteSyncDialect();

    return new DrizzleAccessProvider({
      execute: async (query) => {
        const rendered = dialect.sqlToQuery(query as SQL);
        const statement = sqlite.prepare(rendered.sql);

        if (statement.reader) {
          return { rows: statement.all(...rendered.params) };
        }

        statement.run(...rendered.params);
        return { rows: [] };
      },
    });
  }

  beforeEach(() => {
    sqlite = new Database(":memory:");
    db = drizzle(sqlite);

    sqlite.exec(`
      CREATE TABLE relation_tuples (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT NOT NULL,
        object TEXT NOT NULL,
        relation TEXT NOT NULL,
        subject TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );
      CREATE INDEX idx_object ON relation_tuples(object);
      CREATE INDEX idx_subject ON relation_tuples(subject);
      CREATE INDEX idx_tenant ON relation_tuples(tenant_id);
      CREATE UNIQUE INDEX idx_unique_tuple ON relation_tuples(tenant_id, object, relation, subject);
    `);

    executeFn = vi.fn();

    const mockDb = {
      execute: executeFn,
    };

    provider = new DrizzleAccessProvider(mockDb as DrizzleAccessDb);
  });

  describe("check - direct access", () => {
    it("should normalize boolean allowed values", async () => {
      executeFn.mockResolvedValueOnce({ rows: [{ allowed: true }] });

      const allowedResult = await provider.check({
        tenantId: "tenant-1",
        subject: "user:alice",
        relation: "viewer",
        object: "document:doc1",
      });

      executeFn.mockResolvedValueOnce({ rows: [{ allowed: false }] });

      const deniedResult = await provider.check({
        tenantId: "tenant-1",
        subject: "user:alice",
        relation: "viewer",
        object: "document:doc1",
      });

      expect(allowedResult).toEqual({ decision: "allow", allowed: true });
      expect(deniedResult).toEqual({ decision: "deny", allowed: false });
    });

    it("should normalize string allowed values", async () => {
      executeFn
        .mockResolvedValueOnce({ rows: [{ allowed: "true" }] })
        .mockResolvedValueOnce({ rows: [{ allowed: "false" }] })
        .mockResolvedValueOnce({ rows: [{ allowed: "1" }] })
        .mockResolvedValueOnce({ rows: [{ allowed: "0" }] })
        .mockResolvedValueOnce({ rows: [{ allowed: "t" }] })
        .mockResolvedValueOnce({ rows: [{ allowed: "f" }] });

      const trueResult = await provider.check({
        tenantId: "tenant-1",
        subject: "user:alice",
        relation: "viewer",
        object: "document:doc1",
      });

      const falseResult = await provider.check({
        tenantId: "tenant-1",
        subject: "user:alice",
        relation: "viewer",
        object: "document:doc1",
      });

      const oneResult = await provider.check({
        tenantId: "tenant-1",
        subject: "user:alice",
        relation: "viewer",
        object: "document:doc1",
      });

      const zeroResult = await provider.check({
        tenantId: "tenant-1",
        subject: "user:alice",
        relation: "viewer",
        object: "document:doc1",
      });

      const tResult = await provider.check({
        tenantId: "tenant-1",
        subject: "user:alice",
        relation: "viewer",
        object: "document:doc1",
      });

      const fResult = await provider.check({
        tenantId: "tenant-1",
        subject: "user:alice",
        relation: "viewer",
        object: "document:doc1",
      });

      expect(trueResult.allowed).toBe(true);
      expect(falseResult.allowed).toBe(false);
      expect(oneResult.allowed).toBe(true);
      expect(zeroResult.allowed).toBe(false);
      expect(tResult.allowed).toBe(true);
      expect(fResult.allowed).toBe(false);
    });

    it("should return deny when no tuple exists", async () => {
      executeFn.mockResolvedValueOnce({ rows: [{ allowed: 0 }] });

      const result = await provider.check({
        tenantId: "tenant-1",
        subject: "user:alice",
        relation: "viewer",
        object: "document:doc1",
      });

      expect(result.allowed).toBe(false);
    });

    it("should return allow when direct tuple exists", async () => {
      await db.insert(testRelationTuples).values({
        tenantId: "tenant-1",
        object: "document:doc1",
        relation: "viewer",
        subject: "user:alice",
      });

      executeFn.mockImplementationOnce(async () => {
        const result = sqlite
          .prepare(
            `SELECT EXISTS(SELECT 1 FROM relation_tuples WHERE tenant_id = 'tenant-1' AND subject = 'user:alice' AND relation = 'viewer' AND object = 'document:doc1') as allowed`,
          )
          .get() as { allowed: 0 | 1 };
        return { rows: [result] };
      });

      const checkResult = await provider.check({
        tenantId: "tenant-1",
        subject: "user:alice",
        relation: "viewer",
        object: "document:doc1",
      });

      expect(checkResult.allowed).toBe(true);
    });

    it("should return deny for different tenant", async () => {
      executeFn.mockResolvedValueOnce({ rows: [{ allowed: 0 }] });

      const result = await provider.check({
        tenantId: "tenant-2",
        subject: "user:alice",
        relation: "viewer",
        object: "document:doc1",
      });

      expect(result.allowed).toBe(false);
    });

    it("should return deny for different relation", async () => {
      executeFn.mockResolvedValueOnce({ rows: [{ allowed: 0 }] });

      const result = await provider.check({
        tenantId: "tenant-1",
        subject: "user:alice",
        relation: "editor",
        object: "document:doc1",
      });

      expect(result.allowed).toBe(false);
    });
  });

  describe("check - recursive access (nested)", () => {
    it("should allow access through a group membership tuple", async () => {
      await db.insert(testRelationTuples).values([
        {
          tenantId: "tenant-1",
          object: "group:engineering",
          relation: "member",
          subject: "user:alice",
        },
        {
          tenantId: "tenant-1",
          object: "document:doc1",
          relation: "viewer",
          subject: "group:engineering",
        },
      ]);

      const result = await createSqliteProvider().check({
        tenantId: "tenant-1",
        subject: "user:alice",
        relation: "viewer",
        object: "document:doc1",
      });

      expect(result.allowed).toBe(true);
    });

    it("should allow access through nested group and role memberships", async () => {
      await db.insert(testRelationTuples).values([
        {
          tenantId: "tenant-1",
          object: "group:engineering",
          relation: "member",
          subject: "user:alice",
        },
        {
          tenantId: "tenant-1",
          object: "role:maintainer",
          relation: "member",
          subject: "group:engineering",
        },
        {
          tenantId: "tenant-1",
          object: "document:doc1",
          relation: "editor",
          subject: "role:maintainer",
        },
      ]);

      const result = await createSqliteProvider().check({
        tenantId: "tenant-1",
        subject: "user:alice",
        relation: "editor",
        object: "document:doc1",
      });

      expect(result.allowed).toBe(true);
    });

    it("should deny a chain with an incompatible intermediate relation", async () => {
      await db.insert(testRelationTuples).values([
        {
          tenantId: "tenant-1",
          object: "group:engineering",
          relation: "viewer",
          subject: "user:alice",
        },
        {
          tenantId: "tenant-1",
          object: "document:doc1",
          relation: "viewer",
          subject: "group:engineering",
        },
      ]);

      const result = await createSqliteProvider().check({
        tenantId: "tenant-1",
        subject: "user:alice",
        relation: "viewer",
        object: "document:doc1",
      });

      expect(result.allowed).toBe(false);
    });

    it("should not traverse tuples from another tenant", async () => {
      await db.insert(testRelationTuples).values([
        {
          tenantId: "tenant-1",
          object: "group:engineering",
          relation: "member",
          subject: "user:alice",
        },
        {
          tenantId: "tenant-2",
          object: "document:doc1",
          relation: "viewer",
          subject: "group:engineering",
        },
      ]);

      const result = await createSqliteProvider().check({
        tenantId: "tenant-1",
        subject: "user:alice",
        relation: "viewer",
        object: "document:doc1",
      });

      expect(result.allowed).toBe(false);
    });

    it("should terminate cyclic memberships without granting access", async () => {
      await db.insert(testRelationTuples).values([
        {
          tenantId: "tenant-1",
          object: "group:one",
          relation: "member",
          subject: "user:alice",
        },
        {
          tenantId: "tenant-1",
          object: "group:two",
          relation: "member",
          subject: "group:one",
        },
        {
          tenantId: "tenant-1",
          object: "group:one",
          relation: "member",
          subject: "group:two",
        },
      ]);

      const result = await createSqliteProvider().check({
        tenantId: "tenant-1",
        subject: "user:alice",
        relation: "viewer",
        object: "document:doc1",
      });

      expect(result.allowed).toBe(false);
    });

    it("should deny a grant beyond the maximum traversal depth", async () => {
      const memberships = Array.from({ length: 10 }, (_, index) => ({
        tenantId: "tenant-1",
        object: `group:${index + 1}`,
        relation: "member",
        subject: index === 0 ? "user:alice" : `group:${index}`,
      }));

      await db.insert(testRelationTuples).values([
        ...memberships,
        {
          tenantId: "tenant-1",
          object: "document:doc1",
          relation: "viewer",
          subject: "group:10",
        },
      ]);

      const result = await createSqliteProvider().check({
        tenantId: "tenant-1",
        subject: "user:alice",
        relation: "viewer",
        object: "document:doc1",
      });

      expect(result.allowed).toBe(false);
    });

    it("should allow a grant at the maximum traversal depth", async () => {
      const memberships = Array.from({ length: 9 }, (_, index) => ({
        tenantId: "tenant-1",
        object: `group:${index + 1}`,
        relation: "member",
        subject: index === 0 ? "user:alice" : `group:${index}`,
      }));

      await db.insert(testRelationTuples).values([
        ...memberships,
        {
          tenantId: "tenant-1",
          object: "document:doc1",
          relation: "viewer",
          subject: "group:9",
        },
      ]);

      const result = await createSqliteProvider().check({
        tenantId: "tenant-1",
        subject: "user:alice",
        relation: "viewer",
        object: "document:doc1",
      });

      expect(result.allowed).toBe(true);
    });
  });

  describe("grant", () => {
    it("should insert new tuple", async () => {
      executeFn.mockImplementationOnce(async () => {
        sqlite
          .prepare(
            `INSERT INTO relation_tuples (tenant_id, object, relation, subject) VALUES ('tenant-1', 'document:doc1', 'viewer', 'user:alice')`,
          )
          .run();
        return { rows: [] };
      });

      await provider.grant({
        tenantId: "tenant-1",
        tuple: {
          object: "document:doc1",
          relation: "viewer",
          subject: "user:alice",
        },
      });

      expect(executeFn).toHaveBeenCalled();
    });

    it("should be idempotent (duplicate grant should not error)", async () => {
      executeFn.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });

      await provider.grant({
        tenantId: "tenant-1",
        tuple: {
          object: "document:doc1",
          relation: "viewer",
          subject: "user:alice",
        },
      });

      await expect(
        provider.grant({
          tenantId: "tenant-1",
          tuple: {
            object: "document:doc1",
            relation: "viewer",
            subject: "user:alice",
          },
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe("revoke", () => {
    it("should remove existing tuple", async () => {
      await db.insert(testRelationTuples).values({
        tenantId: "tenant-1",
        object: "document:doc1",
        relation: "viewer",
        subject: "user:alice",
      });

      executeFn.mockImplementationOnce(async () => {
        sqlite
          .prepare(
            `DELETE FROM relation_tuples WHERE tenant_id = 'tenant-1' AND object = 'document:doc1' AND relation = 'viewer' AND subject = 'user:alice'`,
          )
          .run();
        return { rows: [] };
      });

      await provider.revoke({
        tenantId: "tenant-1",
        tuple: {
          object: "document:doc1",
          relation: "viewer",
          subject: "user:alice",
        },
      });

      expect(executeFn).toHaveBeenCalled();
    });

    it("should not error when revoking non-existent tuple", async () => {
      executeFn.mockResolvedValueOnce({ rows: [] });

      await expect(
        provider.revoke({
          tenantId: "tenant-1",
          tuple: {
            object: "document:doc1",
            relation: "viewer",
            subject: "user:alice",
          },
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe("list", () => {
    beforeEach(async () => {
      await db.insert(testRelationTuples).values([
        {
          tenantId: "tenant-1",
          object: "document:doc1",
          relation: "viewer",
          subject: "user:alice",
        },
        {
          tenantId: "tenant-1",
          object: "document:doc1",
          relation: "editor",
          subject: "user:bob",
        },
        {
          tenantId: "tenant-1",
          object: "document:doc2",
          relation: "viewer",
          subject: "user:alice",
        },
        {
          tenantId: "tenant-2",
          object: "document:doc1",
          relation: "viewer",
          subject: "user:alice",
        },
      ]);
    });

    it("should list all tuples for tenant", async () => {
      executeFn.mockImplementationOnce(async () => {
        const rows = sqlite
          .prepare(
            `SELECT object, relation, subject FROM relation_tuples WHERE tenant_id = 'tenant-1'`,
          )
          .all() as unknown[];
        return { rows };
      });

      const result = await provider.list({ tenantId: "tenant-1" });

      expect(result).toHaveLength(3);
    });

    it("should filter by object", async () => {
      executeFn.mockImplementationOnce(async () => {
        const rows = sqlite
          .prepare(
            `SELECT object, relation, subject FROM relation_tuples WHERE tenant_id = 'tenant-1' AND object = 'document:doc1'`,
          )
          .all() as unknown[];
        return { rows };
      });

      const result = await provider.list({
        tenantId: "tenant-1",
        object: "document:doc1",
      });

      expect(result).toHaveLength(2);
      expect(result.every((r: { object: string }) => r.object === "document:doc1")).toBe(true);
    });

    it("should filter by subject", async () => {
      executeFn.mockImplementationOnce(async () => {
        const rows = sqlite
          .prepare(
            `SELECT object, relation, subject FROM relation_tuples WHERE tenant_id = 'tenant-1' AND subject = 'user:alice'`,
          )
          .all() as unknown[];
        return { rows };
      });

      const result = await provider.list({
        tenantId: "tenant-1",
        subject: "user:alice",
      });

      expect(result).toHaveLength(2);
      expect(result.every((r: { subject: string }) => r.subject === "user:alice")).toBe(true);
    });

    it("should filter by relation", async () => {
      executeFn.mockImplementationOnce(async () => {
        const rows = sqlite
          .prepare(
            `SELECT object, relation, subject FROM relation_tuples WHERE tenant_id = 'tenant-1' AND relation = 'viewer'`,
          )
          .all() as unknown[];
        return { rows };
      });

      const result = await provider.list({
        tenantId: "tenant-1",
        relation: "viewer",
      });

      expect(result).toHaveLength(2);
      expect(result.every((r: { relation: string }) => r.relation === "viewer")).toBe(true);
    });

    it("should filter by multiple criteria", async () => {
      executeFn.mockImplementationOnce(async () => {
        const rows = sqlite
          .prepare(
            `SELECT object, relation, subject FROM relation_tuples WHERE tenant_id = 'tenant-1' AND object = 'document:doc1' AND subject = 'user:alice' AND relation = 'viewer'`,
          )
          .all() as unknown[];
        return { rows };
      });

      const result = await provider.list({
        tenantId: "tenant-1",
        object: "document:doc1",
        subject: "user:alice",
        relation: "viewer",
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        object: "document:doc1",
        subject: "user:alice",
        relation: "viewer",
      });
    });
  });
});
