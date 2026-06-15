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
});
