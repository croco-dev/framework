import {
  ExecutionProblems,
  ExecutionProblem,
  prepareExecutionCheckpoint,
  type Execution,
  type ExecutionInspectionManager,
  type ExecutionManager,
} from "@croco/execution-core";
import { assertValidChunkSize } from "./ChunkSize";
import type { Checkpointable } from "./interfaces/ItemReader";
import { assertValidBatchStepName } from "./problems/BatchStepProblems";
import type { Step } from "./Step";
import { createStepExecutionError } from "./StepFailure";

const CHUNK_CHECKPOINT_VERSION = 1;

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

function attachFailureRecordError(error: unknown, failureRecordError: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  try {
    Object.defineProperty(error, "batchFailureRecordError", {
      configurable: true,
      enumerable: false,
      value: failureRecordError,
    });
    return true;
  } catch {
    return false;
  }
}

function reportFailureRecordError(
  executionId: string,
  error: unknown,
  failureRecordError: unknown,
): void {
  if (attachFailureRecordError(error, failureRecordError)) {
    return;
  }

  try {
    console.error("[ChunkExecutor] Failed to record batch execution failure", {
      executionId,
      failureRecordError,
    });
  } catch {
    return;
  }
}

export class ChunkExecutor {
  constructor(private executionManager: ExecutionManager) {}

  async execute<I, O>(
    executionId: string,
    step: Step<I, O>,
    options: ChunkExecutorOptions = {},
  ): Promise<void> {
    assertValidBatchStepName(step?.name);
    assertValidChunkSize(step?.chunkSize);
    const execution = { ...(await this.resolveExecution(executionId, options)) };

    if (execution.status === "cancelled") return;

    try {
      const checkpointKey = `${step.name}.chunkCheckpoint`;
      let items: O[] = [];
      let chunkInputCount = 0;
      let processedCount = this.restoreProcessedCount(execution, step, checkpointKey);
      const totalCount = execution.progress?.total;
      if (this.hasValidTotal(totalCount) && processedCount > (execution.progress?.current ?? 0)) {
        if (!(await this.isRunningAttempt(execution))) return;
        await this.executionManager.updateProgress(executionId, {
          current: processedCount,
          total: totalCount,
        });
      }

      while (true) {
        if (!(await this.isRunningAttempt(execution))) return;

        // Read
        const item = await step.reader.read();
        if (!(await this.isRunningAttempt(execution))) return;

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

        if (!(await this.isRunningAttempt(execution))) return;

        if (processedItem !== null) {
          items.push(processedItem);
        }
        chunkInputCount += 1;

        // Commit after processing a full input chunk, including filtered items.
        if (chunkInputCount >= step.chunkSize) {
          if (
            !(await this.writeChunk(
              execution,
              step,
              items,
              checkpointKey,
              processedCount + chunkInputCount,
              totalCount,
            ))
          ) {
            return;
          }
          processedCount += chunkInputCount;
          items = [];
          chunkInputCount = 0;
        }
      }

      // Commit the remaining input chunk even when all its items were filtered.
      if (chunkInputCount > 0) {
        if (
          !(await this.writeChunk(
            execution,
            step,
            items,
            checkpointKey,
            processedCount + chunkInputCount,
            totalCount,
          ))
        ) {
          return;
        }
        processedCount += chunkInputCount;
      }

      if (!(await this.isRunningAttempt(execution))) return;
      if (options.completeExecution ?? true) {
        try {
          await this.executionManager.complete(executionId, { processedCount });
        } catch (error) {
          if (
            error instanceof ExecutionProblem &&
            error.code === "execution/invalid-state-transition" &&
            !(await this.isRunningAttempt(execution))
          )
            return;
          throw error;
        }
      }
    } catch (error) {
      try {
        if (await this.isRunningAttempt(execution)) {
          await this.executionManager.fail(executionId, {
            ...createStepExecutionError(error, step.classifyFailure, {
              executionId,
              stepName: step.name,
            }),
          });
        }
      } catch (failureRecordError) {
        reportFailureRecordError(executionId, error, failureRecordError);
      }
      throw error;
    }
  }

  private async writeChunk<I, O>(
    execution: Execution,
    step: Step<I, O>,
    items: O[],
    checkpointKey: string,
    currentProcessedCount: number,
    totalCount?: number,
  ): Promise<boolean> {
    const executionId = execution.id;
    if (!(await this.isRunningAttempt(execution))) return false;

    if (items.length > 0) {
      await step.writer.write(items);
    }

    // Never publish an old write's progress into a replacement attempt.
    if ((await this.executionManager.get(executionId)).attempts !== execution.attempts)
      return false;

    // A successful in-flight write remains committed even if termination arrived
    // while it was pending. Preserve its cursor/count evidence before stopping.
    // The checkpoint does not share a transaction with the external sink.
    if (isCheckpointable(step.reader)) {
      const cursor = prepareExecutionCheckpoint(
        `${step.name}.cursor`,
        step.reader.getCheckpoint(),
      ).value;
      await this.executionManager.checkpoint(executionId, checkpointKey, {
        version: CHUNK_CHECKPOINT_VERSION,
        cursor,
        processedCount: currentProcessedCount,
      });
    }

    if (this.hasValidTotal(totalCount)) {
      await this.executionManager.updateProgress(executionId, {
        current: currentProcessedCount,
        total: totalCount,
      });
    }
    return true;
  }

  private async isRunningAttempt(execution: Execution): Promise<boolean> {
    const current = await this.executionManager.get(execution.id);
    return current.status === "running" && current.attempts === execution.attempts;
  }

  private hasValidTotal(total: number | undefined): total is number {
    return typeof total === "number" && Number.isFinite(total) && total > 0;
  }

  private restoreProcessedCount<I, O>(
    execution: Execution,
    step: Step<I, O>,
    checkpointKey: string,
  ): number {
    const { reader, name } = step;
    const { checkpoints } = execution;
    if (!checkpoints || !isCheckpointable(reader)) return 0;

    if (Object.hasOwn(checkpoints, checkpointKey)) {
      const checkpoint = checkpoints[checkpointKey];
      if (
        typeof checkpoint !== "object" ||
        checkpoint === null ||
        !("version" in checkpoint) ||
        checkpoint.version !== CHUNK_CHECKPOINT_VERSION ||
        !("cursor" in checkpoint) ||
        !("processedCount" in checkpoint) ||
        typeof checkpoint.processedCount !== "number" ||
        !Number.isSafeInteger(checkpoint.processedCount) ||
        checkpoint.processedCount <= 0
      ) {
        throw ExecutionProblems.checkpointStoreConformance(
          `Invalid chunk checkpoint for step '${name}'`,
        );
      }
      reader.restoreCheckpoint(checkpoint.cursor);
      return checkpoint.processedCount;
    }

    const legacyCursorKey = `${name}.cursor`;
    if (!Object.hasOwn(checkpoints, legacyCursorKey)) return 0;
    reader.restoreCheckpoint(checkpoints[legacyCursorKey]);
    const checkpointed = checkpoints[`${name}.processedCount`];
    if (typeof checkpointed === "number" && Number.isFinite(checkpointed) && checkpointed > 0) {
      return checkpointed;
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
    if (execution.status !== "running" && execution.status !== "cancelled") {
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
