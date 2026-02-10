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

    try {
      for (let i = 0; i < step.chunkSize; i++) {
        const item = await step.reader.read();

        if (item === null) {
          break;
        }

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
        const checkpoint = step.reader.getCheckpoint();
        await this.executionManager.checkpoint(executionId, checkpointKey, checkpoint);
      }

      const nextItem = await step.reader.read();
      hasMore = nextItem !== null;

      if (hasMore) {
        await this.triggerNextChunk(executionId, step.name);
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

  private async triggerNextChunk(executionId: string, stepName: string): Promise<void> {
    const checkpointKey = `${stepName}.cursor`;
    const idempotencyKey = `chunk:${executionId}:${checkpointKey}`;

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
