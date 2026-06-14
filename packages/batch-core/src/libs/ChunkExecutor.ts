import type { ExecutionManager } from "@croco/execution-core";
import type { Checkpointable } from "./interfaces/ItemReader";
import type { Step } from "./Step";
import { createStepExecutionError } from "./StepFailure";

function isCheckpointable(obj: unknown): obj is Checkpointable {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "getCheckpoint" in obj &&
    typeof (obj as Checkpointable).getCheckpoint === "function" &&
    "restoreCheckpoint" in obj &&
    typeof (obj as Checkpointable).restoreCheckpoint === "function"
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
    const totalCount = execution.progress?.total;

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
          await this.writeChunk(
            executionId,
            step,
            items,
            checkpointKey,
            processedCount + items.length,
            totalCount,
          );
          processedCount += items.length;
          items = [];
        }
      }

      // Write remaining items
      if (items.length > 0) {
        await this.writeChunk(
          executionId,
          step,
          items,
          checkpointKey,
          processedCount + items.length,
          totalCount,
        );
        processedCount += items.length;
      }

      // 4. Complete execution
      // Note: If this is part of a multi-step job, we shouldn't complete here.
      // But assuming ChunkExecutor runs a single-step task for now.
      await this.executionManager.complete(executionId, { processedCount });
    } catch (error) {
      // Fail execution
      await this.executionManager.fail(executionId, {
        ...createStepExecutionError(error, step.classifyFailure, {
          executionId,
          stepName: step.name,
        }),
      });
      throw error; // Re-throw to let caller know
    }
  }

  private async writeChunk<I, O>(
    executionId: string,
    step: Step<I, O>,
    items: O[],
    checkpointKey: string,
    currentProcessedCount: number,
    totalCount?: number,
  ): Promise<void> {
    await step.writer.write(items);

    // Save checkpoint
    if (isCheckpointable(step.reader)) {
      const checkpoint = step.reader.getCheckpoint();
      await this.executionManager.checkpoint(executionId, checkpointKey, checkpoint);
    }

    if (this.hasValidTotal(totalCount)) {
      await this.executionManager.updateProgress(executionId, {
        current: currentProcessedCount,
        total: totalCount,
      });
    }
  }

  private hasValidTotal(total: number | undefined): total is number {
    return typeof total === "number" && Number.isFinite(total) && total > 0;
  }
}
