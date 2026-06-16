import { type Execution, ExecutionProblem, type ExecutionStatus } from "@croco/execution-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DrizzleExecutionStore } from "../libs/DrizzleExecutionStore";

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
  const whereClauseMock = vi.fn(() => ({ orderBy: orderByMock, limit: limitMock }));

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
      const existing = createMockExecution({ idempotencyKey: "unique-key-123" });
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
            throw new Error("insert failed");
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
