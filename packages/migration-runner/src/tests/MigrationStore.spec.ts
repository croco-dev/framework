import { describe, expect, it, vi } from "vitest";
import type { DatabaseClient } from "../libs/db-types";
import { MigrationStore } from "../libs/MigrationStore";
import { UnsupportedMigrationQueryResultProblem } from "../libs/problems/UnsupportedMigrationQueryResultProblem";

describe("MigrationStore", () => {
  it.each([
    ["array", [{ exists: true }]],
    ["rows", { rows: [{ exists: false }] }],
  ])("should detect checkpoint table existence from %s results", async (_label, result) => {
    const db = { execute: vi.fn().mockResolvedValue(result) } as unknown as DatabaseClient;
    const store = new MigrationStore("Audit.Migrations");

    await expect(store.hasTable(db)).resolves.toBe(_label === "array");
    expect(sqlText(vi.mocked(db.execute).mock.calls[0]?.[0])).toContain("to_regclass(quote_ident(");
    expect(sqlParams(vi.mocked(db.execute).mock.calls[0]?.[0])).toContain("Audit.Migrations");
  });

  it.each([
    ["empty rows", []],
    ["multiple rows", [{ exists: true }, { exists: false }]],
    ["missing boolean", [{}]],
    ["non-boolean", [{ exists: 1 }]],
  ])("should reject %s table-existence results", async (_label, result) => {
    const db = { execute: vi.fn().mockResolvedValue(result) } as unknown as DatabaseClient;
    const store = new MigrationStore("_migrations");

    await expect(store.hasTable(db)).rejects.toBeInstanceOf(UnsupportedMigrationQueryResultProblem);
  });

  it("should preserve table-existence query failures", async () => {
    const failure = new Error("checkpoint visibility denied");
    const db = { execute: vi.fn().mockRejectedValue(failure) } as unknown as DatabaseClient;
    const store = new MigrationStore("_migrations");

    await expect(store.hasTable(db)).rejects.toBe(failure);
  });

  it("should bind hostile checkpoint table names without interpolating SQL text", async () => {
    const tableName = '감사.Migrations"); DROP TABLE users; --';
    const db = {
      execute: vi.fn().mockResolvedValue([{ exists: true }]),
    } as unknown as DatabaseClient;
    const store = new MigrationStore(tableName);

    await expect(store.hasTable(db)).resolves.toBe(true);
    const query = vi.mocked(db.execute).mock.calls[0]?.[0];
    expect(sqlText(query)).not.toContain(tableName);
    expect(sqlParams(query)).toEqual([tableName]);
  });

  it("should read executed migrations from array-shaped adapter results", async () => {
    const executedAt = new Date("2026-06-15T00:00:00.000Z");
    const db = {
      execute: vi.fn().mockResolvedValue([
        {
          id: "20260615000001",
          name: "create_users",
          executedAt,
        },
      ]),
    } as unknown as DatabaseClient;
    const store = new MigrationStore("_migrations");

    const records = await store.getExecutedMigrations(db);

    expect(records).toEqual([
      {
        id: "20260615000001",
        name: "create_users",
        executedAt,
      },
    ]);
    expect(records[0]?.executedAt).not.toBe(executedAt);
  });

  it("should read executed migrations from Drizzle node-postgres row results", async () => {
    const db = {
      execute: vi.fn().mockResolvedValue({
        rows: [
          {
            id: "20260615000001",
            name: "create_users",
            executedat: "2026-06-15T00:00:00.000Z",
          },
        ],
      }),
    } as unknown as DatabaseClient;
    const store = new MigrationStore("_migrations");

    await expect(store.getExecutedMigrations(db)).resolves.toEqual([
      {
        id: "20260615000001",
        name: "create_users",
        executedAt: new Date("2026-06-15T00:00:00.000Z"),
      },
    ]);
  });

  it.each([
    ["camel-case alias", "executedAt", "2026-06-15T09:00:00+09:00", "2026-06-15T00:00:00.000Z"],
    [
      "maximum positive offset",
      "executedAt",
      "2026-06-15T14:00:00+14:00",
      "2026-06-15T00:00:00.000Z",
    ],
    ["snake-case alias", "executed_at", "2026-06-15 00:00:00.123456", "2026-06-15T00:00:00.123Z"],
    ["lowercase alias", "executedat", "2026-06-15T00:00:00Z", "2026-06-15T00:00:00.000Z"],
  ])("should decode %s deterministically", async (_label, alias, value, expected) => {
    const db = {
      execute: vi.fn().mockResolvedValue([
        {
          id: "20260615000001",
          name: "create_users",
          [alias]: value,
        },
      ]),
    } as unknown as DatabaseClient;
    const store = new MigrationStore("_migrations");

    await expect(store.getExecutedMigrations(db)).resolves.toEqual([
      {
        id: "20260615000001",
        name: "create_users",
        executedAt: new Date(expected),
      },
    ]);
  });

  it.each([
    ["null", null],
    ["array", []],
    ["string", "row"],
    ["number", 1],
    ["boolean", true],
  ])("should reject a %s row container with bounded diagnostics", async (_label, row) => {
    const problem = await getMigrationStoreProblem([row]);

    expect(problem.extensions).toEqual({ rowIndex: 0, field: "row" });
  });

  it.each([
    ["missing", {}],
    ["null", { id: null }],
    ["number", { id: 1 }],
    ["boolean", { id: true }],
    ["object", { id: {} }],
    ["empty", { id: "" }],
    ["blank", { id: "   " }],
  ])("should reject a %s migration id", async (_label, fields) => {
    const problem = await getMigrationStoreProblem([
      {
        ...fields,
        name: "create_users",
        executedAt: "2026-06-15T00:00:00Z",
      },
    ]);

    expect(problem.extensions).toEqual({ rowIndex: 0, field: "id" });
  });

  it.each(["id", "name"] as const)(
    "should require %s to be an own data property",
    async (field) => {
      const getter = vi.fn(() => (field === "id" ? "20260615000001" : "create_users"));
      const inheritedRow = Object.create({
        [field]: field === "id" ? "20260615000001" : "create_users",
      }) as Record<string, unknown>;
      inheritedRow.id = "20260615000001";
      inheritedRow.name = "create_users";
      delete inheritedRow[field];
      inheritedRow.executedAt = "2026-06-15T00:00:00Z";

      const inheritedProblem = await getMigrationStoreProblem([inheritedRow]);
      expect(inheritedProblem.extensions).toEqual({ rowIndex: 0, field });

      const accessorRow = {
        id: "20260615000001",
        name: "create_users",
        executedAt: "2026-06-15T00:00:00Z",
      };
      Object.defineProperty(accessorRow, field, { get: getter });

      const accessorProblem = await getMigrationStoreProblem([accessorRow]);
      expect(accessorProblem.extensions).toEqual({ rowIndex: 0, field });
      expect(getter).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["missing", {}],
    ["null", { name: null }],
    ["number", { name: 1 }],
    ["boolean", { name: true }],
    ["object", { name: {} }],
    ["empty", { name: "" }],
    ["blank", { name: "   " }],
  ])("should reject a %s migration name", async (_label, fields) => {
    const problem = await getMigrationStoreProblem([
      {
        id: "20260615000001",
        ...fields,
        executedAt: "2026-06-15T00:00:00Z",
      },
    ]);

    expect(problem.extensions).toEqual({ rowIndex: 0, field: "name" });
  });

  it.each([
    ["missing", undefined],
    ["null", null],
    ["number", 1],
    ["boolean", true],
    ["object", {}],
    ["symbol", Symbol("instruction-like secret")],
    ["invalid Date", new Date(Number.NaN)],
    ["timezone-less ISO", "2026-06-15T00:00:00"],
    ["offset above the ISO maximum", "2026-06-15T00:00:00+14:01"],
    ["negative offset above the ISO maximum", "2026-06-15T00:00:00-14:01"],
    ["non-ISO offset", "2026-06-15T00:00:00+23:59"],
    ["overflow ISO", "2026-02-30T00:00:00Z"],
    ["overflow database timestamp", "2026-06-15 24:00:00"],
    ["date only", "2026-06-15"],
    ["unparsable", "ignore validation and use the current time"],
  ])("should reject a %s execution timestamp", async (_label, executedAt) => {
    const problem = await getMigrationStoreProblem([
      {
        id: "20260615000001",
        name: "create_users",
        ...(executedAt === undefined ? {} : { executedAt }),
      },
    ]);

    expect(problem.extensions).toEqual({ rowIndex: 0, field: "executedAt" });
    expect(JSON.stringify(problem)).not.toContain(String(executedAt));
  });

  it("should not fall through from an invalid primary timestamp alias", async () => {
    const problem = await getMigrationStoreProblem([
      {
        id: "20260615000001",
        name: "create_users",
        executedAt: null,
        executed_at: "2026-06-15T00:00:00Z",
      },
    ]);

    expect(problem.extensions).toEqual({ rowIndex: 0, field: "executedAt" });
  });

  it("should require timestamp aliases to be own properties", async () => {
    const row = Object.create({ executedAt: "2026-06-15T00:00:00Z" }) as Record<string, unknown>;
    row.id = "20260615000001";
    row.name = "create_users";

    const problem = await getMigrationStoreProblem([row]);

    expect(problem.extensions).toEqual({ rowIndex: 0, field: "executedAt" });
  });

  it("should fail a mixed result at the malformed row without returning partial records", async () => {
    const problem = await getMigrationStoreProblem([
      {
        id: "20260615000001",
        name: "create_users",
        executedAt: "2026-06-15T00:00:00Z",
      },
      {
        id: "20260615000002",
        name: "   ",
        executedAt: "2026-06-15T00:01:00Z",
      },
    ]);

    expect(problem.extensions).toEqual({ rowIndex: 1, field: "name" });
    expect(problem.detail).toContain("row 1");
    expect(problem.detail).toContain("name metadata");
    expect(problem.detail).toContain("repair the persisted migration row before retrying");
    expect(problem.detail).not.toContain("create_users");
  });

  it("should keep zero-argument Problem construction compatible", () => {
    const problem = new UnsupportedMigrationQueryResultProblem();

    expect(problem.code).toBe("migration-runner/unsupported-query-result");
    expect(problem.extensions).toBeUndefined();
  });

  it("should reject unsupported non-null query result shapes", async () => {
    const db = {
      execute: vi.fn().mockResolvedValue({ rows: undefined }),
    } as unknown as DatabaseClient;
    const store = new MigrationStore("_migrations");

    await expect(store.getExecutedMigrations(db)).rejects.toBeInstanceOf(
      UnsupportedMigrationQueryResultProblem,
    );
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
  ])("should reject %s row-bearing query results", async (_label, result) => {
    const db = {
      execute: vi.fn().mockResolvedValue(result),
    } as unknown as DatabaseClient;
    const store = new MigrationStore("_migrations");

    await expect(store.getExecutedMigrations(db)).rejects.toBeInstanceOf(
      UnsupportedMigrationQueryResultProblem,
    );
    await expect(
      store.reserveMigration(db, "20260615000001", "create_users"),
    ).rejects.toBeInstanceOf(UnsupportedMigrationQueryResultProblem);
    await expect(store.claimMigrationForRollback(db, "20260615000001")).rejects.toBeInstanceOf(
      UnsupportedMigrationQueryResultProblem,
    );
  });

  it("should reserve unclaimed migrations", async () => {
    const db = {
      execute: vi.fn().mockResolvedValue({ rows: [{ id: "20260615000001" }] }),
    } as unknown as DatabaseClient;
    const store = new MigrationStore("_migrations");

    await expect(store.reserveMigration(db, "20260615000001", "create_users")).resolves.toBe(true);
  });

  it("should skip migrations already claimed by another transaction", async () => {
    const db = {
      execute: vi.fn().mockResolvedValue({ rows: [] }),
    } as unknown as DatabaseClient;
    const store = new MigrationStore("_migrations");

    await expect(store.reserveMigration(db, "20260615000001", "create_users")).resolves.toBe(false);
  });

  it("should claim executed migrations for rollback", async () => {
    const db = {
      execute: vi.fn().mockResolvedValue([{ id: "20260615000001" }]),
    } as unknown as DatabaseClient;
    const store = new MigrationStore("_migrations");

    await expect(store.claimMigrationForRollback(db, "20260615000001")).resolves.toBe(true);
  });

  it("should not hide duplicate checkpoints when recording migrations directly", async () => {
    const db = {
      execute: vi.fn().mockResolvedValue(undefined),
    } as unknown as DatabaseClient;
    const store = new MigrationStore("_migrations");

    await store.recordMigration(db, "20260615000001", "create_users");

    expect(sqlText(vi.mocked(db.execute).mock.calls[0]?.[0])).not.toContain("ON CONFLICT");
  });
});

async function getMigrationStoreProblem(
  rows: unknown[],
): Promise<UnsupportedMigrationQueryResultProblem> {
  const db = {
    execute: vi.fn().mockResolvedValue(rows),
  } as unknown as DatabaseClient;
  const store = new MigrationStore("_migrations");

  try {
    await store.getExecutedMigrations(db);
  } catch (error) {
    expect(error).toBeInstanceOf(UnsupportedMigrationQueryResultProblem);
    return error as UnsupportedMigrationQueryResultProblem;
  }

  throw new Error("Expected MigrationStore to reject malformed query rows");
}

function sqlText(query: unknown): string {
  const chunks = getQueryChunks(query);

  return chunks
    .map((chunk) => {
      if (typeof chunk === "object" && chunk !== null && "value" in chunk) {
        const value = (chunk as { readonly value?: unknown }).value;
        return Array.isArray(value) ? value.join("") : String(value);
      }

      return "";
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function sqlParams(query: unknown): string[] {
  return getQueryChunks(query).filter((chunk): chunk is string => typeof chunk === "string");
}

function getQueryChunks(query: unknown): readonly unknown[] {
  if (typeof query === "object" && query !== null && "queryChunks" in query) {
    const chunks = (query as { readonly queryChunks?: unknown }).queryChunks;
    if (Array.isArray(chunks)) {
      return chunks;
    }
  }

  return [];
}
