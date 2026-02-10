import { Step } from '@croco/batch-core';
import type { ItemReader } from '@croco/batch-core/libs/interfaces/ItemReader';
import type { ExecutionManager } from '@croco/execution-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QStashChunkExecutor } from '../libs/QStashChunkExecutor';

describe('QStashChunkExecutor', () => {
  let executionManager: ExecutionManager;
  let qstashClient: any;
  let executor: QStashChunkExecutor;

  beforeEach(() => {
    executionManager = {
      start: vi.fn().mockResolvedValue({ id: 'exec-1', checkpoints: {} }),
      checkpoint: vi.fn().mockResolvedValue({}),
      complete: vi.fn().mockResolvedValue({}),
      fail: vi.fn().mockResolvedValue({}),
      updateProgress: vi.fn().mockResolvedValue({}),
    } as unknown as ExecutionManager;

    qstashClient = {
      publishJSON: vi.fn().mockResolvedValue({}),
    };

    executor = new QStashChunkExecutor(executionManager, {
      qstashClient,
      webhookUrl: 'https://example.com/webhook',
    });
  });

  it('should process a single chunk and complete when no more items', async () => {
    const reader = {
      read: vi
        .fn()
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null),
    };
    const writer = {
      write: vi.fn().mockResolvedValue(undefined),
    };

    const step = new Step<number, number>({
      name: 'test-step',
      reader,
      writer,
      chunkSize: 10,
    });

    const result = await executor.executeChunk('exec-1', step);

    expect(executionManager.start).toHaveBeenCalledWith('exec-1');
    expect(reader.read).toHaveBeenCalledTimes(4);
    expect(writer.write).toHaveBeenCalledWith([1, 2]);
    expect(executionManager.complete).toHaveBeenCalledWith('exec-1', { processedCount: 2 });
    expect(qstashClient.publishJSON).not.toHaveBeenCalled();
    expect(result).toEqual({ hasMore: false, processedCount: 2 });
  });

  it('should trigger next chunk via QStash when more items exist', async () => {
    const reader = {
      read: vi
        .fn()
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(null),
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

    const result = await executor.executeChunk('exec-1', step);

    expect(writer.write).toHaveBeenCalledWith([1, 2]);
    expect(qstashClient.publishJSON).toHaveBeenCalledWith({
      url: 'https://example.com/webhook',
      body: {
        executionId: 'exec-1',
        stepName: 'test-step',
      },
      headers: {
        'Idempotency-Key': 'chunk:exec-1:test-step.cursor',
      },
    });
    expect(executionManager.complete).not.toHaveBeenCalled();
    expect(result).toEqual({ hasMore: true, processedCount: 2 });
  });

  it('should restore checkpoint from execution', async () => {
    const reader = {
      read: vi.fn().mockResolvedValueOnce(5).mockResolvedValueOnce(null),
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
      chunkSize: 10,
    });

    await executor.executeChunk('exec-1', step);

    expect(reader.restoreCheckpoint).toHaveBeenCalledWith({ offset: 5 });
    expect(executionManager.checkpoint).toHaveBeenCalledWith('exec-1', 'test-step.cursor', { offset: 10 });
  });

  it('should handle errors and fail execution', async () => {
    const error = new Error('Write failed');
    const reader = {
      read: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(null),
    };
    const writer = {
      write: vi.fn().mockRejectedValue(error),
    };

    const step = new Step<number, number>({
      name: 'fail-step',
      reader,
      writer,
      chunkSize: 10,
    });

    await expect(executor.executeChunk('exec-1', step)).rejects.toThrow('Write failed');
    expect(executionManager.fail).toHaveBeenCalledWith(
      'exec-1',
      expect.objectContaining({
        message: 'Write failed',
        retryable: true,
      })
    );
  });

  it('should use processor when provided', async () => {
    const reader = {
      read: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2).mockResolvedValueOnce(null),
    };
    const processor = {
      process: vi.fn().mockImplementation((x: number) => x * 2),
    };
    const writer = {
      write: vi.fn().mockResolvedValue(undefined),
    };

    const step = new Step<number, number>({
      name: 'process-step',
      reader,
      processor,
      writer,
      chunkSize: 10,
    });

    await executor.executeChunk('exec-1', step);

    expect(processor.process).toHaveBeenCalledWith(1);
    expect(processor.process).toHaveBeenCalledWith(2);
    expect(writer.write).toHaveBeenCalledWith([2, 4]);
  });

  it('should filter out null items from processor', async () => {
    const reader = {
      read: vi
        .fn()
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(null),
    };
    const processor = {
      process: vi.fn().mockImplementation((x: number) => (x % 2 === 0 ? x : null)),
    };
    const writer = {
      write: vi.fn().mockResolvedValue(undefined),
    };

    const step = new Step<number, number>({
      name: 'filter-step',
      reader,
      processor,
      writer,
      chunkSize: 10,
    });

    await executor.executeChunk('exec-1', step);

    expect(writer.write).toHaveBeenCalledWith([2]);
  });
});
