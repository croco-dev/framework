import type { ExecutionManager } from '@croco/execution-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChunkExecutor } from '../libs/ChunkExecutor';
import type { ItemReader } from '../libs/interfaces/ItemReader';
import { Step } from '../libs/Step';

describe('ChunkExecutor', () => {
  let executionManager!: ExecutionManager;
  let executor!: ChunkExecutor;

  beforeEach(() => {
    executionManager = {
      start: vi.fn().mockResolvedValue({ id: 'exec-1', checkpoints: {} }),
      checkpoint: vi.fn().mockResolvedValue({}),
      complete: vi.fn().mockResolvedValue({}),
      fail: vi.fn().mockResolvedValue({}),
      updateProgress: vi.fn().mockResolvedValue({}),
    } as unknown as ExecutionManager;

    executor = new ChunkExecutor(executionManager);
  });

  it('should execute a simple step', async () => {
    const reader = {
      read: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2).mockResolvedValueOnce(null),
    };
    const writer = {
      write: vi.fn().mockResolvedValue(undefined),
    };

    const step = new Step<number, number>({
      name: 'test-step',
      reader,
      writer,
      chunkSize: 2,
    });

    await executor.execute('exec-1', step);

    expect(executionManager.start).toHaveBeenCalledWith('exec-1');
    expect(reader.read).toHaveBeenCalledTimes(3);
    expect(writer.write).toHaveBeenCalledWith([1, 2]);
    expect(executionManager.complete).toHaveBeenCalledWith('exec-1', { processedCount: 2 });
  });

  it('should support checkpointing', async () => {
    const reader = {
      read: vi.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(null),
      getCheckpoint: vi.fn().mockReturnValue({ offset: 10 }),
      restoreCheckpoint: vi.fn(),
    };

    (executionManager.start as any).mockResolvedValue({
      id: 'exec-1',
      checkpoints: { 'test-step.cursor': { offset: 5 } },
    });

    const writer = {
      write: vi.fn().mockResolvedValue(undefined),
    };

    const step = new Step<number, number>({
      name: 'test-step',
      reader: reader as unknown as ItemReader<number>,
      writer,
      chunkSize: 1,
    });

    await executor.execute('exec-1', step);

    expect(reader.restoreCheckpoint).toHaveBeenCalledWith({ offset: 5 });
    expect(reader.read).toHaveBeenCalledTimes(2);
    expect(writer.write).toHaveBeenCalledWith([3]);
    expect(executionManager.checkpoint).toHaveBeenCalledWith('exec-1', 'test-step.cursor', { offset: 10 });
  });

  it('should handle errors', async () => {
    const error = new Error('Read failed');
    const reader = {
      read: vi.fn().mockRejectedValue(error),
    };
    const writer = { write: vi.fn() };

    const step = new Step<number, number>({
      name: 'fail-step',
      reader: reader as unknown as ItemReader<number>,
      writer,
    });

    await expect(executor.execute('exec-1', step)).rejects.toThrow('Read failed');
    expect(executionManager.fail).toHaveBeenCalledWith(
      'exec-1',
      expect.objectContaining({
        message: 'Read failed',
      })
    );
  });
});
