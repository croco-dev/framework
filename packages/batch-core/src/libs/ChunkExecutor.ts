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

type ReaderCursorSnapshot = { cursor: unknown; serialized?: string };

type InitialReaderCursors = Map<string, Map<string, ReaderRun>>;

type ReaderRun = {
  checkpoints: WeakMap<Checkpointable, ReaderRegistration>;
  registrations: Set<ReaderRegistration>;
};

type ReaderRegistration = {
  manager: WeakRef<ExecutionManager>;
  attempt: number;
  executionId: string;
  executionType: string;
  createdAt: number;
  idempotencyKey?: string;
  requestFingerprint?: string;
  stepName: string;
  snapshot?: ReaderCursorSnapshot;
  history: Set<ReaderRegistration>;
};

const initialReaderCheckpoints = new WeakMap<ExecutionManager, InitialReaderCursors>();
const activeCheckpointReaders = new WeakSet<Checkpointable>();
const readerHistory = new WeakMap<Checkpointable, Set<ReaderRegistration>>();
const discardedReaders = new FinalizationRegistry<{
  cursors: WeakRef<InitialReaderCursors>;
  run: WeakRef<ReaderRun>;
  registration: ReaderRegistration;
}>(({ cursors, run, registration }) => {
  const { executionId, stepName, history } = registration;
  history.delete(registration);
  const current = cursors.deref();
  const registeredRun = run.deref();
  if (!current || !registeredRun || current.get(executionId)?.get(stepName) !== registeredRun)
    return;
  registeredRun.registrations.delete(registration);
  if (registeredRun.registrations.size === 0) forgetInitialCursors(current, executionId, stepName);
});

function chunkCheckpointKey(stepName: string): string {
  return `${stepName}.chunkCheckpoint`;
}

function savedReaderCheckpointKey(checkpoints: Execution["checkpoints"], stepName: string) {
  if (!checkpoints) return undefined;
  const current = chunkCheckpointKey(stepName);
  if (Object.hasOwn(checkpoints, current)) return current;
  const legacy = `${stepName}.cursor`;
  return Object.hasOwn(checkpoints, legacy) ? legacy : undefined;
}

function unavailableInitialCursor(stepName: string): ExecutionProblem {
  return ExecutionProblems.conflict(
    `Cannot rewind step '${stepName}' to its initial position. Retry with a fresh reader.`,
  );
}

function matchesOptionalIdentity(before?: string, current?: string): boolean {
  return before === undefined || current === undefined || before === current;
}

function isProcessedCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isRunningAttempt(current: Execution, expected: Execution): boolean {
  return current.status === "running" && current.attempts === expected.attempts;
}

async function restoreReaderCheckpoint(
  reader: Checkpointable,
  cursor: unknown,
  processedCount: number,
): Promise<number> {
  await reader.restoreCheckpoint(cursor);
  const restoredCount = reader.getRestoredProcessedCount?.();
  if (restoredCount === undefined) return processedCount;
  if (!isProcessedCount(restoredCount)) {
    throw ExecutionProblems.checkpointStoreConformance(
      "Invalid input count after restoring the reader",
    );
  }
  return restoredCount;
}

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

function initialCursorsFor(manager: ExecutionManager): InitialReaderCursors {
  let cursors = initialReaderCheckpoints.get(manager);
  if (!cursors) {
    cursors = new Map();
    initialReaderCheckpoints.set(manager, cursors);
  }
  return cursors;
}

function forgetInitialCursors(
  cursors: InitialReaderCursors,
  executionId: string,
  stepName?: string,
): void {
  const steps = cursors.get(executionId);
  if (!steps) return;
  if (stepName === undefined) {
    for (const run of steps.values()) {
      for (const registration of run.registrations) unregisterReader(registration);
    }
    cursors.delete(executionId);
    return;
  }
  const run = steps.get(stepName);
  if (run) {
    for (const registration of run.registrations) unregisterReader(registration);
  }
  steps.delete(stepName);
  if (steps.size === 0) cursors.delete(executionId);
}

function unregisterReader(registration: ReaderRegistration): void {
  discardedReaders.unregister(registration);
  registration.history.delete(registration);
}

function forgetReaderCursor(
  cursors: InitialReaderCursors,
  executionId: string,
  stepName: string,
  reader: Checkpointable,
): void {
  const run = cursors.get(executionId)?.get(stepName);
  const checkpoint = run?.checkpoints.get(reader);
  if (!run || !checkpoint) return;
  run.checkpoints.delete(reader);
  run.registrations.delete(checkpoint);
  unregisterReader(checkpoint);
  if (run.registrations.size === 0) forgetInitialCursors(cursors, executionId, stepName);
}

async function captureReaderCursor(
  stepName: string,
  reader: Checkpointable,
): Promise<ReaderCursorSnapshot | undefined> {
  try {
    const cursor = await reader.getCheckpoint();
    if (cursor === undefined) return { cursor };
    const { value, serialized } = prepareExecutionCheckpoint(`${stepName}.cursor`, cursor);
    return { cursor: value, serialized };
  } catch {
    // Without a usable starting cursor, retry before the first saved checkpoint needs a fresh reader.
    return undefined;
  }
}

async function rememberInitialCursor(
  execution: Execution,
  stepName: string,
  reader: Checkpointable,
  cursors: InitialReaderCursors,
  manager: ExecutionManager,
): Promise<void> {
  const snapshot = await captureReaderCursor(stepName, reader);
  let steps = cursors.get(execution.id);
  if (!steps) {
    steps = new Map();
    cursors.set(execution.id, steps);
  }
  let run = steps.get(stepName);
  if (!run) {
    run = { checkpoints: new WeakMap(), registrations: new Set() };
    steps.set(stepName, run);
  }
  const history = readerHistory.get(reader) ?? new Set<ReaderRegistration>();
  const registration = {
    manager: new WeakRef(manager),
    attempt: execution.attempts,
    executionId: execution.id,
    executionType: execution.type,
    createdAt: execution.createdAt.getTime(),
    idempotencyKey: execution.idempotencyKey,
    requestFingerprint: execution.requestFingerprint,
    stepName,
    snapshot,
    history,
  };
  run.checkpoints.set(reader, registration);
  run.registrations.add(registration);
  history.add(registration);
  readerHistory.set(reader, history);
  // A caller may discard the reader without retrying or cancelling the execution.
  discardedReaders.register(
    reader,
    { cursors: new WeakRef(cursors), run: new WeakRef(run), registration },
    registration,
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

  /** Saves a step's cursor and cumulative input count in one checkpoint. */
  async saveCheckpoint(
    executionId: string,
    stepName: string,
    cursor: unknown,
    processedCount: number,
  ): Promise<Execution> {
    assertValidBatchStepName(stepName);
    if (!isProcessedCount(processedCount)) {
      throw ExecutionProblems.checkpointStoreConformance(
        `Invalid processed count for step '${stepName}'`,
      );
    }
    return this.executionManager.checkpoint(executionId, chunkCheckpointKey(stepName), {
      version: CHUNK_CHECKPOINT_VERSION,
      cursor: prepareExecutionCheckpoint(`${stepName}.cursor`, cursor).value,
      processedCount,
    });
  }

  async execute<I, O>(
    executionId: string,
    step: Step<I, O>,
    options: ChunkExecutorOptions = {},
  ): Promise<void> {
    assertValidBatchStepName(step?.name);
    assertValidChunkSize(step?.chunkSize);
    const reader = isCheckpointable(step.reader) ? step.reader : undefined;
    if (!reader) return this.executeStep(executionId, step, options);
    if (activeCheckpointReaders.has(reader)) {
      throw ExecutionProblems.conflict(`Step '${step.name}' needs a reader that is not in use.`);
    }
    activeCheckpointReaders.add(reader);
    try {
      await this.executeStep(executionId, step, options, reader);
    } finally {
      activeCheckpointReaders.delete(reader);
    }
  }

  private async executeStep<I, O>(
    executionId: string,
    step: Step<I, O>,
    options: ChunkExecutorOptions,
    reader?: Checkpointable,
  ): Promise<void> {
    const cursors = initialCursorsFor(this.executionManager);
    const initial = reader && cursors.get(executionId)?.get(step.name)?.checkpoints.get(reader);
    const history = reader && readerHistory.get(reader);
    const otherManagerCursors = history
      ? Array.from(history).filter(
          (entry) =>
            entry.executionId === executionId &&
            entry.stepName === step.name &&
            entry.manager.deref() !== this.executionManager,
        )
      : [];
    const rewind =
      reader && (initial || otherManagerCursors.length > 0)
        ? async (previous: Execution, attempt: number) => {
            if (
              (initial?.attempt ?? 1) >= attempt ||
              savedReaderCheckpointKey(previous.checkpoints, step.name)
            )
              return;
            const possiblePriorRuns = initial
              ? []
              : otherManagerCursors.filter(
                  (entry) =>
                    entry.executionType === previous.type &&
                    entry.createdAt === previous.createdAt.getTime() &&
                    matchesOptionalIdentity(entry.idempotencyKey, previous.idempotencyKey) &&
                    matchesOptionalIdentity(entry.requestFingerprint, previous.requestFingerprint),
                );
            if (!initial && possiblePriorRuns.length === 0) return;
            if (previous.error?.indeterminate === true) {
              throw ExecutionProblems.indeterminateRetryBlocked(
                `Cannot rewind step '${step.name}' before resolving the indeterminate execution outcome`,
              );
            }
            if (!initial) {
              // A reader already at the starting cursor can be used even if two stores have
              // indistinguishable execution metadata. Only the original manager can rewind it.
              const current = await captureReaderCursor(step.name, reader);
              if (
                current &&
                possiblePriorRuns.every(
                  ({ snapshot }) => snapshot && snapshot.serialized === current.serialized,
                )
              )
                return;
              throw unavailableInitialCursor(step.name);
            }
            const { snapshot } = initial;
            if (!snapshot) throw unavailableInitialCursor(step.name);
            try {
              await reader.restoreCheckpoint(structuredClone(snapshot.cursor));
            } catch (error) {
              const problem = unavailableInitialCursor(step.name);
              Object.defineProperty(problem, "cause", { configurable: true, value: error });
              throw problem;
            }
          }
        : undefined;
    const observeExecution = (current: Execution) => {
      const exhausted =
        (current.status === "failed" || current.status === "timed_out") &&
        current.attempts >= current.maxAttempts;
      if (current.status === "cancelled" || current.status === "completed" || exhausted) {
        forgetInitialCursors(cursors, executionId);
      }
    };
    const execution = {
      ...(await this.resolveExecution(
        executionId,
        options,
        rewind,
        cursors.has(executionId) ? observeExecution : undefined,
      )),
    };

    if (execution.status === "cancelled") {
      observeExecution(execution);
      return;
    }
    const loadExecution = async () => {
      const current = await this.executionManager.get(executionId);
      observeExecution(current);
      return current;
    };
    const runningAttempt = async () => isRunningAttempt(await loadExecution(), execution);

    try {
      let items: O[] = [];
      let chunkInputCount = 0;
      const restoredCount = await this.restoreProcessedCount(execution, step);
      if (
        restoredCount === undefined &&
        !initial &&
        execution.attempts < execution.maxAttempts &&
        reader
      ) {
        if (!(await runningAttempt())) return;
        await rememberInitialCursor(execution, step.name, reader, cursors, this.executionManager);
      }
      let processedCount = restoredCount ?? 0;
      const totalCount = execution.progress?.total;
      if (
        this.hasValidTotal(totalCount) &&
        restoredCount !== undefined &&
        restoredCount !== execution.progress?.current
      ) {
        if (!(await runningAttempt())) return;
        await this.executionManager.updateProgress(executionId, {
          current: processedCount,
          total: totalCount,
        });
      }

      while (true) {
        if (!(await runningAttempt())) return;

        // Read
        const item = await step.reader.read();
        if (!(await runningAttempt())) return;

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

        if (!(await runningAttempt())) return;

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
              processedCount + chunkInputCount,
              loadExecution,
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
            processedCount + chunkInputCount,
            loadExecution,
            totalCount,
          ))
        ) {
          return;
        }
        processedCount += chunkInputCount;
      }

      if (!(await runningAttempt())) return;
      if (options.completeExecution ?? true) {
        try {
          await this.executionManager.complete(executionId, { processedCount });
          forgetInitialCursors(cursors, executionId);
        } catch (error) {
          if (
            error instanceof ExecutionProblem &&
            error.code === "execution/invalid-state-transition" &&
            !(await runningAttempt())
          )
            return;
          throw error;
        }
      } else if (reader) {
        forgetReaderCursor(cursors, executionId, step.name, reader);
      }
    } catch (error) {
      try {
        if (await runningAttempt()) {
          const failed = await this.executionManager.fail(executionId, {
            ...createStepExecutionError(error, step.classifyFailure, {
              executionId,
              stepName: step.name,
            }),
          });
          if (failed.attempts === execution.attempts) observeExecution(failed);
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
    currentProcessedCount: number,
    loadExecution: () => Promise<Execution>,
    totalCount?: number,
  ): Promise<boolean> {
    const executionId = execution.id;
    if (!isRunningAttempt(await loadExecution(), execution)) return false;

    if (items.length > 0) {
      await step.writer.write(items);
    }

    // Never publish an old write's progress into a replacement attempt.
    if ((await loadExecution()).attempts !== execution.attempts) return false;

    // A successful in-flight write remains committed even if termination arrived
    // while it was pending. Preserve its cursor/count evidence before stopping.
    // The checkpoint does not share a transaction with the external sink.
    if (isCheckpointable(step.reader)) {
      await this.saveCheckpoint(
        executionId,
        step.name,
        step.reader.getCheckpoint(),
        currentProcessedCount,
      );
      forgetReaderCursor(
        initialCursorsFor(this.executionManager),
        executionId,
        step.name,
        step.reader,
      );
    }

    if (this.hasValidTotal(totalCount)) {
      await this.executionManager.updateProgress(executionId, {
        current: currentProcessedCount,
        total: totalCount,
      });
    }
    return true;
  }

  private hasValidTotal(total: number | undefined): total is number {
    return typeof total === "number" && Number.isFinite(total) && total > 0;
  }

  private async restoreProcessedCount<I, O>(
    execution: Execution,
    step: Step<I, O>,
  ): Promise<number | undefined> {
    const { reader, name } = step;
    const { checkpoints } = execution;
    if (!checkpoints || !isCheckpointable(reader)) return undefined;

    const checkpointKey = savedReaderCheckpointKey(checkpoints, name);
    if (checkpointKey === undefined) return undefined;
    if (checkpointKey === chunkCheckpointKey(name)) {
      const checkpoint = checkpoints[checkpointKey];
      if (
        typeof checkpoint !== "object" ||
        checkpoint === null ||
        !("version" in checkpoint) ||
        checkpoint.version !== CHUNK_CHECKPOINT_VERSION ||
        !("cursor" in checkpoint) ||
        !("processedCount" in checkpoint) ||
        !isProcessedCount(checkpoint.processedCount)
      ) {
        throw ExecutionProblems.checkpointStoreConformance(
          `Invalid chunk checkpoint for step '${name}'`,
        );
      }
      return restoreReaderCheckpoint(reader, checkpoint.cursor, checkpoint.processedCount);
    }

    const cursor = checkpoints[checkpointKey];
    const checkpointed = checkpoints[`${name}.processedCount`];
    if (typeof checkpointed === "number" && Number.isFinite(checkpointed) && checkpointed > 0) {
      return restoreReaderCheckpoint(reader, cursor, checkpointed);
    }

    const current = execution.progress?.current;
    const processedCount =
      typeof current === "number" && Number.isFinite(current) && current > 0 ? current : 0;
    return restoreReaderCheckpoint(reader, cursor, processedCount);
  }

  private async resolveExecution(
    executionId: string,
    options: ChunkExecutorOptions,
    rewind?: (execution: Execution, attempt: number) => Promise<void>,
    observe?: (execution: Execution) => void,
  ): Promise<Execution> {
    if (options.startExecution ?? true) {
      if (rewind || observe) {
        const previous = await this.executionManager.get(executionId);
        observe?.(previous);
        if (rewind && previous.attempts > 0) {
          if (previous.error?.indeterminate === true) {
            throw ExecutionProblems.indeterminateRetryBlocked(
              `Execution '${executionId}' has an indeterminate outcome; record recovery before starting another attempt`,
            );
          }
          if (previous.status !== "retrying") {
            throw ExecutionProblems.invalidStateTransition(
              `Cannot rewind a reader while execution '${executionId}' is '${previous.status}'`,
            );
          }
          await rewind(previous, previous.attempts + 1);
          const current = await this.executionManager.get(executionId);
          observe?.(current);
          if (current.status !== previous.status || current.attempts !== previous.attempts) {
            throw ExecutionProblems.conflict(
              `Execution '${executionId}' changed while preparing its reader. Retry after checking its current state.`,
            );
          }
        }
      }
      // A successful start owns the returned attempt. Restore any checkpoint it carries,
      // including one saved after the last read above.
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
    observe?.(execution);
    if (execution.status !== "running" && execution.status !== "cancelled") {
      throw ExecutionProblems.invalidStateTransition(
        `Cannot continue batch execution from '${execution.status}' status`,
      );
    }
    if (execution.status === "running") await rewind?.(execution, execution.attempts);

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
