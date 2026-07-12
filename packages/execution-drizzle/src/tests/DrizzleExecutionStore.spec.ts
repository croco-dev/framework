import { type Execution, ExecutionProblem, type ExecutionStatus } from "@croco/execution-core";
import { ProblemFactory } from "@croco/problems-core";
import {
  assertDrizzleProblem,
  createDrizzleProviderConformanceSuite,
} from "@croco/testing/drizzle";
import { DrizzleHealthIndicator } from "@croco/tx-drizzle";
import { getTableColumns, type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DrizzleExecutionStore } from "../libs/DrizzleExecutionStore";
import { executions } from "../libs/schema";

type MockDb = {
  select: () => any;
  insert: () => any;
  update: () => any;
  delete: () => any;
};

function createMockExecution(overrides: Partial<Execution> = {}): Execution {
  return {
    id: "test-execution-id",
    type: "task",
    status: "pending" as ExecutionStatus,
    attempts: 0,
    maxAttempts: 1,
    createdAt: new Date(),
    ...overrides,
  };
}

function createMockDb(): MockDb {
  const orderByMock = vi.fn(() => ({
    limit: vi.fn((_n: number) => ({
      offset: vi.fn((_offset: number) => Promise.resolve([])),
    })),
  }));

  const limitMock = vi.fn((_n: number) => Promise.resolve([]));
  const whereClauseMock = vi.fn(() => ({
    orderBy: orderByMock,
    limit: limitMock,
  }));

  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: whereClauseMock,
      })),
    })),

    insert: vi.fn(() => ({
      values: vi.fn((data: unknown) => ({
        onConflictDoNothing: vi.fn(() => ({
          returning: async () => [data as Execution],
        })),
        returning: async () => [data as Execution],
      })),
    })),

    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn((_condition: unknown) => ({
          returning: async () => [createMockExecution()],
        })),
      })),
    })),

    delete: vi.fn(() => ({
      where: vi.fn((_condition: unknown) => ({
        returning: async () => [createMockExecution()],
      })),
    })),
  };
}

describe("DrizzleExecutionStore", () => {
  let mockDb!: MockDb;
  let store!: DrizzleExecutionStore<MockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    store = new DrizzleExecutionStore(mockDb);
  });

  describe("drizzle provider conformance", () => {
    it.each(
      createDrizzleProviderConformanceSuite({
        providerName: "execution-drizzle",
        schema: {
          supported: true,
          checks: [
            {
              name: "declares execution state idempotency and log columns",
              run: async () => {
                const columns = getTableColumns(executions);

                expect(Object.keys(columns)).toEqual(
                  expect.arrayContaining([
                    "id",
                    "type",
                    "status",
                    "attempts",
                    "maxAttempts",
                    "idempotencyKey",
                    "replayOf",
                    "logs",
                    "parentId",
                    "metadata",
                    "checkpoints",
                    "progress",
                  ]),
                );
              },
            },
          ],
        },
        diagnostics: {
          supported: true,
          checks: [
            {
              name: "redacts database connection details from readiness failures",
              run: async () => {
                const detail =
                  "failed postgres://execution:execution-secret@db.example/app?password=query-secret token=raw-token";
                const indicator = new DrizzleHealthIndicator(
                  {
                    transaction: vi
                      .fn()
                      .mockRejectedValue(
                        ProblemFactory.internalServerError(
                          "testing/drizzle-readiness-failed",
                          detail,
                        ),
                      ),
                  } as never,
                  { name: "execution-drizzle" },
                );
                const health = await indicator.check();
                const serialized = JSON.stringify(health);

                expect(health.status).toBe("down");
                expect(serialized).not.toContain("execution-secret");
                expect(serialized).not.toContain("query-secret");
                expect(serialized).not.toContain("raw-token");
                expect(health.details?.error).toBe(
                  "failed postgres://[redacted]@db.example/app?password=[redacted] token=[redacted]",
                );
              },
            },
          ],
        },
        transaction: {
          participation: {
            supported: false,
            reason:
              "DrizzleExecutionStore currently accepts a direct Drizzle client and no TxManager.",
          },
          rollback: {
            supported: false,
            reason:
              "Rollback participation requires a TxManager-aware execution store constructor.",
          },
        },
        tenantIsolation: {
          supported: false,
          reason: "The execution store contract currently has no tenantId field.",
        },
        repositoryErrors: {
          notFound: {
            supported: true,
            checks: [
              {
                name: "reports missing updates with a deterministic Problem code",
                run: async () => {
                  mockDb.update = vi.fn(() => ({
                    set: vi.fn(() => ({
                      where: vi.fn(() => ({
                        returning: vi.fn(() => Promise.resolve([])),
                      })),
                    })),
                  }));

                  await assertDrizzleProblem(
                    () =>
                      store.update("missing-execution-id", {
                        status: "completed",
                      }),
                    {
                      code: "execution/not-found",
                      status: 404,
                    },
                  );
                },
              },
            ],
          },
          validation: {
            supported: false,
            reason: "State validation is enforced by execution-core managers before store writes.",
          },
          duplicate: {
            supported: true,
            checks: [
              {
                name: "reports unresolved idempotency insert races as conflict Problems",
                run: async () => {
                  vi.spyOn(store, "findByIdempotencyKey").mockResolvedValue(null);
                  mockDb.insert = vi.fn(() => ({
                    values: vi.fn(() => ({
                      onConflictDoNothing: vi.fn(() => ({
                        returning: vi.fn(() => Promise.resolve([])),
                      })),
                      returning: vi.fn(() => Promise.resolve([])),
                    })),
                  }));

                  await assertDrizzleProblem(
                    () =>
                      store.create({
                        type: "task",
                        idempotencyKey: "conformance-race-key",
                      }),
                    {
                      code: "execution/conflict",
                      status: 409,
                    },
                  );
                },
              },
            ],
          },
          conflict: {
            supported: true,
            checks: [
              {
                name: "surfaces atomic append failures as deterministic not-found Problems",
                run: async () => {
                  mockDb.update = vi.fn(() => ({
                    set: vi.fn(() => ({
                      where: vi.fn(() => ({
                        returning: vi.fn(() => Promise.resolve([])),
                      })),
                    })),
                  }));

                  await assertDrizzleProblem(
                    () =>
                      store.appendLog("missing-execution-id", {
                        timestamp: "2026-01-01T00:00:00.000Z",
                        level: "info",
                        message: "missing execution",
                      }),
                    {
                      code: "execution/not-found",
                      status: 404,
                    },
                  );
                },
              },
            ],
          },
          retryableFailure: {
            supported: false,
            reason: "Retryability is modeled on ExecutionError values and managed above the store.",
          },
        },
      }).cases,
    )("$name", async ({ run }) => {
      await run();
    });
  });

  describe("create", () => {
    it("should create a new execution record", async () => {
      const params = {
        type: "task",
        payload: { data: "test" },
        maxAttempts: 3,
        timeout: 5000,
      };

      const result = await store.create(params);

      expect(result).not.toBeNull();
      expect(result.type).toBe("task");
      expect(result.payload).toEqual({ data: "test" });
      expect(result.maxAttempts).toBe(3);
      expect(result.status).toBe("pending");
      expect(result.attempts).toBe(0);
    });

    it("should return existing execution when idempotency key is provided and exists", async () => {
      const existing = createMockExecution({
        idempotencyKey: "unique-key-123",
      });
      vi.spyOn(store, "findByIdempotencyKey").mockResolvedValueOnce(existing);

      const params = {
        type: "task",
        idempotencyKey: "unique-key-123",
      };

      const result = await store.create(params);

      expect(result).toEqual(existing);
      expect(store.findByIdempotencyKey).toHaveBeenCalledWith("unique-key-123");
    });

    it("should create with optional fields", async () => {
      const execution = createMockExecution({
        idempotencyKey: "batch-key-123",
        type: "batch",
        scheduledFor: new Date("2026-01-01T00:00:00Z"),
        parentId: "parent-execution-id",
        metadata: { source: "api" },
      });
      const selectMock = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([execution])),
          })),
        })),
      }));
      mockDb.select = selectMock;

      const params = {
        type: "batch",
        scheduledFor: new Date("2026-01-01T00:00:00Z"),
        idempotencyKey: "batch-key-123",
        parentId: "parent-execution-id",
        metadata: { source: "api" },
      };

      const result = await store.create(params);

      expect(result.scheduledFor).toEqual(new Date("2026-01-01T00:00:00Z"));
      expect(result.idempotencyKey).toBe("batch-key-123");
      expect(result.parentId).toBe("parent-execution-id");
      expect(result.metadata).toEqual({ source: "api" });
    });

    it("should create execution replay fields and initial logs", async () => {
      const result = await store.create({
        type: "workflow",
        replayOf: "source-execution-id",
        logs: [
          {
            timestamp: "2026-01-01T00:00:00.000Z",
            level: "info",
            message: "Execution replay created",
          },
        ],
      });

      expect(result.replayOf).toBe("source-execution-id");
      expect(result.logs).toEqual([
        {
          timestamp: "2026-01-01T00:00:00.000Z",
          level: "info",
          message: "Execution replay created",
        },
      ]);
    });

    it("should return existing execution when idempotency key conflicts during insert", async () => {
      const existing = createMockExecution({
        id: "existing-execution-id",
        idempotencyKey: "race-key-123",
      });

      vi.spyOn(store, "findByIdempotencyKey")
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existing);

      mockDb.insert = vi.fn(() => ({
        values: vi.fn(() => ({
          onConflictDoNothing: vi.fn(() => ({
            returning: vi.fn(() => Promise.resolve([])),
          })),
          returning: vi.fn(() => Promise.resolve([])),
        })),
      }));

      const result = await store.create({
        type: "task",
        idempotencyKey: "race-key-123",
      });

      expect(result).toEqual(existing);
      expect(store.findByIdempotencyKey).toHaveBeenCalledTimes(2);
      expect(store.findByIdempotencyKey).toHaveBeenNthCalledWith(1, "race-key-123");
      expect(store.findByIdempotencyKey).toHaveBeenNthCalledWith(2, "race-key-123");
    });

    it("should throw conflict when duplicate key persists without existing record", async () => {
      vi.spyOn(store, "findByIdempotencyKey").mockResolvedValue(null);

      mockDb.insert = vi.fn(() => ({
        values: vi.fn(() => ({
          onConflictDoNothing: vi.fn(() => ({
            returning: vi.fn(() => Promise.resolve([])),
          })),
          returning: vi.fn(() => Promise.resolve([])),
        })),
      }));

      await expect(
        store.create({
          type: "task",
          idempotencyKey: "race-key-456",
        }),
      ).rejects.toThrow("Execution with idempotency key 'race-key-456' already exists");
    });

    it("should propagate insert errors when idempotency key is not provided", async () => {
      mockDb.insert = vi.fn(() => ({
        values: vi.fn(() => ({
          onConflictDoNothing: vi.fn(() => ({
            returning: vi.fn(() => Promise.resolve([])),
          })),
          returning: vi.fn(() => {
            throw ProblemFactory.internalServerError(
              "testing/execution-insert-failed",
              "insert failed",
            );
          }),
        })),
      }));

      await expect(
        store.create({
          type: "task",
        }),
      ).rejects.toThrow("insert failed");
    });
  });

  describe("findById", () => {
    it("should return execution when found", async () => {
      const execution = createMockExecution();
      const selectMock = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([execution])),
          })),
        })),
      }));
      mockDb.select = selectMock;

      const result = await store.findById("test-execution-id");

      expect(result).toEqual(execution);
    });

    it("should return null when not found", async () => {
      const selectMock = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
        })),
      }));
      mockDb.select = selectMock;

      const result = await store.findById("non-existent-id");

      expect(result).toBeNull();
    });
  });

  describe("findByIdempotencyKey", () => {
    it("should return execution when found", async () => {
      const execution = createMockExecution({ idempotencyKey: "unique-key" });
      const selectMock = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([execution])),
          })),
        })),
      }));
      mockDb.select = selectMock;

      const result = await store.findByIdempotencyKey("unique-key");

      expect(result).toEqual(execution);
    });

    it("should return null when not found", async () => {
      const selectMock = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
        })),
      }));
      mockDb.select = selectMock;

      const result = await store.findByIdempotencyKey("non-existent-key");

      expect(result).toBeNull();
    });
  });

  describe("update", () => {
    it("should update execution and return updated record", async () => {
      const execution = createMockExecution();
      const updated = { ...execution, status: "completed" as ExecutionStatus };

      const updateMock = vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(() => Promise.resolve([updated])),
          })),
        })),
      }));
      mockDb.update = updateMock;

      const result = await store.update(execution.id, { status: "completed" });

      expect(result.status).toBe("completed");
    });

    it("should not null out omitted fields during partial updates", async () => {
      const execution = createMockExecution({
        payload: { task: "keep-me" },
        result: { ok: true },
        replayOf: "source-exec",
        logs: [
          {
            timestamp: "2026-01-01T00:00:00.000Z",
            level: "info",
            message: "keep me",
          },
        ],
        metadata: { source: "api" },
      });
      const updated = { ...execution, status: "completed" as ExecutionStatus };

      const setMock = vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([updated])),
        })),
      }));
      const updateMock = vi.fn(() => ({
        set: setMock,
      }));
      mockDb.update = updateMock;

      await store.update(execution.id, { status: "completed" });

      expect(setMock).toHaveBeenCalledWith({
        status: "completed",
      });
    });

    it("should clear retry metadata when fields are explicitly set to undefined", async () => {
      const execution = createMockExecution({
        status: "retrying",
        error: { message: "previous attempt", retryable: true },
        completedAt: new Date("2026-01-01T00:00:00.000Z"),
      });
      const updated = {
        ...execution,
        status: "running" as ExecutionStatus,
        error: null,
        completedAt: null,
      };

      const setMock = vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([updated])),
        })),
      }));
      const updateMock = vi.fn(() => ({
        set: setMock,
      }));
      mockDb.update = updateMock;

      const result = await store.update(execution.id, {
        status: "running",
        error: undefined,
        completedAt: undefined,
      });

      expect(setMock).toHaveBeenCalledWith({
        status: "running",
        error: null,
        completedAt: null,
      });
      expect(result.error).toBeUndefined();
      expect(result.completedAt).toBeUndefined();
    });

    it("should update replay fields and logs", async () => {
      const execution = createMockExecution();
      const logs = [
        {
          timestamp: "2026-01-01T00:00:00.000Z",
          level: "warn" as const,
          message: "operator replay requested",
        },
      ];
      const updated = { ...execution, replayOf: "source-exec", logs };

      const setMock = vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([updated])),
        })),
      }));
      const updateMock = vi.fn(() => ({
        set: setMock,
      }));
      mockDb.update = updateMock;

      const result = await store.update(execution.id, {
        replayOf: "source-exec",
        logs,
      });

      expect(setMock).toHaveBeenCalledWith({
        replayOf: "source-exec",
        logs,
      });
      expect(result.replayOf).toBe("source-exec");
      expect(result.logs).toEqual(logs);
    });

    it("should throw error when execution not found", async () => {
      const updateMock = vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(() => Promise.resolve([])),
          })),
        })),
      }));
      mockDb.update = updateMock;

      await expect(store.update("non-existent-id", { status: "completed" })).rejects.toThrow(
        ExecutionProblem,
      );
    });
  });

  describe("appendLog", () => {
    it("should append execution logs through a single update", async () => {
      const execution = createMockExecution();
      const entry = {
        timestamp: "2026-01-01T00:00:00.000Z",
        level: "info" as const,
        message: "operator replay requested",
      };
      const updated = { ...execution, logs: [entry] };

      const setMock = vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([updated])),
        })),
      }));
      const updateMock = vi.fn(() => ({
        set: setMock,
      }));
      mockDb.update = updateMock;

      const result = await store.appendLog(execution.id, entry);

      expect(setMock).toHaveBeenCalledWith({
        logs: expect.anything(),
      });
      expect(result.logs).toEqual([entry]);
    });

    it("should throw error when appending logs to a missing execution", async () => {
      const updateMock = vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(() => Promise.resolve([])),
          })),
        })),
      }));
      mockDb.update = updateMock;

      await expect(
        store.appendLog("missing-execution", {
          timestamp: "2026-01-01T00:00:00.000Z",
          level: "error",
          message: "missing",
        }),
      ).rejects.toThrow(ExecutionProblem);
    });
  });

  describe("updateIfStatus", () => {
    it("uses both execution ID and expected status predicates", async () => {
      const execution = createMockExecution({ status: "completed" });
      const whereMock = vi.fn((_condition: unknown) => ({
        returning: vi.fn(() => Promise.resolve([execution])),
      }));
      mockDb.update = vi.fn(() => ({
        set: vi.fn(() => ({ where: whereMock })),
      }));

      await store.updateIfStatus(execution.id, "running", {
        status: "completed",
      });

      const whereCall = whereMock.mock.calls[0];
      if (!whereCall) throw new Error("expected conditional update predicate");
      const condition = whereCall[0] as SQL;
      const query = new PgDialect().sqlToQuery(condition);
      expect(query.sql).toContain('"executions"."id" = $1');
      expect(query.sql).toContain('"executions"."status" = $2');
      expect(query.params).toEqual([execution.id, "running"]);
    });

    it("returns null when the expected status no longer matches", async () => {
      mockDb.update = vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(() => Promise.resolve([])),
          })),
        })),
      }));

      await expect(
        store.updateIfStatus("lost-race", "running", { status: "timed_out" }),
      ).resolves.toBeNull();
    });
  });

  describe("continuation compare-and-set", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");

    it("atomically starts an initial continuation claim", async () => {
      const pending = createMockExecution();
      mockDb.select = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({ limit: vi.fn(() => Promise.resolve([pending])) })),
        })),
      }));

      let written: Record<string, unknown> = {};
      let predicate: unknown;
      mockDb.update = vi.fn(() => ({
        set: vi.fn((values: Record<string, unknown>) => {
          written = values;
          return {
            where: vi.fn((condition: unknown) => {
              predicate = condition;
              return {
                returning: vi.fn(() => Promise.resolve([{ ...pending, ...values }])),
              };
            }),
          };
        }),
      }));

      const result = await store.acquireContinuation(pending.id, {
        deliveryToken: "initial",
        workerId: "worker-a",
        proposedAttemptToken: "attempt-2",
        fencingToken: "fence-1",
        now,
        leaseDurationMs: 1_000,
        initialToken: "initial",
      });

      expect(result).toMatchObject({
        kind: "process",
        execution: { status: "running", attempts: 1 },
        claim: {
          fencingToken: "fence-1",
          processingToken: "attempt-2",
          expiresAt: new Date("2026-01-01T00:00:01.000Z"),
        },
      });
      expect(written).toMatchObject({ status: "running", attempts: 1, error: null });
      expect(renderSql(predicate)).toContain('"executions"."continuation" is null');
    });

    it("preserves the original start time when reclaiming a running continuation", async () => {
      const startedAt = new Date("2025-12-31T23:59:00.000Z");
      const running = createMockExecution({
        status: "running",
        attempts: 1,
        startedAt,
        continuation: {
          attempt: 1,
          expectedToken: "initial",
          claim: {
            fencingToken: "expired-fence",
            processingToken: "attempt-1",
            workerId: "expired-worker",
            attempt: 1,
            expiresAt: new Date("2025-12-31T23:59:59.000Z"),
          },
        },
      });
      mockDb.select = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({ limit: vi.fn(() => Promise.resolve([running])) })),
        })),
      }));

      let written: Record<string, unknown> = {};
      mockDb.update = vi.fn(() => ({
        set: vi.fn((values: Record<string, unknown>) => {
          written = values;
          return {
            where: vi.fn(() => ({
              returning: vi.fn(() => Promise.resolve([{ ...running, ...values }])),
            })),
          };
        }),
      }));

      const result = await store.acquireContinuation(running.id, {
        deliveryToken: "initial",
        workerId: "takeover-worker",
        proposedAttemptToken: "unused-attempt-token",
        fencingToken: "takeover-fence",
        now,
        leaseDurationMs: 1_000,
        initialToken: "initial",
      });

      expect(written).not.toHaveProperty("startedAt");
      expect(result.execution.startedAt).toEqual(startedAt);
      expect(result).toMatchObject({
        kind: "process",
        claim: { processingToken: "attempt-1", fencingToken: "takeover-fence" },
      });
    });

    it("rereads a winning claim after losing acquisition CAS", async () => {
      const pending = createMockExecution();
      const winner = createMockExecution({
        status: "running",
        attempts: 1,
        continuation: {
          attempt: 1,
          expectedToken: "initial",
          claim: {
            fencingToken: "winner-fence",
            processingToken: "attempt-1",
            workerId: "worker-a",
            attempt: 1,
            expiresAt: new Date("2026-01-01T00:00:05.000Z"),
          },
        },
      });
      const limit = vi.fn().mockResolvedValueOnce([pending]).mockResolvedValueOnce([winner]);
      mockDb.select = vi.fn(() => ({
        from: vi.fn(() => ({ where: vi.fn(() => ({ limit })) })),
      }));
      mockDb.update = vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({ returning: vi.fn(() => Promise.resolve([])) })),
        })),
      }));

      const result = await store.acquireContinuation(pending.id, {
        deliveryToken: "initial",
        workerId: "worker-b",
        proposedAttemptToken: "attempt-2",
        fencingToken: "loser-fence",
        now,
        leaseDurationMs: 1_000,
        initialToken: "initial",
      });

      expect(result).toMatchObject({
        kind: "contended",
        execution: { attempts: 1 },
        claim: { fencingToken: "winner-fence", workerId: "worker-a" },
      });
      expect(mockDb.update).toHaveBeenCalledTimes(1);
    });

    it("allows exactly one winner across concurrent initial acquisitions", async () => {
      let row = createMockExecution();
      let releaseInitialReads!: () => void;
      const initialReadsReady = new Promise<void>((resolve) => {
        releaseInitialReads = resolve;
      });
      let initialReadCount = 0;
      mockDb.select = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => {
              if (initialReadCount < 2) {
                const snapshot = row;
                initialReadCount += 1;
                if (initialReadCount === 2) releaseInitialReads();
                await initialReadsReady;
                return [snapshot];
              }
              return [row];
            }),
          })),
        })),
      }));
      mockDb.update = vi.fn(() => ({
        set: vi.fn((values: Partial<Execution>) => ({
          where: vi.fn(() => ({
            returning: vi.fn(async () => {
              if (row.status !== "pending") return [];
              row = { ...row, ...values };
              return [row];
            }),
          })),
        })),
      }));

      const contender = new DrizzleExecutionStore(mockDb);
      const baseInput = {
        deliveryToken: "initial",
        proposedAttemptToken: "attempt-2",
        now,
        leaseDurationMs: 1_000,
        initialToken: "initial",
      };
      const results = await Promise.all([
        store.acquireContinuation(row.id, {
          ...baseInput,
          workerId: "worker-a",
          fencingToken: "fence-a",
        }),
        contender.acquireContinuation(row.id, {
          ...baseInput,
          workerId: "worker-b",
          fencingToken: "fence-b",
        }),
      ]);

      expect(results.map((result) => result.kind).sort()).toEqual(["contended", "process"]);
      expect(row).toMatchObject({ status: "running", attempts: 1 });
      expect(mockDb.update).toHaveBeenCalledTimes(2);
    });

    it("terminates repeated acquisition CAS losses with a fresh stale snapshot", async () => {
      const pending = createMockExecution();
      mockDb.select = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({ limit: vi.fn(() => Promise.resolve([pending])) })),
        })),
      }));
      mockDb.update = vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({ returning: vi.fn(() => Promise.resolve([])) })),
        })),
      }));

      const result = await store.acquireContinuation(pending.id, {
        deliveryToken: "initial",
        workerId: "worker-a",
        proposedAttemptToken: "attempt-2",
        fencingToken: "fence-a",
        now,
        leaseDurationMs: 1_000,
        initialToken: "initial",
      });

      expect(result).toMatchObject({ kind: "stale", execution: { status: "pending" } });
      expect(mockDb.update).toHaveBeenCalledTimes(2);
      expect(mockDb.select).toHaveBeenCalledTimes(3);
    });

    it("stages checkpoints only under the complete observed continuation CAS", async () => {
      const running = createMockExecution({
        status: "running",
        attempts: 1,
        continuation: {
          attempt: 1,
          expectedToken: "initial",
          claim: {
            fencingToken: "fence-1",
            processingToken: "attempt-1",
            workerId: "worker-a",
            attempt: 1,
            expiresAt: new Date("2026-01-01T00:00:05.000Z"),
          },
        },
      });
      mockDb.select = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({ limit: vi.fn(() => Promise.resolve([running])) })),
        })),
      }));

      let written: Record<string, unknown> = {};
      let predicate: unknown;
      mockDb.update = vi.fn(() => ({
        set: vi.fn((values: Record<string, unknown>) => {
          written = values;
          return {
            where: vi.fn((condition: unknown) => {
              predicate = condition;
              return {
                returning: vi.fn(() => Promise.resolve([{ ...running, ...values }])),
              };
            }),
          };
        }),
      }));

      const result = await store.updateClaimedContinuation(running.id, {
        fencingToken: "fence-1",
        update: { kind: "stage", checkpoints: { cursor: 7 }, nextToken: "next-1" },
      });

      expect(result).toMatchObject({
        checkpoints: { cursor: 7 },
        continuation: {
          pendingPublication: { sourceToken: "initial", nextToken: "next-1" },
        },
      });
      expect(written).toMatchObject({ checkpoints: { cursor: 7 } });
      const sql = renderSql(predicate);
      expect(sql).toContain('"executions"."status" = $1');
      expect(sql).toContain('"executions"."continuation" = $1::jsonb');
    });

    it("returns null when another same-fence mutation wins the whole-state CAS", async () => {
      const running = createMockExecution({
        status: "running",
        attempts: 1,
        continuation: {
          attempt: 1,
          expectedToken: "initial",
          claim: {
            fencingToken: "fence-1",
            processingToken: "attempt-1",
            workerId: "worker-a",
            attempt: 1,
            expiresAt: new Date("2026-01-01T00:00:05.000Z"),
          },
        },
      });
      mockDb.select = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({ limit: vi.fn(() => Promise.resolve([running])) })),
        })),
      }));
      mockDb.update = vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({ returning: vi.fn(() => Promise.resolve([])) })),
        })),
      }));

      await expect(
        store.updateClaimedContinuation(running.id, {
          fencingToken: "fence-1",
          update: {
            kind: "renew",
            workerId: "worker-a",
            now,
            expiresAt: new Date(now.getTime() + 1_000),
          },
        }),
      ).resolves.toBeNull();
    });
  });

  describe("listRunning", () => {
    it("uses a stable ID keyset and requested batch limit", async () => {
      const running = createMockExecution({
        id: "exec-003",
        status: "running",
      });
      const limitMock = vi.fn(() => Promise.resolve([running]));
      const orderByMock = vi.fn(() => ({ limit: limitMock }));
      const whereMock = vi.fn((_condition: unknown) => ({
        orderBy: orderByMock,
      }));
      mockDb.select = vi.fn(() => ({
        from: vi.fn(() => ({ where: whereMock })),
      }));

      const result = await store.listRunning({
        afterId: "exec-002",
        limit: 25,
      });

      const whereCall = whereMock.mock.calls[0];
      if (!whereCall) throw new Error("expected running keyset predicate");
      const condition = whereCall[0] as SQL;
      const query = new PgDialect().sqlToQuery(condition);
      expect(query.sql).toContain('"executions"."status" = $1');
      expect(query.sql).toContain('"executions"."id" > $2');
      expect(query.params).toEqual(["running", "exec-002"]);
      expect(orderByMock).toHaveBeenCalledWith(expect.anything());
      expect(limitMock).toHaveBeenCalledWith(25);
      expect(result).toEqual([running]);
    });
  });

  describe("list", () => {
    it("should return all executions when no filters provided", async () => {
      const executions = [createMockExecution(), createMockExecution({ id: "another-id" })];
      const selectMock = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve(executions)),
            })),
          })),
        })),
      }));
      mockDb.select = selectMock;

      const result = await store.list();

      expect(result).toHaveLength(2);
    });

    it("should filter by status", async () => {
      const pendingExecutions = [createMockExecution({ status: "pending" })];
      const selectMock = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve(pendingExecutions)),
            })),
          })),
        })),
      }));
      mockDb.select = selectMock;

      const result = await store.list({ status: "pending" });

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("pending");
    });

    it("should filter by replay source", async () => {
      const replayExecutions = [createMockExecution({ replayOf: "source-exec" })];
      const selectMock = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve(replayExecutions)),
            })),
          })),
        })),
      }));
      mockDb.select = selectMock;

      const result = await store.list({ replayOf: "source-exec" });

      expect(result).toHaveLength(1);
      expect(result[0].replayOf).toBe("source-exec");
    });

    it("should support pagination with limit and offset", async () => {
      const executions = [createMockExecution()];
      const selectMock = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => ({
                offset: vi.fn(() => Promise.resolve(executions)),
              })),
            })),
          })),
        })),
      }));
      mockDb.select = selectMock;

      const result = await store.list({ limit: 10, offset: 20 });

      expect(result).toHaveLength(1);
    });
  });

  describe("delete", () => {
    it("should delete execution", async () => {
      const execution = createMockExecution();
      const deleteMock = vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([execution])),
        })),
      }));
      mockDb.delete = deleteMock;

      await expect(store.delete(execution.id)).resolves.toBeUndefined();
    });

    it("should throw error when execution not found", async () => {
      const deleteMock = vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([])),
        })),
      }));
      mockDb.delete = deleteMock;

      await expect(store.delete("non-existent-id")).rejects.toThrow(ExecutionProblem);
    });
  });
});
