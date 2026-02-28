import type { ItemReader } from '@croco/batch-core';
import { Step } from '@croco/batch-core';
import type { ExecutionManager } from '@croco/execution-core';
import type { Client } from '@upstash/qstash';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QStashChunkExecutor } from '../libs/QStashChunkExecutor';

describe('QStashChunkExecutor', () => {
  let startMock!: ReturnType<typeof vi.fn>;
  let executionManager!: ExecutionManager;
  let qstashClient!: {
    publishJSON: ReturnType<typeof vi.fn>;
  };
  let executor!: QStashChunkExecutor;

  beforeEach(() => {
    startMock = vi.fn().mockResolvedValue({ id: 'exec-1', checkpoints: {} });

    executionManager = {
      start: startMock,
      checkpoint: vi.fn().mockResolvedValue({}),
      complete: vi.fn().mockResolvedValue({}),
      fail: vi.fn().mockResolvedValue({}),
      updateProgress: vi.fn().mockResolvedValue({}),
    } as unknown as ExecutionManager;

    qstashClient = {
      publishJSON: vi.fn().mockResolvedValue({}),
    };

    executor = new QStashChunkExecutor(executionManager, {
      qstashClient: qstashClient as unknown as Client,
      webhookUrl: 'https://example.com/webhook',
    });
  });

  it('should process a single chunk and complete when no more items', async () => {
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
      chunkSize: 10,
    });

    const result = await executor.executeChunk('exec-1', step);

    expect(executionManager.start).toHaveBeenCalledWith('exec-1');
    expect(reader.read).toHaveBeenCalledTimes(3);
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
    expect(executionManager.checkpoint).toHaveBeenCalledWith('exec-1', 'test-step.processedCount', 2);
    expect(qstashClient.publishJSON).toHaveBeenCalledWith({
      url: 'https://example.com/webhook',
      body: {
        executionId: 'exec-1',
        stepName: 'test-step',
      },
      headers: {
        'Idempotency-Key': 'chunk:exec-1:test-step:no-checkpoint',
      },
    });
    expect(executionManager.complete).not.toHaveBeenCalled();
    expect(result).toEqual({ hasMore: true, processedCount: 2 });
  });

  it('should complete with cumulative processedCount from prior checkpoints', async () => {
    startMock.mockResolvedValue({
      id: 'exec-1',
      checkpoints: { 'test-step.processedCount': 10 },
    });

    const reader = {
      read: vi.fn().mockResolvedValueOnce(7).mockResolvedValueOnce(null),
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

    expect(executionManager.complete).toHaveBeenCalledWith('exec-1', { processedCount: 11 });
    expect(result).toEqual({ hasMore: false, processedCount: 1 });
  });

  it('BUG-14 청크 경계 아이템이 유실되지 않음', async () => {
    const sourceItems = [1, 2, 3, 4, 5, 6, 7];
    let cursor = 0;

    const reader = {
      read: vi.fn().mockImplementation(async () => {
        if (cursor >= sourceItems.length) {
          return null;
        }

        const item = sourceItems[cursor];
        cursor += 1;
        return item;
      }),
    };

    const writtenChunks: number[][] = [];
    const writer = {
      write: vi.fn().mockImplementation(async (items: number[]) => {
        writtenChunks.push([...items]);
      }),
    };

    const step = new Step<number, number>({
      name: 'bug-14-step',
      reader,
      writer,
      chunkSize: 3,
    });

    const firstChunk = await executor.executeChunk('exec-1', step);
    const secondChunk = await executor.executeChunk('exec-1', step);
    const thirdChunk = await executor.executeChunk('exec-1', step);

    expect(firstChunk).toEqual({ hasMore: true, processedCount: 3 });
    expect(secondChunk).toEqual({ hasMore: true, processedCount: 3 });
    expect(thirdChunk).toEqual({ hasMore: false, processedCount: 1 });

    expect(writtenChunks).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
    expect(writtenChunks[1]).toContain(4);
  });

  it('BUG-15 서로 다른 청크의 멱등성 키가 고유', async () => {
    const sourceItems = [1, 2, 3, 4, 5, 6, 7];
    let cursor = 0;

    const reader = {
      read: vi.fn().mockImplementation(async () => {
        if (cursor >= sourceItems.length) {
          return null;
        }

        const item = sourceItems[cursor];
        cursor += 1;
        return item;
      }),
      getCheckpoint: vi.fn().mockImplementation(() => ({ cursor })),
      restoreCheckpoint: vi.fn().mockImplementation((checkpoint: unknown) => {
        const checkpointData = checkpoint as { cursor: number };
        cursor = checkpointData.cursor;
      }),
    };

    const writer = {
      write: vi.fn().mockResolvedValue(undefined),
    };

    const step = new Step<number, number>({
      name: 'bug-15-step',
      reader: reader as unknown as ItemReader<number>,
      writer,
      chunkSize: 3,
    });

    await executor.executeChunk('exec-1', step);
    await executor.executeChunk('exec-1', step);

    expect(qstashClient.publishJSON).toHaveBeenCalledTimes(2);
    const [firstPublish, secondPublish] = qstashClient.publishJSON.mock.calls;
    const firstIdempotencyKey = firstPublish[0].headers['Idempotency-Key'];
    const secondIdempotencyKey = secondPublish[0].headers['Idempotency-Key'];

    expect(firstIdempotencyKey).not.toBe(secondIdempotencyKey);
  });

  it('should restore checkpoint from execution', async () => {
    const reader = {
      read: vi.fn().mockResolvedValueOnce(5).mockResolvedValueOnce(null),
      getCheckpoint: vi.fn().mockReturnValue({ offset: 10 }),
      restoreCheckpoint: vi.fn(),
    };

    startMock.mockResolvedValue({
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
