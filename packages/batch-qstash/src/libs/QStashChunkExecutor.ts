import type { Checkpointable, Step } from '@croco/batch-core';
import type { ExecutionManager } from '@croco/execution-core';
import type { Client } from '@upstash/qstash';

function isCheckpointable(obj: unknown): obj is Checkpointable {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'getCheckpoint' in obj &&
    typeof (obj as Checkpointable).getCheckpoint === 'function' &&
    'restoreCheckpoint' in obj &&
    typeof (obj as Checkpointable).restoreCheckpoint === 'function'
  );
}

function isPeekable<I>(obj: unknown): obj is { peek(): Promise<I | null> } {
  return typeof obj === 'object' && obj !== null && 'peek' in obj && typeof obj.peek === 'function';
}

export interface QStashExecutorOptions {
  qstashClient: Client;
  webhookUrl: string;
}

export class QStashChunkExecutor {
  constructor(
    private executionManager: ExecutionManager,
    private options: QStashExecutorOptions
  ) {}

  async executeChunk<I, O>(
    executionId: string,
    step: Step<I, O>
  ): Promise<{ hasMore: boolean; processedCount: number }> {
    const execution = await this.executionManager.start(executionId);

    const checkpointKey = `${step.name}.cursor`;
    if (execution.checkpoints?.[checkpointKey]) {
      if (isCheckpointable(step.reader)) {
        step.reader.restoreCheckpoint(execution.checkpoints[checkpointKey]);
      }
    }

    const items: O[] = [];
    let hasMore = false;
    let readCount = 0;
    let checkpointAfterChunk: unknown;

    try {
      for (let i = 0; i < step.chunkSize; i++) {
        const item = await step.reader.read();

        if (item === null) {
          break;
        }

        readCount += 1;

        let processedItem: O | null = null;
        if (step.processor) {
          processedItem = await step.processor.process(item);
        } else {
          processedItem = item as unknown as O;
        }

        if (processedItem !== null) {
          items.push(processedItem);
        }
      }

      if (items.length > 0) {
        await step.writer.write(items);
      }

      if (isCheckpointable(step.reader)) {
        checkpointAfterChunk = step.reader.getCheckpoint();
        await this.executionManager.checkpoint(executionId, checkpointKey, checkpointAfterChunk);
      }

      hasMore = await this.hasMoreItems(step, readCount, checkpointAfterChunk);

      if (hasMore) {
        await this.triggerNextChunk(executionId, step.name, checkpointAfterChunk);
      } else {
        await this.executionManager.complete(executionId, {
          processedCount: items.length,
        });
      }

      return { hasMore, processedCount: items.length };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      await this.executionManager.fail(executionId, {
        message: err.message,
        stack: err.stack,
        retryable: true,
      });
      throw error;
    }
  }

  private async hasMoreItems<I, O>(
    step: Step<I, O>,
    readCount: number,
    checkpointAfterChunk: unknown
  ): Promise<boolean> {
    if (readCount < step.chunkSize) {
      return false;
    }

    // 청크 경계에서 read-ahead로 아이템이 유실되지 않도록 보장한다.
    // 1) peek 지원: 비소모 조회
    // 2) checkpointable: 1개 read 후 즉시 restore
    // 3) 그 외: 보수적으로 hasMore=true 처리 (빈 청크 1회 추가 가능)
    if (isPeekable<I>(step.reader)) {
      const nextItem = await step.reader.peek();
      return nextItem !== null;
    }

    if (isCheckpointable(step.reader)) {
      const nextItem = await step.reader.read();
      step.reader.restoreCheckpoint(checkpointAfterChunk);
      return nextItem !== null;
    }

    return true;
  }

  private extractCursorValue(checkpoint: unknown): string {
    if (checkpoint === null || checkpoint === undefined) {
      return 'no-checkpoint';
    }

    if (typeof checkpoint !== 'object') {
      return String(checkpoint);
    }

    const checkpointRecord = checkpoint as Record<string, unknown>;
    const cursorValue =
      checkpointRecord.cursor ?? checkpointRecord.offset ?? checkpointRecord.index ?? checkpointRecord.position;

    if (cursorValue !== undefined) {
      return String(cursorValue);
    }

    return JSON.stringify(checkpoint);
  }

  private buildIdempotencyKey(executionId: string, stepName: string, checkpoint: unknown): string {
    const cursorValue = this.extractCursorValue(checkpoint);
    return `chunk:${executionId}:${stepName}:${cursorValue}`;
  }

  private async triggerNextChunk(executionId: string, stepName: string, checkpoint: unknown): Promise<void> {
    const idempotencyKey = this.buildIdempotencyKey(executionId, stepName, checkpoint);

    await this.options.qstashClient.publishJSON({
      url: this.options.webhookUrl,
      body: {
        executionId,
        stepName,
      },
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
    });
  }
}
