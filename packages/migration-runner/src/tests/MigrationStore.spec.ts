import { describe, expect, it, vi } from "vitest";
import type { DatabaseClient } from "../libs/db-types";
import { MigrationStore } from "../libs/MigrationStore";
import { UnsupportedMigrationQueryResultProblem } from "../libs/problems/UnsupportedMigrationQueryResultProblem";

describe("MigrationStore", () => {
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

    await expect(store.getExecutedMigrations(db)).resolves.toEqual([
      {
        id: "20260615000001",
        name: "create_users",
        executedAt,
      },
    ]);
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

function getQueryChunks(query: unknown): readonly unknown[] {
  if (typeof query === "object" && query !== null && "queryChunks" in query) {
    const chunks = (query as { readonly queryChunks?: unknown }).queryChunks;
    if (Array.isArray(chunks)) {
      return chunks;
    }
  }

  return [];
}
