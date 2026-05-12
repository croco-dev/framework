import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DatabaseClient } from "../libs/db-types";
import { MigrationRunner } from "../libs/MigrationRunner";

describe("MigrationRunner", () => {
  let runner!: MigrationRunner;
  let mockDb!: DatabaseClient;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = { execute: vi.fn() } as unknown as DatabaseClient;

    const migrationsDir = join(__dirname, "fixtures", "migrations");
    runner = new MigrationRunner(mockDb, migrationsDir, "_migrations");
  });

  describe("init", () => {
    it("should create migrations table", async () => {
      await runner.init();
      expect(mockDb.execute).toHaveBeenCalled();
    });
  });

  describe("status", () => {
    it("should return empty array when no migrations", async () => {
      const result = await runner.status();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("up", () => {
    it("should execute pending migrations", async () => {
      const result = await runner.up();
      expect(Array.isArray(result)).toBe(true);
    });

    it("should record checkpoints in the same transaction as each migration", async () => {
      const txDb = { execute: vi.fn() } as unknown as DatabaseClient;
      const transaction = vi.fn(async (fn: (tx: DatabaseClient) => Promise<void>) => fn(txDb));
      mockDb = { execute: vi.fn(), transaction } as unknown as DatabaseClient;
      runner = new MigrationRunner(
        mockDb,
        join(__dirname, "fixtures", "migrations"),
        "_migrations",
      );

      const result = await runner.up();

      expect(result).toHaveLength(2);
      expect(transaction).toHaveBeenCalledTimes(2);
      expect(txDb.execute).toHaveBeenCalled();
      expect(mockDb.execute).not.toHaveBeenCalledWith(expect.stringContaining("INSERT INTO"));
    });
  });

  describe("down", () => {
    it("should revert last migration by default", async () => {
      const result = await runner.down();
      expect(Array.isArray(result)).toBe(true);
    });

    it("should remove checkpoints in the same transaction as each rollback", async () => {
      const txDb = { execute: vi.fn() } as unknown as DatabaseClient;
      const transaction = vi.fn(async (fn: (tx: DatabaseClient) => Promise<void>) => fn(txDb));
      let executeCount = 0;
      mockDb = {
        execute: vi.fn(async () => {
          executeCount += 1;
          if (executeCount === 2) {
            return [
              { id: "20240101000001", name: "create_users", executedAt: new Date() },
              { id: "20240101000002", name: "create_posts", executedAt: new Date() },
            ];
          }

          return [];
        }),
        transaction,
      } as unknown as DatabaseClient;
      runner = new MigrationRunner(
        mockDb,
        join(__dirname, "fixtures", "migrations"),
        "_migrations",
      );

      const result = await runner.down();

      expect(result).toEqual(["20240101000002_create_posts"]);
      expect(transaction).toHaveBeenCalledTimes(1);
      expect(txDb.execute).toHaveBeenCalled();
      expect(mockDb.execute).not.toHaveBeenCalledWith(expect.stringContaining("DELETE FROM"));
    });
  });
});
