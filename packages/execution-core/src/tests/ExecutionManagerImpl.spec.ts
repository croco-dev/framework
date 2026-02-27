import { beforeEach, describe, expect, it } from 'vitest';
import type { CreateExecutionParams, Execution, ExecutionError, ExecutionStore } from '../index';
import { ExecutionManagerImpl } from '../index';

class MockExecutionStore implements ExecutionStore {
  private executions: Map<string, Execution> = new Map();
  private idCounter = 0;

  async create(params: CreateExecutionParams): Promise<Execution> {
    const id = `exec-${++this.idCounter}`;
    const now = new Date();

    const execution: Execution = {
      id,
      type: params.type,
      status: 'pending',
      payload: params.payload,
      maxAttempts: params.maxAttempts ?? 1,
      timeout: params.timeout,
      scheduledFor: params.scheduledFor,
      idempotencyKey: params.idempotencyKey,
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

  async list(): Promise<Execution[]> {
    return Array.from(this.executions.values());
  }

  async delete(id: string): Promise<void> {
    this.executions.delete(id);
  }
}

describe('ExecutionManagerImpl', () => {
  let store!: MockExecutionStore;
  let manager!: ExecutionManagerImpl;

  beforeEach(() => {
    store = new MockExecutionStore();
    manager = new ExecutionManagerImpl(store);
  });

  describe('create', () => {
    it('creates execution with pending status', async () => {
      const execution = await manager.create({ type: 'task' });

      expect(execution.status).toBe('pending');
      expect(execution.type).toBe('task');
      expect(execution.maxAttempts).toBe(1);
      expect(execution.attempts).toBe(0);
    });

    it('respects maxAttempts parameter', async () => {
      const execution = await manager.create({ type: 'task', maxAttempts: 5 });

      expect(execution.maxAttempts).toBe(5);
    });

    it('returns existing execution for same idempotencyKey', async () => {
      const first = await manager.create({ type: 'task', idempotencyKey: 'key-1' });
      const second = await manager.create({ type: 'task', idempotencyKey: 'key-1' });

      expect(first.id).toBe(second.id);
    });

    it('creates new execution for different idempotencyKey', async () => {
      const first = await manager.create({ type: 'task', idempotencyKey: 'key-1' });
      const second = await manager.create({ type: 'task', idempotencyKey: 'key-2' });

      expect(first.id).not.toBe(second.id);
    });
  });

  describe('start', () => {
    it('transitions pending to running', async () => {
      const execution = await manager.create({ type: 'task' });
      const started = await manager.start(execution.id);

      expect(started.status).toBe('running');
      expect(started.attempts).toBe(1);
      expect(started.startedAt).toBeDefined();
    });

    it('transitions retrying to running without incrementing attempts', async () => {
      const execution = await manager.create({ type: 'task', maxAttempts: 3 });
      await manager.start(execution.id);
      await manager.fail(execution.id, { message: 'error', retryable: true });

      const restarted = await manager.start(execution.id);

      expect(restarted.status).toBe('running');
      expect(restarted.attempts).toBe(2);
    });

    it('throws for completed execution', async () => {
      const execution = await manager.create({ type: 'task' });
      await manager.start(execution.id);
      await manager.complete(execution.id);

      await expect(manager.start(execution.id)).rejects.toThrow("Cannot transition from 'completed' to 'running'");
    });
  });

  describe('complete', () => {
    it('transitions running to completed with result', async () => {
      const execution = await manager.create({ type: 'task' });
      await manager.start(execution.id);

      const completed = await manager.complete(execution.id, { data: 'success' });

      expect(completed.status).toBe('completed');
      expect(completed.result).toEqual({ data: 'success' });
      expect(completed.completedAt).toBeDefined();
    });

    it('throws for pending execution', async () => {
      const execution = await manager.create({ type: 'task' });

      await expect(manager.complete(execution.id)).rejects.toThrow("Cannot transition from 'pending' to 'completed'");
    });
  });

  describe('fail', () => {
    it('transitions running to failed when not retryable', async () => {
      const execution = await manager.create({ type: 'task' });
      await manager.start(execution.id);

      const error: ExecutionError = { message: 'fatal error', retryable: false };
      const failed = await manager.fail(execution.id, error);

      expect(failed.status).toBe('failed');
      expect(failed.error).toEqual(error);
      expect(failed.completedAt).toBeDefined();
    });

    it('transitions running to retrying when retryable and attempts remain', async () => {
      const execution = await manager.create({ type: 'task', maxAttempts: 3 });
      await manager.start(execution.id);

      const error: ExecutionError = { message: 'transient error', retryable: true };
      const failed = await manager.fail(execution.id, error);

      expect(failed.status).toBe('retrying');
      expect(failed.error).toEqual(error);
    });

    it('transitions running to failed when max attempts exhausted', async () => {
      const execution = await manager.create({ type: 'task', maxAttempts: 1 });
      await manager.start(execution.id);

      const error: ExecutionError = { message: 'error', retryable: true };
      const failed = await manager.fail(execution.id, error);

      expect(failed.status).toBe('failed');
    });
  });

  describe('cancel', () => {
    it('transitions pending to cancelled', async () => {
      const execution = await manager.create({ type: 'task' });

      const cancelled = await manager.cancel(execution.id, 'user request');

      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.completedAt).toBeDefined();
      expect(cancelled.metadata?.cancellationReason).toBe('user request');
    });

    it('transitions running to cancelled', async () => {
      const execution = await manager.create({ type: 'task' });
      await manager.start(execution.id);

      const cancelled = await manager.cancel(execution.id);

      expect(cancelled.status).toBe('cancelled');
    });

    it('throws for completed execution', async () => {
      const execution = await manager.create({ type: 'task' });
      await manager.start(execution.id);
      await manager.complete(execution.id);

      await expect(manager.cancel(execution.id)).rejects.toThrow("Cannot transition from 'completed' to 'cancelled'");
    });
  });

  describe('retry', () => {
    it('transitions failed to retrying and increments attempts', async () => {
      const execution = await manager.create({ type: 'task', maxAttempts: 3 });
      await manager.start(execution.id);
      await manager.fail(execution.id, { message: 'error', retryable: false });

      const retrying = await manager.retry(execution.id);

      expect(retrying.status).toBe('retrying');
      expect(retrying.attempts).toBe(2);
      expect(retrying.error).toBeUndefined();
    });

    it('transitions timed_out to retrying', async () => {
      const execution = await manager.create({ type: 'task', maxAttempts: 3 });
      await manager.start(execution.id);
      await manager.timeout(execution.id);

      const retrying = await manager.retry(execution.id);

      expect(retrying.status).toBe('retrying');
    });

    it('throws when max attempts exceeded', async () => {
      const execution = await manager.create({ type: 'task', maxAttempts: 1 });
      await manager.start(execution.id);
      await manager.fail(execution.id, { message: 'error', retryable: false });

      await expect(manager.retry(execution.id)).rejects.toThrow('Maximum retry attempts exceeded');
    });
  });

  describe('updateProgress', () => {
    it('updates progress with auto-calculated percent', async () => {
      const execution = await manager.create({ type: 'batch' });

      const updated = await manager.updateProgress(execution.id, { current: 50, total: 100 });

      expect(updated.progress?.current).toBe(50);
      expect(updated.progress?.total).toBe(100);
      expect(updated.progress?.percent).toBe(50);
    });

    it('preserves provided percent', async () => {
      const execution = await manager.create({ type: 'batch' });

      const updated = await manager.updateProgress(execution.id, {
        current: 50,
        total: 100,
        percent: 75,
      });

      expect(updated.progress?.percent).toBe(75);
    });

    it('handles zero total', async () => {
      const execution = await manager.create({ type: 'batch' });

      const updated = await manager.updateProgress(execution.id, { current: 0, total: 0 });

      expect(updated.progress?.percent).toBe(0);
    });
  });

  describe('checkpoint', () => {
    it('sets checkpoint value', async () => {
      const execution = await manager.create({ type: 'batch' });

      const updated = await manager.checkpoint(execution.id, 'lastIndex', 42);

      expect(updated.checkpoints?.lastIndex).toBe(42);
    });

    it('preserves existing checkpoints', async () => {
      const execution = await manager.create({ type: 'batch' });
      await manager.checkpoint(execution.id, 'first', 'value1');

      const updated = await manager.checkpoint(execution.id, 'second', 'value2');

      expect(updated.checkpoints?.first).toBe('value1');
      expect(updated.checkpoints?.second).toBe('value2');
    });
  });

  describe('timeout', () => {
    it('transitions running to timed_out', async () => {
      const execution = await manager.create({ type: 'task' });
      await manager.start(execution.id);

      const timedOut = await manager.timeout(execution.id);

      expect(timedOut.status).toBe('timed_out');
      expect(timedOut.completedAt).toBeDefined();
      expect(timedOut.error?.message).toBe('Execution timed out');
      expect(timedOut.error?.retryable).toBe(true);
    });

    it('throws for completed execution', async () => {
      const execution = await manager.create({ type: 'task' });
      await manager.start(execution.id);
      await manager.complete(execution.id);

      await expect(manager.timeout(execution.id)).rejects.toThrow("Cannot transition from 'completed' to 'timed_out'");
    });
  });

  describe('error handling', () => {
    it('throws not found for non-existent execution', async () => {
      await expect(manager.start('non-existent')).rejects.toThrow("Execution with id 'non-existent' not found");
    });
  });

  describe('state transitions', () => {
    it('prevents completed to running', async () => {
      const execution = await manager.create({ type: 'task' });
      await manager.start(execution.id);
      await manager.complete(execution.id);

      await expect(manager.start(execution.id)).rejects.toThrow("Cannot transition from 'completed' to 'running'");
    });

    it('prevents cancelled to running', async () => {
      const execution = await manager.create({ type: 'task' });
      await manager.cancel(execution.id);

      await expect(manager.start(execution.id)).rejects.toThrow("Cannot transition from 'cancelled' to 'running'");
    });

    it('prevents failed (terminal) to running directly', async () => {
      const execution = await manager.create({ type: 'task', maxAttempts: 1 });
      await manager.start(execution.id);
      await manager.fail(execution.id, { message: 'error', retryable: false });

      await expect(manager.start(execution.id)).rejects.toThrow("Cannot transition from 'failed' to 'running'");
    });

    it('allows full lifecycle: pending → running → completed', async () => {
      const execution = await manager.create({ type: 'task' });

      const started = await manager.start(execution.id);
      expect(started.status).toBe('running');

      const completed = await manager.complete(execution.id);
      expect(completed.status).toBe('completed');
    });

    it('allows retry lifecycle: pending → running → failed → retrying → running', async () => {
      const execution = await manager.create({ type: 'task', maxAttempts: 3 });

      await manager.start(execution.id);
      await manager.fail(execution.id, { message: 'error', retryable: false });
      const retrying = await manager.retry(execution.id);
      expect(retrying.status).toBe('retrying');

      const running = await manager.start(execution.id);
      expect(running.status).toBe('running');
    });

    it('allows timeout lifecycle: running → timed_out → retrying → running', async () => {
      const execution = await manager.create({ type: 'task', maxAttempts: 3 });

      await manager.start(execution.id);
      await manager.timeout(execution.id);
      const retrying = await manager.retry(execution.id);
      expect(retrying.status).toBe('retrying');

      const running = await manager.start(execution.id);
      expect(running.status).toBe('running');
    });
  });
});
