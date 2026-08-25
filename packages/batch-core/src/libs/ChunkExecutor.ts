import {
  ExecutionProblems,
  type Execution,
  type ExecutionInspectionManager,
  type ExecutionManager,
} from "@croco/execution-core";
import { assertValidChunkSize } from "./ChunkSize";
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

  async execute<I, O>(
    executionId: string,
    step: Step<I, O>,
    options: ChunkExecutorOptions = {},
  ): Promise<void> {
    assertValidChunkSize(step.chunkSize);
    const execution = await this.resolveExecution(executionId, options);

    // 2. Restore checkpoint if available
    const checkpointKey = `${step.name}.cursor`;
    let restoredCheckpoint = false;
    if (this.hasCheckpoint(execution, checkpointKey) && isCheckpointable(step.reader)) {
      step.reader.restoreCheckpoint(execution.checkpoints[checkpointKey]);
      restoredCheckpoint = true;
    }

    let items: O[] = [];
    let processedCount = this.resolveProcessedCount(execution, restoredCheckpoint);
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

      if (options.completeExecution ?? true) {
        await this.executionManager.complete(executionId, { processedCount });
      }
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

  private hasCheckpoint(
    execution: Execution,
    checkpointKey: string,
  ): execution is Execution & { checkpoints: Record<string, unknown> } {
    return Object.prototype.hasOwnProperty.call(execution.checkpoints ?? {}, checkpointKey);
  }

  private resolveProcessedCount(execution: Execution, restoredCheckpoint: boolean): number {
    if (!restoredCheckpoint) {
      return 0;
    }

    const current = execution.progress?.current;
    return typeof current === "number" && Number.isFinite(current) && current > 0 ? current : 0;
  }

  private async resolveExecution(
    executionId: string,
    options: ChunkExecutorOptions,
  ): Promise<Execution> {
    if (options.startExecution ?? true) {
      return this.executionManager.start(executionId);
    }

    const inspectionManager = this.executionManager as ExecutionManager &
      Partial<Pick<ExecutionInspectionManager, "get">>;

    if (typeof inspectionManager.get !== "function") {
      throw ExecutionProblems.conflict(
        "Execution manager does not support continuing an already-started batch execution",
      );
    }

    const execution = await inspectionManager.get(executionId);
    if (execution.status !== "running") {
      throw ExecutionProblems.invalidStateTransition(
        `Cannot continue batch execution from '${execution.status}' status`,
      );
    }

    return execution;
  }
}

export type ChunkExecutorOptions = {
  /**
   * Start the execution before processing the step.
   *
   * Defaults to true. Multi-step jobs that keep the parent execution open with
   * completeExecution: false should pass false for later steps so the executor
   * reads the current running execution instead of attempting running -> running.
   */
  readonly startExecution?: boolean;

  /**
   * Complete the execution after this step finishes.
   *
   * Defaults to true for single-step batch jobs. Multi-step jobs should pass false
   * for intermediate steps and complete the parent execution after orchestration succeeds.
   */
  readonly completeExecution?: boolean;
};
