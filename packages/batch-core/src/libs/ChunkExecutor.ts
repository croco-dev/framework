import type { ExecutionManager } from '@croco/execution-core';
import type { Checkpointable } from './interfaces/ItemReader';
import type { Step } from './Step';

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

export class ChunkExecutor {
  constructor(private executionManager: ExecutionManager) {}

  async execute<I, O>(executionId: string, step: Step<I, O>): Promise<void> {
    // 1. Start execution (or get current state if already running?)
    // Usually we start it. If it fails, the caller handles it.
    const execution = await this.executionManager.start(executionId);

    // 2. Restore checkpoint if available
    const checkpointKey = `${step.name}.cursor`;
    if (execution.checkpoints?.[checkpointKey]) {
      if (isCheckpointable(step.reader)) {
        step.reader.restoreCheckpoint(execution.checkpoints[checkpointKey]);
      }
    }

    let items: O[] = [];
    let processedCount = 0;

    // 3. Read - Process - Write loop
    try {
      while (true) {
        // Read
        const item = await step.reader.read();

        if (item === null) {
          break; // End of data
        }

        // Process
        let processedItem: O | null = null;
        if (step.processor) {
          processedItem = await step.processor.process(item);
        } else {
          // If no processor, assume I is O (unsafe cast but common in batch frameworks if generic constraints allow)
          // Since Step<I, O> is strictly typed, if processor is missing, I must be assignable to O.
          // In TypeScript, we can't easily enforce this without overloads.
          // For now, we assume if processor is missing, I extends O.
          processedItem = item as unknown as O;
        }

        if (processedItem !== null) {
          items.push(processedItem);
        }

        // Write if chunk full
        if (items.length >= step.chunkSize) {
          await this.writeChunk(executionId, step, items, checkpointKey);
          processedCount += items.length;
          items = [];
        }
      }

      // Write remaining items
      if (items.length > 0) {
        await this.writeChunk(executionId, step, items, checkpointKey);
        processedCount += items.length;
      }

      // 4. Complete execution
      // Note: If this is part of a multi-step job, we shouldn't complete here.
      // But assuming ChunkExecutor runs a single-step task for now.
      await this.executionManager.complete(executionId, { processedCount });
    } catch (error) {
      // Fail execution
      const err = error instanceof Error ? error : new Error(String(error));
      await this.executionManager.fail(executionId, {
        message: err.message,
        stack: err.stack,
        retryable: true, // Configurable?
      });
      throw error; // Re-throw to let caller know
    }
  }

  private async writeChunk<I, O>(
    executionId: string,
    step: Step<I, O>,
    items: O[],
    checkpointKey: string
  ): Promise<void> {
    await step.writer.write(items);

    // Save checkpoint
    if (isCheckpointable(step.reader)) {
      const checkpoint = step.reader.getCheckpoint();
      await this.executionManager.checkpoint(executionId, checkpointKey, checkpoint);
    }

    // Update progress (simplified)
    // We don't know total count unless reader provides it.
    // Assuming simple counter update for now.
    // ExecutionManager.updateProgress requires ProgressInfo object.
    // We need to know 'current' and 'total'.
    // If we don't know total, we can just update 'current'.
    // But ProgressInfo interface has 'total'. Let's check if it's optional.
    // "total: number" is required in interface.
    // If we don't know total, maybe we can fetch it from current progress or assume 0/unknown?
    // Let's assume reader knows? Or just pass 0 for now if unknown.
    // Better: check if execution.progress exists and update it.

    // For now, skipping updateProgress to avoid complexity with unknown total.
    // Or we could read existing progress first... but we don't have get(id).
    // We can rely on user to initialize progress in 'create'.
  }
}
