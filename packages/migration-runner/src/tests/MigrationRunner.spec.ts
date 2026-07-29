import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProblemCategory } from "@croco/problems-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DatabaseClient } from "../libs/db-types";
import { MigrationRunner } from "../libs/MigrationRunner";
import { InvalidMigrationCountProblem } from "../libs/problems/InvalidMigrationCountProblem";
import type { MigrationHistoryDriftProblem } from "../libs/problems/MigrationHistoryDriftProblem";
import { MigrationTransactionRequiredProblem } from "../libs/problems/MigrationTransactionRequiredProblem";
import { UnsupportedMigrationQueryResultProblem } from "../libs/problems/UnsupportedMigrationQueryResultProblem";

describe("MigrationRunner", () => {
  let runner!: MigrationRunner;
  let mockDb!: DatabaseClient;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      execute: vi.fn().mockResolvedValue([]),
    } as unknown as DatabaseClient;

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
      vi.mocked(mockDb.execute).mockResolvedValueOnce([{ exists: false }]);

      const result = await runner.status();

      expect(Array.isArray(result)).toBe(true);
      expect(mockDb.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe("up", () => {
    it("should reject clients without transaction support", async () => {
      await expect(runner.up()).rejects.toBeInstanceOf(MigrationTransactionRequiredProblem);
    });

    it("should record checkpoints in the same transaction as each migration", async () => {
      const txDb = { execute: vi.fn() } as unknown as DatabaseClient;
      vi.mocked(txDb.execute)
        .mockResolvedValueOnce({ rows: [{ id: "20240101000001" }] })
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ rows: [{ id: "20240101000002" }] })
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);
      const transaction = vi.fn(async <T>(fn: (tx: DatabaseClient) => Promise<T>) => fn(txDb));
      mockDb = {
        execute: vi.fn().mockResolvedValue([]),
        transaction,
      } as unknown as DatabaseClient;
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

    it("should execute a concurrent pending migration only once", async () => {
      const migrationsDir = createMigrationDir();
      const { bodyCalls, db } = createConcurrentDb({
        initialExecuted: [],
        selectBarrierSize: 2,
      });

      try {
        const firstRunner = new MigrationRunner(db, migrationsDir, "_migrations");
        const secondRunner = new MigrationRunner(db, migrationsDir, "_migrations");

        const results = await Promise.all([firstRunner.up(), secondRunner.up()]);

        expect(results.flat()).toEqual(["20260615000001_create_accounts"]);
        expect(bodyCalls.filter((call) => call === "up")).toHaveLength(1);
      } finally {
        rmSync(migrationsDir, { force: true, recursive: true });
      }
    });

    it("should roll back migration body side effects when checkpoint completion fails", async () => {
      const migrationsDir = createMigrationDir();
      const { committedBodyCalls, db } = createCheckpointFailureDb();
      runner = new MigrationRunner(db, migrationsDir, "_migrations");

      try {
        await expect(runner.up()).rejects.toThrow("checkpoint unavailable");
        expect(committedBodyCalls).toEqual([]);
      } finally {
        rmSync(migrationsDir, { force: true, recursive: true });
      }
    });
  });

  describe("down", () => {
    it.each([
      ["zero", 0],
      ["negative", -1],
      ["NaN", Number.NaN],
      ["non-integer", 1.5],
    ])(
      "should reject %s rollback count before executing migration bodies",
      async (_label, count) => {
        const migrationsDir = createMigrationDir();
        const { bodyCalls, db } = createConcurrentDb({
          initialExecuted: [["20260615000001", "create_accounts"]],
          selectBarrierSize: 1,
        });
        runner = new MigrationRunner(db, migrationsDir, "_migrations");

        try {
          await expect(runner.down(undefined, count)).rejects.toBeInstanceOf(
            InvalidMigrationCountProblem,
          );
          expect(bodyCalls).toEqual([]);
        } finally {
          rmSync(migrationsDir, { force: true, recursive: true });
        }
      },
    );

    it("should reject clients without transaction support", async () => {
      let executeCount = 0;
      mockDb = {
        execute: vi.fn(async () => {
          executeCount += 1;
          if (executeCount === 2) {
            return [
              {
                id: "20240101000001",
                name: "create_users",
                executedAt: new Date(),
              },
            ];
          }

          return [];
        }),
      } as unknown as DatabaseClient;
      runner = new MigrationRunner(
        mockDb,
        join(__dirname, "fixtures", "migrations"),
        "_migrations",
      );

      await expect(runner.down()).rejects.toBeInstanceOf(MigrationTransactionRequiredProblem);
    });

    it("should remove checkpoints in the same transaction as each rollback", async () => {
      const txDb = { execute: vi.fn() } as unknown as DatabaseClient;
      vi.mocked(txDb.execute)
        .mockResolvedValueOnce({ rows: [{ id: "20240101000002" }] })
        .mockResolvedValueOnce(undefined);
      const transaction = vi.fn(async <T>(fn: (tx: DatabaseClient) => Promise<T>) => fn(txDb));
      let executeCount = 0;
      mockDb = {
        execute: vi.fn(async () => {
          executeCount += 1;
          if (executeCount === 2) {
            return [
              {
                id: "20240101000001",
                name: "create_users",
                executedAt: new Date(),
              },
              {
                id: "20240101000002",
                name: "create_posts",
                executedAt: new Date(),
              },
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

    it("should execute a concurrent rollback only once", async () => {
      const migrationsDir = createMigrationDir();
      const { bodyCalls, db } = createConcurrentDb({
        initialExecuted: [["20260615000001", "create_accounts"]],
        selectBarrierSize: 2,
      });

      try {
        const firstRunner = new MigrationRunner(db, migrationsDir, "_migrations");
        const secondRunner = new MigrationRunner(db, migrationsDir, "_migrations");

        const results = await Promise.all([firstRunner.down(), secondRunner.down()]);

        expect(results.flat()).toEqual(["20260615000001_create_accounts"]);
        expect(bodyCalls.filter((call) => call === "down")).toHaveLength(1);
      } finally {
        rmSync(migrationsDir, { force: true, recursive: true });
      }
    });

    it("should roll back checkpoint removal when migration rollback fails", async () => {
      const migrationsDir = createMigrationDir({ downThrows: true });
      const { committedBodyCalls, committedRemovedIds, db } = createRollbackFailureDb();
      runner = new MigrationRunner(db, migrationsDir, "_migrations");

      try {
        await expect(runner.down()).rejects.toThrow("rollback unavailable");
        expect(committedBodyCalls).toEqual([]);
        expect(committedRemovedIds).toEqual([]);
      } finally {
        rmSync(migrationsDir, { force: true, recursive: true });
      }
    });
  });

  describe("history reconciliation", () => {
    it.each(["status", "up", "down", "previewUp", "previewDown"] as const)(
      "should reject missing applied files before %s mutation",
      async (operation) => {
        const migrationsDir = createMigrationHistoryDir([["20260615000001", "create_accounts"]]);
        const { db, transaction } = createHistoryDb([
          ["20260615000001", "create_accounts"],
          ["20260615000002", "add_account_status"],
        ]);
        const historyRunner = new MigrationRunner(db, migrationsDir, "_migrations");

        try {
          const result = invokeRunner(historyRunner, operation);
          await expect(result).rejects.toMatchObject({
            code: "migration-runner/history-drift",
            extensions: {
              reason: "missing-file",
              migrationId: "20260615000002",
              recordedName: "add_account_status",
            },
          });
          expect(transaction).not.toHaveBeenCalled();
        } finally {
          rmSync(migrationsDir, { force: true, recursive: true });
        }
      },
    );

    it.each(["status", "up", "down", "previewUp", "previewDown"] as const)(
      "should reject renamed applied files before %s mutation",
      async (operation) => {
        const migrationsDir = createMigrationHistoryDir([["20260615000001", "create_customers"]]);
        const { db, transaction } = createHistoryDb([["20260615000001", "create_accounts"]]);
        const historyRunner = new MigrationRunner(db, migrationsDir, "_migrations");

        try {
          await expect(invokeRunner(historyRunner, operation)).rejects.toMatchObject({
            code: "migration-runner/history-drift",
            extensions: {
              reason: "name-mismatch",
              migrationId: "20260615000001",
              recordedName: "create_accounts",
              currentName: "create_customers",
            },
          });
          expect(transaction).not.toHaveBeenCalled();
        } finally {
          rmSync(migrationsDir, { force: true, recursive: true });
        }
      },
    );

    it("should reject duplicate file ids before preview database access", async () => {
      const migrationsDir = createMigrationHistoryDir([
        ["20260615000001", "create_accounts"],
        ["20260615000001", "create_customers"],
      ]);
      const { db, execute, transaction } = createHistoryDb([]);
      const historyRunner = new MigrationRunner(db, migrationsDir, "_migrations");

      try {
        await expect(historyRunner.previewUp()).rejects.toMatchObject({
          code: "migration-runner/history-drift",
          category: ProblemCategory.Conflict,
          extensions: {
            reason: "duplicate-file-id",
            migrationId: "20260615000001",
            recovery:
              "Restore the original applied migration file with its recorded id and name, or use a separate explicit operator-controlled history repair after verifying the database state, then retry.",
          },
        } satisfies Partial<MigrationHistoryDriftProblem>);
        expect(execute).not.toHaveBeenCalled();
        expect(transaction).not.toHaveBeenCalled();
      } finally {
        rmSync(migrationsDir, { force: true, recursive: true });
      }
    });

    it("should reject a missing applied migration in the middle of history", async () => {
      const migrationsDir = createMigrationHistoryDir([
        ["20260615000001", "create_accounts"],
        ["20260615000003", "create_invoices"],
      ]);
      const { db, transaction } = createHistoryDb([
        ["20260615000001", "create_accounts"],
        ["20260615000002", "add_account_status"],
        ["20260615000003", "create_invoices"],
      ]);
      const historyRunner = new MigrationRunner(db, migrationsDir, "_migrations");

      try {
        await expect(historyRunner.down(undefined, 2)).rejects.toMatchObject({
          code: "migration-runner/history-drift",
          extensions: {
            reason: "missing-file",
            migrationId: "20260615000002",
          },
        });
        expect(transaction).not.toHaveBeenCalled();
      } finally {
        rmSync(migrationsDir, { force: true, recursive: true });
      }
    });

    it.each([
      ["malformed", async () => []],
      ["failed", async () => Promise.reject(new Error("history probe unavailable"))],
    ])(
      "should reject a %s preview history probe before opening a transaction",
      async (_label, probe) => {
        const migrationsDir = createMigrationHistoryDir([["20260615000001", "create_accounts"]]);
        const transaction = vi.fn();
        const db = {
          execute: vi.fn(probe),
          transaction,
        } as unknown as DatabaseClient;
        const historyRunner = new MigrationRunner(db, migrationsDir, "_migrations");

        try {
          await expect(historyRunner.previewUp()).rejects.toThrow();
          expect(transaction).not.toHaveBeenCalled();
        } finally {
          rmSync(migrationsDir, { force: true, recursive: true });
        }
      },
    );

    it("should preserve valid status ordering and persisted execution evidence", async () => {
      const migrationsDir = createMigrationHistoryDir([
        ["20260615000001", "create_accounts"],
        ["20260615000002", "add_account_status"],
        ["20260615000003", "create_invoices"],
      ]);
      const { db } = createHistoryDb([
        ["20260615000001", "create_accounts"],
        ["20260615000002", "add_account_status"],
      ]);
      const historyRunner = new MigrationRunner(db, migrationsDir, "_migrations");

      try {
        await expect(historyRunner.status()).resolves.toMatchObject([
          { id: "20260615000001", name: "create_accounts", executed: true },
          { id: "20260615000002", name: "add_account_status", executed: true },
          { id: "20260615000003", name: "create_invoices", executed: false },
        ]);
      } finally {
        rmSync(migrationsDir, { force: true, recursive: true });
      }
    });
  });

  describe("malformed persisted metadata", () => {
    it.each([
      ["status", (candidate: MigrationRunner) => candidate.status()],
      ["up", (candidate: MigrationRunner) => candidate.up()],
      ["down", (candidate: MigrationRunner) => candidate.down()],
      ["previewUp", (candidate: MigrationRunner) => candidate.previewUp()],
      ["previewDown", (candidate: MigrationRunner) => candidate.previewDown()],
    ])("should reject %s before executing migration bodies", async (_method, invoke) => {
      const migrationsDir = createMigrationDir();
      const { bodyCalls, db } = createMalformedMetadataDb();
      const candidate = new MigrationRunner(db, migrationsDir, "_migrations");

      try {
        const result = invoke(candidate);
        await expect(result).rejects.toBeInstanceOf(UnsupportedMigrationQueryResultProblem);
        await expect(result).rejects.toMatchObject({
          extensions: { rowIndex: 0, field: "executedAt" },
        });
        expect(bodyCalls).toEqual([]);
      } finally {
        rmSync(migrationsDir, { force: true, recursive: true });
      }
    });
  });
});

type MigrationDirOptions = {
  readonly downThrows?: boolean;
};

type ConcurrentDbOptions = {
  readonly initialExecuted: readonly (readonly [string, string])[];
  readonly selectBarrierSize: number;
};

type BodyCall = "up" | "down";

type HistoryOperation = "status" | "up" | "down" | "previewUp" | "previewDown";

function invokeRunner(runner: MigrationRunner, operation: HistoryOperation): Promise<unknown> {
  return runner[operation]();
}

function createMigrationHistoryDir(
  migrations: readonly (readonly [id: string, name: string])[],
): string {
  const migrationsDir = mkdtempSync(join(tmpdir(), "croco-migration-history-"));
  for (const [id, name] of migrations) {
    writeFileSync(
      join(migrationsDir, `${id}_${name}.ts`),
      [
        "export async function up(): Promise<void> {}",
        "export async function down(): Promise<void> {}",
        "",
      ].join("\n"),
    );
  }
  return migrationsDir;
}

function createHistoryDb(executed: readonly (readonly [string, string])[]): {
  readonly db: DatabaseClient;
  readonly execute: ReturnType<typeof vi.fn>;
  readonly transaction: ReturnType<typeof vi.fn>;
} {
  const execute = vi.fn(async (query: unknown) => {
    const text = sqlText(query);
    if (text.startsWith("CREATE TABLE")) return [];
    if (text.includes("to_regclass")) return [{ exists: true }];
    if (text.startsWith("SELECT id, name")) {
      return executed.map(([id, name]) => ({
        id,
        name,
        executedAt: new Date("2026-06-15T00:00:00.000Z"),
      }));
    }
    return [];
  });
  const transaction = vi.fn(async <T>(fn: (tx: DatabaseClient) => Promise<T>) =>
    fn({ execute } as unknown as DatabaseClient),
  );
  return {
    db: { execute, transaction } as unknown as DatabaseClient,
    execute,
    transaction,
  };
}

function createMigrationDir(options: MigrationDirOptions = {}): string {
  const migrationsDir = mkdtempSync(join(tmpdir(), "croco-migration-runner-"));
  const downBody = options.downThrows
    ? ["  await db.execute({ kind: 'down' });", "  throw new Error('rollback unavailable');"]
    : ["  await db.execute({ kind: 'down' });"];

  writeFileSync(
    join(migrationsDir, "20260615000001_create_accounts.ts"),
    [
      "export async function up(db: { execute: (query: unknown) => Promise<unknown> }): Promise<void> {",
      "  await db.execute({ kind: 'up' });",
      "}",
      "",
      "export async function down(db: { execute: (query: unknown) => Promise<unknown> }): Promise<void> {",
      ...downBody,
      "}",
      "",
    ].join("\n"),
  );

  return migrationsDir;
}

function createConcurrentDb(options: ConcurrentDbOptions): {
  readonly bodyCalls: BodyCall[];
  readonly db: DatabaseClient;
} {
  const executed = new Map(options.initialExecuted);
  const bodyCalls: BodyCall[] = [];
  const selectBarrier = createBarrier(options.selectBarrierSize);

  const execute = vi.fn(async (query: unknown) => {
    const bodyCall = getBodyCall(query);
    if (bodyCall) {
      bodyCalls.push(bodyCall);
      return [];
    }

    const text = sqlText(query);
    const params = sqlParams(query);

    if (text.startsWith("CREATE TABLE")) {
      return [];
    }

    if (text.startsWith("SELECT id, name")) {
      await selectBarrier.wait();
      return Array.from(executed, ([id, name]) => ({
        id,
        name,
        executedAt: new Date("2026-06-15T00:00:00.000Z"),
      }));
    }

    if (text.includes("ON CONFLICT (id) DO NOTHING")) {
      const [id, name] = params;
      if (!id || !name || executed.has(id)) {
        return { rows: [] };
      }

      executed.set(id, name);
      return { rows: [{ id }] };
    }

    if (text.startsWith("UPDATE")) {
      return [];
    }

    if (text.startsWith("DELETE FROM") && text.includes("RETURNING id")) {
      const [id] = params;
      if (!id || !executed.has(id)) {
        return { rows: [] };
      }

      executed.delete(id);
      return { rows: [{ id }] };
    }

    return [];
  });

  const txDb = { execute } as unknown as DatabaseClient;
  const db = {
    execute,
    transaction: vi.fn(async <T>(fn: (tx: DatabaseClient) => Promise<T>) => fn(txDb)),
  } as unknown as DatabaseClient;

  return { bodyCalls, db };
}

function createCheckpointFailureDb(): {
  readonly committedBodyCalls: BodyCall[];
  readonly db: DatabaseClient;
} {
  const committedBodyCalls: BodyCall[] = [];
  const execute = vi.fn(async (query: unknown) => {
    if (sqlText(query).startsWith("CREATE TABLE") || sqlText(query).startsWith("SELECT id, name")) {
      return [];
    }

    return [];
  });
  const db = {
    execute,
    transaction: vi.fn(async <T>(fn: (tx: DatabaseClient) => Promise<T>) => {
      const stagedBodyCalls: BodyCall[] = [];
      const txDb = {
        execute: vi.fn(async (query: unknown) => {
          const bodyCall = getBodyCall(query);
          if (bodyCall) {
            stagedBodyCalls.push(bodyCall);
            return [];
          }

          const text = sqlText(query);
          if (text.includes("ON CONFLICT (id) DO NOTHING")) {
            return { rows: [{ id: "20260615000001" }] };
          }

          if (text.startsWith("UPDATE")) {
            throw new Error("checkpoint unavailable");
          }

          return [];
        }),
      } as unknown as DatabaseClient;

      const result = await fn(txDb);
      committedBodyCalls.push(...stagedBodyCalls);
      return result;
    }),
  } as unknown as DatabaseClient;

  return { committedBodyCalls, db };
}

function createRollbackFailureDb(): {
  readonly committedBodyCalls: BodyCall[];
  readonly committedRemovedIds: string[];
  readonly db: DatabaseClient;
} {
  const committedBodyCalls: BodyCall[] = [];
  const committedRemovedIds: string[] = [];
  const execute = vi.fn(async (query: unknown) => {
    const text = sqlText(query);
    if (text.startsWith("SELECT id, name")) {
      return [
        {
          id: "20260615000001",
          name: "create_accounts",
          executedAt: new Date("2026-06-15T00:00:00.000Z"),
        },
      ];
    }

    return [];
  });
  const db = {
    execute,
    transaction: vi.fn(async <T>(fn: (tx: DatabaseClient) => Promise<T>) => {
      const stagedBodyCalls: BodyCall[] = [];
      const stagedRemovedIds: string[] = [];
      const txDb = {
        execute: vi.fn(async (query: unknown) => {
          const bodyCall = getBodyCall(query);
          if (bodyCall) {
            stagedBodyCalls.push(bodyCall);
            return [];
          }

          const text = sqlText(query);
          if (text.startsWith("DELETE FROM") && text.includes("RETURNING id")) {
            const [id] = sqlParams(query);
            if (!id) {
              return { rows: [] };
            }

            stagedRemovedIds.push(id);
            return { rows: [{ id }] };
          }

          return [];
        }),
      } as unknown as DatabaseClient;

      const result = await fn(txDb);
      committedBodyCalls.push(...stagedBodyCalls);
      committedRemovedIds.push(...stagedRemovedIds);
      return result;
    }),
  } as unknown as DatabaseClient;

  return { committedBodyCalls, committedRemovedIds, db };
}

function createMalformedMetadataDb(): {
  readonly bodyCalls: BodyCall[];
  readonly db: DatabaseClient;
} {
  const bodyCalls: BodyCall[] = [];
  const execute = vi.fn(async (query: unknown) => {
    const bodyCall = getBodyCall(query);
    if (bodyCall) {
      bodyCalls.push(bodyCall);
      return [];
    }

    const text = sqlText(query);
    if (text.startsWith("SELECT to_regclass")) {
      return [{ exists: true }];
    }

    if (text.startsWith("SELECT id, name")) {
      return [
        {
          id: "20260615000001",
          name: "create_accounts",
          executedAt: "not-a-timestamp",
        },
      ];
    }

    return [];
  });
  const txDb = { execute } as unknown as DatabaseClient;
  const db = {
    execute,
    transaction: vi.fn(async <T>(fn: (tx: DatabaseClient) => Promise<T>) => fn(txDb)),
  } as unknown as DatabaseClient;

  return { bodyCalls, db };
}

function createBarrier(size: number): { readonly wait: () => Promise<void> } {
  let waiting = 0;
  let release: (() => void) | undefined;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });

  return {
    async wait() {
      waiting += 1;
      if (waiting >= size) {
        release?.();
      }
      await promise;
    },
  };
}

function getBodyCall(query: unknown): BodyCall | undefined {
  if (typeof query !== "object" || query === null || !("kind" in query)) {
    return undefined;
  }

  const kind = (query as { readonly kind?: unknown }).kind;
  return kind === "up" || kind === "down" ? kind : undefined;
}

function sqlText(query: unknown): string {
  return getQueryChunks(query)
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
