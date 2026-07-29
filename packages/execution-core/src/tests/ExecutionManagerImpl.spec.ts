import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CreateExecutionRecordParams,
  Execution,
  ExecutionError,
  ExecutionLogEntry,
  ExecutionLogStore,
  ExecutionStatus,
  ExecutionStore,
  ListExecutionsOptions,
  ListRunningExecutionsOptions,
} from "../index";
import {
  createExecutionCheckpointStoreConformanceSuite,
  createExecutionJobsOperations,
  ExecutionManagerImpl,
  ExecutionProblem,
} from "../index";

class MockExecutionStore implements ExecutionStore, ExecutionLogStore {
  private executions: Map<string, Execution> = new Map();
  private idCounter = 0;

  async create(params: CreateExecutionRecordParams): Promise<Execution> {
    const id = `exec-${++this.idCounter}`;
    const now = new Date();

    const execution: Execution = {
      id,
      type: params.type,
      status: "pending",
      payload: params.payload,
      maxAttempts: params.maxAttempts ?? 1,
      timeout: params.timeout,
      scheduledFor: params.scheduledFor,
      idempotencyKey: params.idempotencyKey,
      requestFingerprint: params.requestFingerprint,
      replayOf: params.replayOf,
      logs: params.logs,
      parentId: params.parentId,
      metadata: params.metadata,
      attempts: 0,
      createdAt: now,
    };

    this.executions.set(id, execution);
    return execution;
  }

  async findById(id: string): Promise<Execution | null> {
    return this.executions.get(id) ?? null;
  }

  async findByIdempotencyKey(key: string): Promise<Execution | null> {
    for (const execution of this.executions.values()) {
      if (execution.idempotencyKey === key) {
        return execution;
      }
    }
    return null;
  }

  async update(id: string, data: Partial<Execution>): Promise<Execution> {
    const existing = this.executions.get(id);
    if (!existing) {
      throw new Error(`Execution with id '${id}' not found`);
    }

    const updated = { ...existing, ...data };
    this.executions.set(id, updated);
    return updated;
  }

  async updateIfStatus(
    id: string,
    expectedStatus: ExecutionStatus,
    data: Partial<Execution>,
  ): Promise<Execution | null> {
    const existing = this.executions.get(id);
    if (!existing || existing.status !== expectedStatus) {
      return null;
    }

    return this.update(id, data);
  }

  async listRunning(options: ListRunningExecutionsOptions): Promise<Execution[]> {
    return Array.from(this.executions.values())
      .filter(
        (execution) =>
          execution.status === "running" &&
          (options.afterId === undefined || execution.id > options.afterId),
      )
      .sort((left, right) => left.id.localeCompare(right.id))
      .slice(0, options.limit);
  }

  async appendLog(id: string, entry: ExecutionLogEntry): Promise<Execution> {
    const existing = this.executions.get(id);
    if (!existing) {
      throw new Error(`Execution with id '${id}' not found`);
    }

    return this.update(id, {
      logs: [...(existing.logs ?? []), entry],
    });
  }

  async mergeCheckpoint(id: string, key: string, value: unknown): Promise<Execution> {
    const existing = this.executions.get(id);
    if (!existing) {
      throw new Error(`Execution with id '${id}' not found`);
    }

    return this.update(id, {
      checkpoints: {
        ...existing.checkpoints,
        [key]: value,
      },
    });
  }

  async list(options: ListExecutionsOptions = {}): Promise<Execution[]> {
    let executions = Array.from(this.executions.values());

    if (options.status) {
      executions = executions.filter((execution) => execution.status === options.status);
    }

    if (options.type) {
      executions = executions.filter((execution) => execution.type === options.type);
    }

    if (options.parentId !== undefined) {
      executions = executions.filter((execution) => execution.parentId === options.parentId);
    }

    if (options.replayOf !== undefined) {
      executions = executions.filter((execution) => execution.replayOf === options.replayOf);
    }

    const offset = options.offset ?? 0;
    return executions.slice(offset, options.limit ? offset + options.limit : undefined);
  }

  async delete(id: string): Promise<void> {
    this.executions.delete(id);
  }
}

describe("MockExecutionStore checkpoint conformance", () => {
  const suite = createExecutionCheckpointStoreConformanceSuite({
    createStore: () => new MockExecutionStore(),
    runConcurrentWrites: async (store, executionId, writes) => {
      await Promise.all(
        writes.map((write) => store.mergeCheckpoint(executionId, write.key, write.value)),
      );
      return { lastAppliedWrite: writes.length - 1 };
    },
  });

  for (const testCase of suite.cases) {
    // oxlint-disable-next-line jest/valid-title -- exported conformance cases own stable names
    it(testCase.name, testCase.run);
  }
});

describe("ExecutionManagerImpl", () => {
  let store!: MockExecutionStore;
  let manager!: ExecutionManagerImpl;

  beforeEach(() => {
    store = new MockExecutionStore();
    manager = new ExecutionManagerImpl(store);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("create", () => {
    it("creates execution with pending status", async () => {
      const execution = await manager.create({ type: "task" });

      expect(execution.status).toBe("pending");
      expect(execution.type).toBe("task");
      expect(execution.maxAttempts).toBe(1);
      expect(execution.attempts).toBe(0);
    });

    it("respects maxAttempts parameter", async () => {
      const execution = await manager.create({ type: "task", maxAttempts: 5 });

      expect(execution.maxAttempts).toBe(5);
    });

    it("returns existing execution for same idempotencyKey", async () => {
      const first = await manager.create({
        type: "task",
        payload: { accountId: "acct-1", action: "sync" },
        idempotencyKey: "key-1",
      });
      const second = await manager.create({
        type: "task",
        payload: { action: "sync", accountId: "acct-1" },
        idempotencyKey: "key-1",
      });

      expect(first.id).toBe(second.id);
    });

    it.each(["running", "completed", "failed"] as const)(
      "rejects a different request fingerprint for an existing %s execution",
      async (status) => {
        const first = await manager.create({
          type: "billing-sync",
          payload: { accountId: "acct-1" },
          idempotencyKey: "key-1",
        });
        await manager.start(first.id);
        if (status === "completed") {
          await manager.complete(first.id, "done");
        } else if (status === "failed") {
          await manager.fail(first.id, { message: "provider unavailable", retryable: false });
        }

        await expect(
          manager.create({
            type: "billing-sync",
            payload: { accountId: "acct-2" },
            idempotencyKey: "key-1",
          }),
        ).rejects.toMatchObject({
          code: "execution/idempotency-conflict",
          category: "Conflict",
        });

        const repeated = await manager.create({
          type: "billing-sync",
          payload: { accountId: "acct-1" },
          idempotencyKey: "key-1",
        });
        expect(repeated.id).toBe(first.id);
        expect(repeated.status).toBe(status);
      },
    );

    it("validates an idempotent execution returned by a concurrent store create", async () => {
      vi.spyOn(store, "findByIdempotencyKey").mockResolvedValueOnce(null);
      vi.spyOn(store, "create").mockResolvedValueOnce({
        id: "exec-concurrent",
        type: "other-task",
        status: "completed",
        payload: { accountId: "acct-2" },
        attempts: 1,
        maxAttempts: 1,
        createdAt: new Date(),
        idempotencyKey: "key-1",
      });

      await expect(
        manager.create({
          type: "billing-sync",
          payload: { accountId: "acct-1" },
          idempotencyKey: "key-1",
        }),
      ).rejects.toMatchObject({
        code: "execution/idempotency-conflict",
      });
    });

    it("reuses a matching execution through a legacy idempotency key", async () => {
      const legacy = await manager.create({
        type: "billing-sync",
        payload: { accountId: "acct-1" },
        idempotencyKey: "legacy-key",
      });
      await manager.start(legacy.id);
      await manager.complete(legacy.id, "legacy-result");

      const migrated = await manager.create({
        type: "billing-sync",
        payload: { accountId: "acct-1" },
        idempotencyKey: "scoped-key",
        legacyIdempotencyKeys: ["legacy-key"],
      });

      expect(migrated.id).toBe(legacy.id);
      expect(migrated.result).toBe("legacy-result");
    });

    it("ignores a conflicting legacy key and creates the scoped execution", async () => {
      const legacy = await manager.create({
        type: "other-task",
        payload: { accountId: "acct-2" },
        idempotencyKey: "legacy-key",
      });

      const migrated = await manager.create({
        type: "billing-sync",
        payload: { accountId: "acct-1" },
        idempotencyKey: "scoped-key",
        legacyIdempotencyKeys: ["legacy-key"],
      });

      expect(migrated.id).not.toBe(legacy.id);
      expect(migrated.idempotencyKey).toBe("scoped-key");
    });

    it("rejects a different payload for the same execution type through a legacy key", async () => {
      const legacy = await manager.create({
        type: "billing-sync",
        payload: { accountId: "acct-1" },
        idempotencyKey: "legacy-key",
      });
      await store.update(legacy.id, { requestFingerprint: undefined });

      await expect(
        manager.create({
          type: "billing-sync",
          payload: { accountId: "acct-2" },
          idempotencyKey: "scoped-key",
          legacyIdempotencyKeys: ["legacy-key"],
        }),
      ).rejects.toMatchObject({
        code: "execution/idempotency-conflict",
      });
    });

    it.each([
      ["null", null, null],
      [
        "a date serialized by durable JSON storage",
        "2026-01-01T00:00:00.000Z",
        new Date("2026-01-01T00:00:00.000Z"),
      ],
    ])("reuses a matching legacy %s payload", async (_case, storedPayload, requestedPayload) => {
      const legacy = await manager.create({
        type: "billing-sync",
        payload: storedPayload,
        idempotencyKey: "legacy-key",
      });
      await store.update(legacy.id, {
        payload: storedPayload,
        requestFingerprint: undefined,
      });

      const migrated = await manager.create({
        type: "billing-sync",
        payload: requestedPayload,
        idempotencyKey: "scoped-key",
        legacyIdempotencyKeys: ["legacy-key"],
      });

      expect(migrated.id).toBe(legacy.id);
    });

    it("reuses a matching legacy object when its keys are reordered", async () => {
      const legacy = await manager.create({
        type: "billing-sync",
        payload: { accountId: "acct-1", action: "sync" },
        idempotencyKey: "legacy-key",
      });
      await store.update(legacy.id, { requestFingerprint: undefined });

      const migrated = await manager.create({
        type: "billing-sync",
        payload: { action: "sync", accountId: "acct-1" },
        idempotencyKey: "scoped-key",
        legacyIdempotencyKeys: ["legacy-key"],
      });

      expect(migrated.id).toBe(legacy.id);
    });

    it.each([
      ["an omitted payload persisted as null", null, undefined],
      [
        "a date persisted as an ISO string",
        "2026-01-01T00:00:00.000Z",
        new Date("2026-01-01T00:00:00.000Z"),
      ],
    ])("reuses an unchanged legacy key with %s", async (_case, storedPayload, requestedPayload) => {
      const legacy = await manager.create({
        type: "billing-sync",
        payload: storedPayload,
        idempotencyKey: "unchanged-key",
      });
      await store.update(legacy.id, {
        payload: storedPayload,
        requestFingerprint: undefined,
      });

      const repeated = await manager.create({
        type: "billing-sync",
        payload: requestedPayload,
        idempotencyKey: "unchanged-key",
      });

      expect(repeated.id).toBe(legacy.id);
    });

    it.each([
      ["undefined and null", undefined, null],
      ["an omitted object field and an undefined field", {}, { value: undefined }],
      ["zero and negative zero", 0, -0],
    ])(
      "distinguishes %s in persisted request fingerprints",
      async (_case, firstPayload, nextPayload) => {
        await manager.create({
          type: "task",
          payload: firstPayload,
          idempotencyKey: "key-1",
        });

        await expect(
          manager.create({
            type: "task",
            payload: nextPayload,
            idempotencyKey: "key-1",
          }),
        ).rejects.toMatchObject({
          code: "execution/idempotency-conflict",
        });
      },
    );

    it.each([
      ["Map", new Map([["value", 1]])],
      ["Set", new Set([1])],
      ["typed array", new Uint8Array([1])],
    ])(
      "rejects unsupported %s payloads instead of fingerprinting them as plain objects",
      async (_case, payload) => {
        await expect(
          manager.create({
            type: "task",
            payload,
            idempotencyKey: "key-1",
          }),
        ).rejects.toMatchObject({
          code: "execution/idempotency-conflict",
        });
      },
    );

    it("creates new execution for different idempotencyKey", async () => {
      const first = await manager.create({
        type: "task",
        idempotencyKey: "key-1",
      });
      const second = await manager.create({
        type: "task",
        idempotencyKey: "key-2",
      });

      expect(first.id).not.toBe(second.id);
    });

    it("creates execution with replay link and initial logs", async () => {
      const execution = await manager.create({
        type: "workflow",
        replayOf: "source-exec",
        logs: [
          {
            timestamp: "2026-01-01T00:00:00.000Z",
            level: "info",
            message: "created from replay",
          },
        ],
      });

      expect(execution.replayOf).toBe("source-exec");
      expect(execution.logs).toEqual([
        {
          timestamp: "2026-01-01T00:00:00.000Z",
          level: "info",
          message: "created from replay",
        },
      ]);
    });
  });

  describe("inspect", () => {
    it("gets execution by id", async () => {
      const execution = await manager.create({ type: "task" });

      await expect(manager.get(execution.id)).resolves.toEqual(execution);
    });

    it("lists executions through the store", async () => {
      const first = await manager.create({ type: "task" });
      const second = await manager.create({ type: "workflow" });

      await expect(manager.list()).resolves.toEqual([first, second]);
    });

    it("throws not found when getting a missing execution", async () => {
      await expect(manager.get("missing-execution")).rejects.toThrow(
        "Execution with id 'missing-execution' not found",
      );
    });
  });

  describe("start", () => {
    it("transitions pending to running", async () => {
      const execution = await manager.create({ type: "task" });
      const started = await manager.start(execution.id);

      expect(started.status).toBe("running");
      expect(started.attempts).toBe(1);
      expect(started.startedAt).not.toBeUndefined();
    });

    it("transitions retrying to running and increments attempts for the new run", async () => {
      const execution = await manager.create({ type: "task", maxAttempts: 3 });
      await manager.start(execution.id);
      await manager.fail(execution.id, { message: "error", retryable: true });

      const restarted = await manager.start(execution.id);

      expect(restarted.status).toBe("running");
      expect(restarted.attempts).toBe(2);
      expect(restarted.error).toBeUndefined();
    });

    it("clears previous attempt errors when restarting automatic retries", async () => {
      const execution = await manager.create({ type: "task", maxAttempts: 3 });
      await manager.start(execution.id);
      await manager.fail(execution.id, {
        message: "transient error",
        retryable: true,
      });

      const restarted = await manager.start(execution.id);

      expect(restarted.status).toBe("running");
      expect(restarted.error).toBeUndefined();
    });

    it("resets startedAt when restarting from retrying", async () => {
      vi.useFakeTimers();
      const firstAttemptAt = new Date("2026-01-01T00:00:00.000Z");
      vi.setSystemTime(firstAttemptAt);

      const execution = await manager.create({ type: "task", maxAttempts: 3 });
      const started = await manager.start(execution.id);
      await manager.fail(execution.id, { message: "error", retryable: true });

      const retryAttemptAt = new Date("2026-01-01T00:00:05.000Z");
      vi.setSystemTime(retryAttemptAt);

      const restarted = await manager.start(execution.id);

      expect(started.startedAt?.toISOString()).toBe(firstAttemptAt.toISOString());
      expect(restarted.startedAt?.toISOString()).toBe(retryAttemptAt.toISOString());
    });

    it("measures timeout per retry attempt instead of cumulative elapsed time", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

      const execution = await manager.create({
        type: "task",
        maxAttempts: 3,
        timeout: 1000,
      });
      await manager.start(execution.id);
      await manager.fail(execution.id, {
        message: "timeout retry",
        retryable: true,
      });

      vi.setSystemTime(new Date("2026-01-01T00:00:03.000Z"));

      const restarted = await manager.start(execution.id);

      expect(restarted.status).toBe("running");
      expect(restarted.startedAt?.toISOString()).toBe("2026-01-01T00:00:03.000Z");
    });

    it("throws for completed execution", async () => {
      const execution = await manager.create({ type: "task" });
      await manager.start(execution.id);
      await manager.complete(execution.id);

      await expect(manager.start(execution.id)).rejects.toThrow(
        "Cannot transition from 'completed' to 'running'",
      );
    });
  });

  describe("complete", () => {
    it("transitions running to completed with result", async () => {
      const execution = await manager.create({ type: "task" });
      await manager.start(execution.id);

      const completed = await manager.complete(execution.id, {
        data: "success",
      });

      expect(completed.status).toBe("completed");
      expect(completed.result).toEqual({ data: "success" });
      expect(completed.completedAt).not.toBeUndefined();
    });

    it("throws for pending execution", async () => {
      const execution = await manager.create({ type: "task" });

      await expect(manager.complete(execution.id)).rejects.toThrow(
        "Cannot transition from 'pending' to 'completed'",
      );
    });

    it("cannot overwrite a timeout that wins the lifecycle race", async () => {
      const execution = await manager.create({ type: "task", timeout: 1 });
      await manager.start(execution.id);
      const originalUpdateIfStatus = store.updateIfStatus.bind(store);
      vi.spyOn(store, "updateIfStatus").mockImplementationOnce(async () => {
        await originalUpdateIfStatus(execution.id, "running", {
          status: "timed_out",
          completedAt: new Date(),
        });
        return null;
      });

      await expect(manager.complete(execution.id, "late result")).rejects.toThrow(
        "current status is 'timed_out'",
      );
      const persisted = await manager.get(execution.id);
      expect(persisted.status).toBe("timed_out");
      expect(persisted.result).toBeUndefined();
    });
  });

  describe("fail", () => {
    async function expectInvalidRetryableFailPreservesExecution(
      execution: Execution,
    ): Promise<void> {
      const before = await manager.get(execution.id);
      const error: ExecutionError = {
        message: "transient error",
        retryable: true,
      };
      let thrown: unknown;

      try {
        await manager.fail(execution.id, error);
      } catch (caught) {
        thrown = caught;
      }

      expect(thrown).toBeInstanceOf(ExecutionProblem);
      expect(thrown).toMatchObject({
        code: "execution/invalid-state-transition",
      });
      await expect(manager.get(execution.id)).resolves.toEqual(before);
    }

    it("transitions running to failed when not retryable", async () => {
      const execution = await manager.create({ type: "task" });
      await manager.start(execution.id);

      const error: ExecutionError = {
        message: "fatal error",
        retryable: false,
      };
      const failed = await manager.fail(execution.id, error);

      expect(failed.status).toBe("failed");
      expect(failed.error).toEqual(error);
      expect(failed.completedAt).not.toBeUndefined();
    });

    it("transitions running to retrying when retryable and attempts remain", async () => {
      const execution = await manager.create({ type: "task", maxAttempts: 3 });
      await manager.start(execution.id);

      const error: ExecutionError = {
        message: "transient error",
        retryable: true,
      };
      const failed = await manager.fail(execution.id, error);

      expect(failed.status).toBe("retrying");
      expect(failed.error).toEqual(error);
    });

    it("transitions running to failed when max attempts exhausted", async () => {
      const execution = await manager.create({ type: "task", maxAttempts: 1 });
      await manager.start(execution.id);

      const error: ExecutionError = { message: "error", retryable: true };
      const failed = await manager.fail(execution.id, error);

      expect(failed.status).toBe("failed");
    });

    it("rejects retryable failure from pending without updating execution", async () => {
      const execution = await manager.create({ type: "task", maxAttempts: 3 });

      await expectInvalidRetryableFailPreservesExecution(execution);
    });

    it("rejects retryable failure from completed without updating execution", async () => {
      const execution = await manager.create({ type: "task", maxAttempts: 3 });
      await manager.start(execution.id);
      const completed = await manager.complete(execution.id);

      await expectInvalidRetryableFailPreservesExecution(completed);
    });

    it("rejects retryable failure from cancelled without updating execution", async () => {
      const execution = await manager.create({ type: "task", maxAttempts: 3 });
      const cancelled = await manager.cancel(execution.id);

      await expectInvalidRetryableFailPreservesExecution(cancelled);
    });
  });

  describe("cancel", () => {
    it("transitions pending to cancelled", async () => {
      const execution = await manager.create({ type: "task" });

      const cancelled = await manager.cancel(execution.id, "user request");

      expect(cancelled.status).toBe("cancelled");
      expect(cancelled.completedAt).not.toBeUndefined();
      expect(cancelled.metadata?.cancellationReason).toBe("user request");
    });

    it("transitions running to cancelled", async () => {
      const execution = await manager.create({ type: "task" });
      await manager.start(execution.id);

      const cancelled = await manager.cancel(execution.id);

      expect(cancelled.status).toBe("cancelled");
    });

    it("throws for completed execution", async () => {
      const execution = await manager.create({ type: "task" });
      await manager.start(execution.id);
      await manager.complete(execution.id);

      await expect(manager.cancel(execution.id)).rejects.toThrow(
        "Cannot transition from 'completed' to 'cancelled'",
      );
    });
  });

  describe("retry", () => {
    it("transitions failed to retrying without incrementing attempts", async () => {
      const execution = await manager.create({ type: "task", maxAttempts: 3 });
      await manager.start(execution.id);
      await manager.fail(execution.id, { message: "error", retryable: false });

      const retrying = await manager.retry(execution.id);

      expect(retrying.status).toBe("retrying");
      expect(retrying.attempts).toBe(1);
      expect(retrying.error).toBeUndefined();
      expect(retrying.completedAt).toBeUndefined();
    });

    it("transitions timed_out to retrying", async () => {
      const execution = await manager.create({ type: "task", maxAttempts: 3 });
      await manager.start(execution.id);
      await manager.timeout(execution.id);

      const retrying = await manager.retry(execution.id);

      expect(retrying.status).toBe("retrying");
      expect(retrying.attempts).toBe(1);
      expect(retrying.completedAt).toBeUndefined();
    });

    it("increments attempts only once across retry and restart", async () => {
      const execution = await manager.create({ type: "task", maxAttempts: 3 });
      await manager.start(execution.id);
      await manager.fail(execution.id, { message: "error", retryable: false });

      const retrying = await manager.retry(execution.id);
      const restarted = await manager.start(execution.id);

      expect(retrying.attempts).toBe(1);
      expect(restarted.attempts).toBe(2);
    });

    it("throws when max attempts exceeded", async () => {
      const execution = await manager.create({ type: "task", maxAttempts: 1 });
      await manager.start(execution.id);
      await manager.fail(execution.id, { message: "error", retryable: false });

      await expect(manager.retry(execution.id)).rejects.toThrow("Maximum retry attempts exceeded");
    });
  });

  describe("updateProgress", () => {
    it("updates progress with auto-calculated percent", async () => {
      const execution = await manager.create({ type: "batch" });

      const updated = await manager.updateProgress(execution.id, {
        current: 50,
        total: 100,
      });

      expect(updated.progress?.current).toBe(50);
      expect(updated.progress?.total).toBe(100);
      expect(updated.progress?.percent).toBe(50);
    });

    it("preserves provided percent", async () => {
      const execution = await manager.create({ type: "batch" });

      const updated = await manager.updateProgress(execution.id, {
        current: 50,
        total: 100,
        percent: 75,
      });

      expect(updated.progress?.percent).toBe(75);
    });

    it("handles zero total", async () => {
      const execution = await manager.create({ type: "batch" });

      const updated = await manager.updateProgress(execution.id, {
        current: 0,
        total: 0,
      });

      expect(updated.progress?.percent).toBe(0);
    });
  });

  describe("checkpoint", () => {
    it("sets checkpoint value", async () => {
      const execution = await manager.create({ type: "batch" });

      const updated = await manager.checkpoint(execution.id, "lastIndex", 42);

      expect(updated.checkpoints?.lastIndex).toBe(42);
    });

    it("preserves existing checkpoints", async () => {
      const execution = await manager.create({ type: "batch" });
      await manager.checkpoint(execution.id, "first", "value1");

      const updated = await manager.checkpoint(execution.id, "second", "value2");

      expect(updated.checkpoints?.first).toBe("value1");
      expect(updated.checkpoints?.second).toBe("value2");
    });

    it("preserves concurrent writes to different checkpoint keys", async () => {
      const execution = await manager.create({ type: "batch" });

      await Promise.all([
        manager.checkpoint(execution.id, "page", 10),
        manager.checkpoint(execution.id, "cursor", "abc"),
      ]);

      await expect(store.findById(execution.id)).resolves.toMatchObject({
        checkpoints: {
          page: 10,
          cursor: "abc",
        },
      });
    });

    it("uses last-applied-writer-wins semantics for the same checkpoint key", async () => {
      const execution = await manager.create({ type: "batch" });

      await manager.checkpoint(execution.id, "cursor", "first");
      const updated = await manager.checkpoint(execution.id, "cursor", "second");

      expect(updated.checkpoints?.cursor).toBe("second");
    });
  });

  describe("timeout", () => {
    it("transitions running to timed_out", async () => {
      const execution = await manager.create({ type: "task" });
      await manager.start(execution.id);

      const timedOut = await manager.timeout(execution.id);

      expect(timedOut.status).toBe("timed_out");
      expect(timedOut.completedAt).not.toBeUndefined();
      expect(timedOut.error?.message).toBe("Execution timed out");
      expect(timedOut.error?.retryable).toBe(true);
    });

    it("throws for completed execution", async () => {
      const execution = await manager.create({ type: "task" });
      await manager.start(execution.id);
      await manager.complete(execution.id);

      await expect(manager.timeout(execution.id)).rejects.toThrow(
        "Cannot transition from 'completed' to 'timed_out'",
      );
    });
  });

  describe("reconcileTimedOut", () => {
    it("uses deadline equality and ignores records without an enforceable deadline", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
      const due = await manager.create({ type: "task", timeout: 1000 });
      const notDue = await manager.create({ type: "task", timeout: 1001 });
      const noTimeout = await manager.create({ type: "task" });
      await manager.start(due.id);
      await manager.start(notDue.id);
      await manager.start(noTimeout.id);

      const result = await manager.reconcileTimedOut({
        now: new Date("2026-01-01T00:00:01.000Z"),
        batchSize: 2,
      });

      expect(result).toEqual({ scanned: 3, timedOut: 1 });
      await expect(manager.get(due.id)).resolves.toMatchObject({
        status: "timed_out",
        attempts: 1,
      });
      await expect(manager.get(notDue.id)).resolves.toMatchObject({
        status: "running",
      });
      await expect(manager.get(noTimeout.id)).resolves.toMatchObject({
        status: "running",
      });
    });

    it("advances a stable keyset across mixed batches to later overdue records", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
      const noTimeout = await manager.create({ type: "task" });
      const notDue = await manager.create({ type: "task", timeout: 10_000 });
      const overdue = await manager.create({ type: "task", timeout: 10 });
      await manager.start(noTimeout.id);
      await manager.start(notDue.id);
      await manager.start(overdue.id);

      const result = await manager.reconcileTimedOut({
        now: new Date("2026-01-01T00:00:01.000Z"),
        batchSize: 1,
      });

      expect(result).toEqual({ scanned: 3, timedOut: 1 });
      await expect(manager.get(overdue.id)).resolves.toMatchObject({
        status: "timed_out",
      });
    });

    it("is idempotent when repeated", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
      const execution = await manager.create({ type: "task", timeout: 1 });
      await manager.start(execution.id);
      const now = new Date("2026-01-01T00:00:01.000Z");

      await expect(manager.reconcileTimedOut({ now })).resolves.toEqual({
        scanned: 1,
        timedOut: 1,
      });
      await expect(manager.reconcileTimedOut({ now })).resolves.toEqual({
        scanned: 0,
        timedOut: 0,
      });
    });

    it("rejects an invalid batch size", async () => {
      await expect(manager.reconcileTimedOut({ batchSize: 0 })).rejects.toThrow(
        "batchSize must be a positive integer",
      );
    });
  });

  describe("recordLog", () => {
    it("appends structured logs with deterministic timestamp", async () => {
      const execution = await manager.create({
        type: "workflow",
        logs: [
          {
            timestamp: "2026-01-01T00:00:00.000Z",
            level: "info",
            message: "created",
          },
        ],
      });

      const updated = await manager.recordLog(execution.id, {
        timestamp: new Date("2026-01-01T00:00:01.000Z"),
        level: "warn",
        message: "retry scheduled",
        data: { attempt: 2 },
      });

      expect(updated.logs).toEqual([
        {
          timestamp: "2026-01-01T00:00:00.000Z",
          level: "info",
          message: "created",
        },
        {
          timestamp: "2026-01-01T00:00:01.000Z",
          level: "warn",
          message: "retry scheduled",
          data: { attempt: 2 },
        },
      ]);
    });

    it("defaults log level to info", async () => {
      const execution = await manager.create({ type: "task" });

      const updated = await manager.recordLog(execution.id, {
        timestamp: "2026-01-01T00:00:00.000Z",
        message: "queued",
      });

      expect(updated.logs?.[0]).toEqual({
        timestamp: "2026-01-01T00:00:00.000Z",
        level: "info",
        message: "queued",
      });
    });

    it("fails explicitly when the store cannot append logs atomically", async () => {
      const storeWithoutLogAppend = {
        create: vi.fn(),
        findById: vi.fn(),
        findByIdempotencyKey: vi.fn(),
        update: vi.fn(),
        list: vi.fn(),
        delete: vi.fn(),
      } as unknown as ExecutionStore;
      const managerWithoutLogAppend = new ExecutionManagerImpl(storeWithoutLogAppend);

      await expect(
        managerWithoutLogAppend.recordLog("exec-1", {
          message: "cannot be appended safely",
        }),
      ).rejects.toThrow("Execution store does not support atomic execution log append");
    });
  });

  describe("replay", () => {
    it("creates a new pending execution from a failed execution", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

      const execution = await manager.create({
        type: "billing-sync",
        payload: { accountId: "acct-1" },
        maxAttempts: 3,
        timeout: 30_000,
        idempotencyKey: "billing-sync:acct-1",
        metadata: { source: "webhook" },
      });
      await manager.start(execution.id);
      await manager.fail(execution.id, {
        message: "provider unavailable",
        retryable: false,
      });

      const replayed = await manager.replay(execution.id, {
        reason: "operator requested replay",
        metadata: { operator: "ops-user" },
      });

      expect(replayed.id).not.toBe(execution.id);
      expect(replayed.status).toBe("pending");
      expect(replayed.type).toBe("billing-sync");
      expect(replayed.payload).toEqual({ accountId: "acct-1" });
      expect(replayed.maxAttempts).toBe(3);
      expect(replayed.timeout).toBe(30_000);
      expect(replayed.idempotencyKey).toBeUndefined();
      expect(replayed.replayOf).toBe(execution.id);
      expect(replayed.metadata).toEqual({
        source: "webhook",
        operator: "ops-user",
        replayOf: execution.id,
        replayedAt: "2026-01-01T00:00:00.000Z",
        replayReason: "operator requested replay",
      });
      expect(replayed.logs).toEqual([
        {
          timestamp: "2026-01-01T00:00:00.000Z",
          level: "info",
          message: "Execution replay created",
          data: {
            sourceExecutionId: execution.id,
            reason: "operator requested replay",
          },
        },
      ]);
      await expect(manager.list({ replayOf: execution.id })).resolves.toEqual([replayed]);
    });

    it("allows payload override when replaying a failed execution", async () => {
      const execution = await manager.create({
        type: "workflow",
        payload: { attempt: "original" },
      });
      await manager.start(execution.id);
      await manager.fail(execution.id, { message: "error", retryable: false });

      const replayed = await manager.replay(execution.id, {
        payload: { attempt: "manual-replay" },
      });

      expect(replayed.payload).toEqual({ attempt: "manual-replay" });
    });

    it("allows replaying timed-out executions", async () => {
      const execution = await manager.create({ type: "scheduled-job" });
      await manager.start(execution.id);
      await manager.timeout(execution.id);

      const replayed = await manager.replay(execution.id);

      expect(replayed.replayOf).toBe(execution.id);
      expect(replayed.status).toBe("pending");
    });

    it("rejects replay for completed executions", async () => {
      const execution = await manager.create({ type: "task" });
      await manager.start(execution.id);
      await manager.complete(execution.id);

      await expect(manager.replay(execution.id)).rejects.toThrow(
        "Cannot replay execution in 'completed' status",
      );
    });
  });

  describe("jobs operations", () => {
    it("summarizes healthy jobs and jobs needing operator attention", async () => {
      const completed = await manager.create({ type: "workflow" });
      await manager.start(completed.id);
      await manager.complete(completed.id);

      const retrying = await manager.create({
        type: "workflow",
        maxAttempts: 3,
      });
      await manager.start(retrying.id);
      await manager.fail(retrying.id, {
        message: "provider timeout",
        retryable: true,
      });

      const retryExhausted = await manager.create({
        type: "billing-sync",
        maxAttempts: 1,
      });
      await manager.start(retryExhausted.id);
      await manager.fail(retryExhausted.id, {
        message: "provider still unavailable",
        retryable: true,
      });

      const deadLettered = await manager.create({ type: "onboarding-email" });
      await manager.start(deadLettered.id);
      await manager.fail(deadLettered.id, {
        message: "invalid recipient",
        retryable: false,
      });

      const timedOut = await manager.create({
        type: "usage-rollup",
        maxAttempts: 2,
      });
      await manager.start(timedOut.id);
      await manager.timeout(timedOut.id);

      const jobs = createExecutionJobsOperations(manager);
      const report = await jobs.list({ limit: 10 });

      expect(report.summary).toBe("attention");
      expect(report.total).toBe(5);
      expect(report.attentionCount).toBe(4);
      expect(report.jobs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: completed.id,
            failurePolicy: expect.objectContaining({
              state: "succeeded",
              needsAttention: false,
              recoveryAction: "none",
            }),
          }),
          expect.objectContaining({
            id: retrying.id,
            status: "retrying",
            failurePolicy: expect.objectContaining({
              state: "retrying",
              needsAttention: true,
              retryable: true,
              replayable: false,
              recoveryAction: "wait",
            }),
          }),
          expect.objectContaining({
            id: retryExhausted.id,
            status: "failed",
            errorMessage: "provider still unavailable",
            failurePolicy: expect.objectContaining({
              state: "retry_exhausted",
              needsAttention: true,
              retryable: false,
              replayable: true,
              recoveryAction: "replay",
            }),
          }),
          expect.objectContaining({
            id: deadLettered.id,
            status: "failed",
            failurePolicy: expect.objectContaining({
              state: "dead_lettered",
              needsAttention: true,
              replayable: true,
              reason: "Job failed with a non-retryable error",
            }),
          }),
          expect.objectContaining({
            id: timedOut.id,
            status: "timed_out",
            failurePolicy: expect.objectContaining({
              state: "timed_out",
              needsAttention: true,
              retryable: true,
              replayable: true,
              recoveryAction: "retry",
            }),
          }),
        ]),
      );
    });

    it("shows job details and logs without exposing payloads in summaries", async () => {
      const execution = await manager.create({
        type: "workflow",
        payload: { tenantId: "tenant_secret" },
        metadata: { workflowName: "billing.sync" },
      });
      await manager.start(execution.id);
      await manager.recordLog(execution.id, {
        timestamp: "2026-01-01T00:00:00.000Z",
        message: "Billing sync started",
      });

      const jobs = createExecutionJobsOperations(manager);
      const report = await jobs.list();
      const details = await jobs.show(execution.id);
      const logs = await jobs.logs(execution.id);

      expect(report.jobs[0]).toEqual(
        expect.objectContaining({
          id: execution.id,
          workflowName: "billing.sync",
          logCount: 1,
        }),
      );
      expect(JSON.stringify(report.jobs[0])).not.toContain("tenant_secret");
      expect(details.payload).toEqual({ tenantId: "tenant_secret" });
      expect(logs).toEqual([
        {
          timestamp: "2026-01-01T00:00:00.000Z",
          level: "info",
          message: "Billing sync started",
        },
      ]);
    });

    it("does not expose stale terminal fields after retry restart", async () => {
      const manualRetry = await manager.create({
        type: "workflow",
        maxAttempts: 3,
      });
      await manager.start(manualRetry.id);
      await manager.fail(manualRetry.id, {
        message: "manual failure",
        retryable: false,
      });
      await manager.retry(manualRetry.id);
      await manager.start(manualRetry.id);

      const automaticRetry = await manager.create({
        type: "workflow",
        maxAttempts: 3,
      });
      await manager.start(automaticRetry.id);
      await manager.fail(automaticRetry.id, {
        message: "automatic failure",
        retryable: true,
      });
      await manager.start(automaticRetry.id);

      const jobs = createExecutionJobsOperations(manager);

      await expect(jobs.show(manualRetry.id)).resolves.toEqual(
        expect.objectContaining({
          status: "running",
          completedAt: undefined,
          errorMessage: undefined,
        }),
      );
      await expect(jobs.show(automaticRetry.id)).resolves.toEqual(
        expect.objectContaining({
          status: "running",
          completedAt: undefined,
          errorMessage: undefined,
        }),
      );
    });

    it("cancels and replays jobs through the public operations contract", async () => {
      const running = await manager.create({ type: "workflow" });
      await manager.start(running.id);

      const failed = await manager.create({
        type: "workflow",
        payload: { run: "original" },
      });
      await manager.start(failed.id);
      await manager.fail(failed.id, {
        message: "downstream failure",
        retryable: false,
      });

      const jobs = createExecutionJobsOperations(manager);
      const cancelled = await jobs.cancel(running.id, {
        reason: "operator stop",
      });
      const replayed = await jobs.replay(failed.id, {
        reason: "provider restored",
      });

      expect(cancelled.status).toBe("cancelled");
      expect(cancelled.metadata).toEqual({
        cancellationReason: "operator stop",
      });
      expect(replayed.status).toBe("pending");
      expect(replayed.replayOf).toBe(failed.id);
      expect(replayed.failurePolicy).toEqual(
        expect.objectContaining({
          state: "pending",
          needsAttention: false,
        }),
      );
    });

    it("fails visibly when inspection or replay support is unavailable", async () => {
      const lifecycleOnlyManager = {
        get: vi.fn(),
        create: vi.fn(),
        start: vi.fn(),
        complete: vi.fn(),
        fail: vi.fn(),
        cancel: vi.fn(),
        retry: vi.fn(),
        updateProgress: vi.fn(),
        checkpoint: vi.fn(),
        timeout: vi.fn(),
        reconcileTimedOut: vi.fn(),
      };
      const inspectOnlyManager = {
        ...lifecycleOnlyManager,
        get: vi.fn(),
        list: vi.fn().mockResolvedValue([]),
      };

      await expect(createExecutionJobsOperations(lifecycleOnlyManager).list()).rejects.toThrow(
        "Execution manager does not support job inspection",
      );
      await expect(
        createExecutionJobsOperations(inspectOnlyManager).replay("exec-1"),
      ).rejects.toThrow("Execution manager does not support job replay");
    });
  });

  describe("error handling", () => {
    it("throws not found for non-existent execution", async () => {
      await expect(manager.start("non-existent")).rejects.toThrow(
        "Execution with id 'non-existent' not found",
      );
    });
  });

  describe("state transitions", () => {
    it("prevents completed to running", async () => {
      const execution = await manager.create({ type: "task" });
      await manager.start(execution.id);
      await manager.complete(execution.id);

      await expect(manager.start(execution.id)).rejects.toThrow(
        "Cannot transition from 'completed' to 'running'",
      );
    });

    it("prevents cancelled to running", async () => {
      const execution = await manager.create({ type: "task" });
      await manager.cancel(execution.id);

      await expect(manager.start(execution.id)).rejects.toThrow(
        "Cannot transition from 'cancelled' to 'running'",
      );
    });

    it("prevents failed (terminal) to running directly", async () => {
      const execution = await manager.create({ type: "task", maxAttempts: 1 });
      await manager.start(execution.id);
      await manager.fail(execution.id, { message: "error", retryable: false });

      await expect(manager.start(execution.id)).rejects.toThrow(
        "Cannot transition from 'failed' to 'running'",
      );
    });

    it("allows full lifecycle: pending → running → completed", async () => {
      const execution = await manager.create({ type: "task" });

      const started = await manager.start(execution.id);
      expect(started.status).toBe("running");

      const completed = await manager.complete(execution.id);
      expect(completed.status).toBe("completed");
    });

    it("allows retry lifecycle: pending → running → failed → retrying → running", async () => {
      const execution = await manager.create({ type: "task", maxAttempts: 3 });

      await manager.start(execution.id);
      await manager.fail(execution.id, { message: "error", retryable: false });
      const retrying = await manager.retry(execution.id);
      expect(retrying.status).toBe("retrying");

      const running = await manager.start(execution.id);
      expect(running.status).toBe("running");
    });

    it("allows timeout lifecycle: running → timed_out → retrying → running", async () => {
      const execution = await manager.create({ type: "task", maxAttempts: 3 });

      await manager.start(execution.id);
      await manager.timeout(execution.id);
      const retrying = await manager.retry(execution.id);
      expect(retrying.status).toBe("retrying");

      const running = await manager.start(execution.id);
      expect(running.status).toBe("running");
    });
  });

  describe("edge cases", () => {
    it("allows retry when attempts less than maxAttempts", async () => {
      const execution = await manager.create({ type: "task", maxAttempts: 3 });
      await manager.start(execution.id);
      await manager.fail(execution.id, { message: "error", retryable: false });

      const retrying = await manager.retry(execution.id);
      expect(retrying.status).toBe("retrying");
    });

    it("throws on retry when attempts equal maxAttempts", async () => {
      const execution = await manager.create({ type: "task", maxAttempts: 1 });
      await manager.start(execution.id);
      await manager.fail(execution.id, { message: "error", retryable: false });

      await expect(manager.retry(execution.id)).rejects.toThrow("Maximum retry attempts exceeded");
    });

    it("preserves metadata when canceling without reason", async () => {
      const execution = await manager.create({
        type: "task",
        metadata: { key: "value" },
      });

      const cancelled = await manager.cancel(execution.id);

      expect(cancelled.metadata).toEqual({ key: "value" });
    });

    it("preserves existing metadata when canceling with reason", async () => {
      const execution = await manager.create({
        type: "task",
        metadata: { existingKey: "existingValue" },
      });

      const cancelled = await manager.cancel(execution.id, "cancel reason");

      expect(cancelled.metadata).toEqual({
        existingKey: "existingValue",
        cancellationReason: "cancel reason",
      });
    });

    it("handles progress update for execution with existing progress", async () => {
      const execution = await manager.create({ type: "batch" });
      await manager.updateProgress(execution.id, { current: 10, total: 100 });

      const updated = await manager.updateProgress(execution.id, {
        current: 50,
        total: 100,
      });

      expect(updated.progress?.current).toBe(50);
      expect(updated.progress?.percent).toBe(50);
    });

    it("handles checkpoint merge with existing checkpoints", async () => {
      const execution = await manager.create({ type: "batch" });
      await manager.checkpoint(execution.id, "existing", "checkpoint1");

      const updated = await manager.checkpoint(execution.id, "new", "checkpoint2");

      expect(updated.checkpoints).toEqual({
        existing: "checkpoint1",
        new: "checkpoint2",
      });
    });

    it("handles checkpoint for execution without existing checkpoints", async () => {
      const execution = await manager.create({ type: "batch" });

      const updated = await manager.checkpoint(execution.id, "first", "value");

      expect(updated.checkpoints).toEqual({ first: "value" });
    });

    it("clears error when retrying from failed state", async () => {
      const execution = await manager.create({ type: "task", maxAttempts: 3 });
      await manager.start(execution.id);

      const error: ExecutionError = {
        message: "temp error",
        retryable: false,
        code: "TEMP_ERROR",
      };
      await manager.fail(execution.id, error);

      const retrying = await manager.retry(execution.id);

      expect(retrying.error).toBeUndefined();
    });
  });
});
