import { ExecutionProblems } from "./ExecutionProblem";
import type {
  ExecutionContinuationManager,
  ExecutionInspectionManager,
  ExecutionManager,
  ExecutionReplayManager,
  ClaimExecutionContinuationInput,
  ClaimExecutionContinuationResult,
  RenewExecutionContinuationInput,
  StageExecutionContinuationInput,
} from "./interfaces/ExecutionManager";
import type {
  ExecutionContinuationStore,
  ExecutionLogStore,
  ExecutionStore,
} from "./interfaces/ExecutionStore";
import type {
  AddExecutionLogParams,
  CreateExecutionParams,
  Execution,
  ExecutionError,
  ExecutionContinuationClaim,
  ExecutionLogEntry,
  ExecutionStatus,
  ListExecutionsOptions,
  ProgressInfo,
  ReconcileTimedOutOptions,
  ReconcileTimedOutResult,
  ReplayExecutionParams,
} from "./types";

const DEFAULT_RECONCILIATION_BATCH_SIZE = 100;
export const INITIAL_EXECUTION_CONTINUATION_TOKEN = "initial";

export interface ExecutionManagerOptions {
  clock?: () => Date;
  tokenGenerator?: () => string;
  continuationLeaseDurationMs?: number;
  initialContinuationToken?: string;
}

const DEFAULT_CONTINUATION_LEASE_DURATION_MS = 30_000;

/**
 * State transition rules for ExecutionStatus.
 *
 * Allowed transitions:
 * - pending → running | cancelled
 * - running → completed | failed | timed_out | cancelled
 * - failed → retrying → running
 * - retrying → failed (max retries exhausted)
 * - timed_out → retrying
 *
 * Terminal states (no outgoing transitions):
 * - completed, cancelled, failed (when max retries exhausted)
 */
const ALLOWED_TRANSITIONS: Record<ExecutionStatus, ExecutionStatus[]> = {
  pending: ["running", "cancelled"],
  running: ["completed", "failed", "timed_out", "cancelled", "retrying"],
  completed: [],
  failed: ["retrying"],
  cancelled: [],
  retrying: ["running", "failed"],
  timed_out: ["retrying"],
};

/**
 * Validate if a state transition is allowed.
 *
 * @throws Problem with code 'INVALID_STATE_TRANSITION' if transition is not allowed
 */
function validateTransition(from: ExecutionStatus, to: ExecutionStatus): void {
  const allowed = ALLOWED_TRANSITIONS[from];

  if (!allowed.includes(to)) {
    throw ExecutionProblems.invalidStateTransition(`Cannot transition from '${from}' to '${to}'`);
  }
}

/**
 * Calculate progress percentage from current and total values.
 */
function calculatePercent(current: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((current / total) * 100));
}

function toIsoTimestamp(timestamp?: Date | string): string {
  if (timestamp === undefined) {
    return new Date().toISOString();
  }

  return timestamp instanceof Date ? timestamp.toISOString() : timestamp;
}

function isReplayableStatus(status: ExecutionStatus): boolean {
  return status === "failed" || status === "timed_out";
}

function supportsExecutionLogStore(
  store: ExecutionStore,
): store is ExecutionStore & ExecutionLogStore {
  const candidate = store as ExecutionStore & { appendLog?: unknown };
  return typeof candidate.appendLog === "function";
}

function supportsExecutionContinuationStore(
  store: ExecutionStore,
): store is ExecutionStore & ExecutionContinuationStore {
  const candidate = store as ExecutionStore & {
    acquireContinuation?: unknown;
    updateClaimedContinuation?: unknown;
  };

  return (
    typeof candidate.acquireContinuation === "function" &&
    typeof candidate.updateClaimedContinuation === "function"
  );
}

function defaultTokenGenerator(): string {
  return globalThis.crypto.randomUUID();
}

/**
 * ExecutionManagerImpl provides lifecycle management for executions.
 *
 * Features:
 * - State transition validation
 * - Idempotency check via ExecutionStore
 * - Timeout handling
 * - Progress tracking with auto-calculation
 * - Checkpoint management for batch resume
 * - Automatic retry transition on failure
 */
export class ExecutionManagerImpl
  implements
    ExecutionManager,
    ExecutionInspectionManager,
    ExecutionReplayManager,
    ExecutionContinuationManager
{
  private readonly clock: () => Date;
  private readonly tokenGenerator: () => string;
  private readonly continuationLeaseDurationMs: number;
  private readonly initialContinuationToken: string;

  constructor(
    private readonly store: ExecutionStore,
    options: ExecutionManagerOptions = {},
  ) {
    this.clock = options.clock ?? (() => new Date());
    this.tokenGenerator = options.tokenGenerator ?? defaultTokenGenerator;
    this.continuationLeaseDurationMs =
      options.continuationLeaseDurationMs ?? DEFAULT_CONTINUATION_LEASE_DURATION_MS;
    this.initialContinuationToken =
      options.initialContinuationToken ?? INITIAL_EXECUTION_CONTINUATION_TOKEN;
  }

  getContinuationLeaseDurationMs(): number {
    return this.continuationLeaseDurationMs;
  }

  async get(id: string): Promise<Execution> {
    return this.findExisting(id);
  }

  async list(options?: ListExecutionsOptions): Promise<Execution[]> {
    return this.store.list(options);
  }

  async create(params: CreateExecutionParams): Promise<Execution> {
    const { idempotencyKey, maxAttempts = 1, timeout, ...rest } = params;

    // Idempotency check: if idempotencyKey exists, return existing execution
    if (idempotencyKey) {
      const existing = await this.store.findByIdempotencyKey(idempotencyKey);
      if (existing) {
        return existing;
      }
    }

    return this.store.create({
      ...rest,
      maxAttempts,
      timeout,
      idempotencyKey,
    });
  }

  async start(id: string): Promise<Execution> {
    const execution = await this.findExisting(id);

    // Allow: pending → running, retrying → running
    const targetStatus: ExecutionStatus = "running";
    validateTransition(execution.status, targetStatus);

    const startedAt = new Date();
    const attempts = execution.attempts + 1;

    return this.transition(execution, targetStatus, {
      status: targetStatus,
      startedAt,
      attempts,
      completedAt: undefined,
      error: undefined,
    });
  }

  async complete(id: string, result?: unknown): Promise<Execution> {
    const execution = await this.findExisting(id);

    validateTransition(execution.status, "completed");

    return this.transition(execution, "completed", {
      status: "completed",
      result,
      completedAt: new Date(),
    });
  }

  async fail(id: string, error: ExecutionError): Promise<Execution> {
    const execution = await this.findExisting(id);

    // Check if should retry
    if (error.retryable && execution.attempts < execution.maxAttempts) {
      const targetStatus: ExecutionStatus = "retrying";
      validateTransition(execution.status, targetStatus);

      return this.transition(execution, targetStatus, {
        status: targetStatus,
        error,
      });
    }

    // Max attempts exhausted or not retryable
    validateTransition(execution.status, "failed");

    return this.transition(execution, "failed", {
      status: "failed",
      error,
      completedAt: new Date(),
    });
  }

  async cancel(id: string, reason?: string): Promise<Execution> {
    const execution = await this.findExisting(id);

    validateTransition(execution.status, "cancelled");

    const metadata = reason
      ? { ...execution.metadata, cancellationReason: reason }
      : execution.metadata;

    return this.transition(execution, "cancelled", {
      status: "cancelled",
      completedAt: new Date(),
      metadata,
    });
  }

  async retry(id: string): Promise<Execution> {
    const execution = await this.findExisting(id);

    if (execution.attempts >= execution.maxAttempts) {
      throw ExecutionProblems.maxRetriesExceeded("Maximum retry attempts exceeded");
    }

    // Allow: failed → retrying, timed_out → retrying
    const targetStatus: ExecutionStatus = "retrying";
    validateTransition(execution.status, targetStatus);

    return this.transition(execution, targetStatus, {
      status: targetStatus,
      error: undefined, // Clear previous error
      completedAt: undefined,
    });
  }

  async updateProgress(id: string, progress: ProgressInfo): Promise<Execution> {
    await this.findExisting(id);

    const percent = progress.percent ?? calculatePercent(progress.current, progress.total);

    return this.store.update(id, {
      progress: {
        ...progress,
        percent,
      },
    });
  }

  async checkpoint(id: string, key: string, value: unknown): Promise<Execution> {
    const execution = await this.findExisting(id);

    return this.store.update(id, {
      checkpoints: {
        ...execution.checkpoints,
        [key]: value,
      },
    });
  }

  async timeout(id: string): Promise<Execution> {
    const execution = await this.findExisting(id);

    validateTransition(execution.status, "timed_out");

    return this.transition(execution, "timed_out", {
      status: "timed_out",
      completedAt: new Date(),
      error: {
        message: "Execution timed out",
        retryable: true,
      },
    });
  }

  async reconcileTimedOut(
    options: ReconcileTimedOutOptions = {},
  ): Promise<ReconcileTimedOutResult> {
    const now = options.now ?? new Date();
    const batchSize = options.batchSize ?? DEFAULT_RECONCILIATION_BATCH_SIZE;

    if (!Number.isInteger(batchSize) || batchSize <= 0) {
      throw ExecutionProblems.conflict("Reconciliation batchSize must be a positive integer");
    }

    let afterId: string | undefined;
    let scanned = 0;
    let timedOut = 0;

    while (true) {
      const page = await this.store.listRunning({ afterId, limit: batchSize });
      if (page.length === 0) {
        break;
      }

      for (const execution of page) {
        scanned += 1;

        if (this.isTimedOutAt(execution, now)) {
          const updated = await this.store.updateIfStatus(execution.id, "running", {
            status: "timed_out",
            completedAt: now,
            error: {
              message: "Execution timed out",
              retryable: true,
            },
          });

          if (updated) {
            timedOut += 1;
          }
        }
      }

      afterId = page[page.length - 1]?.id;

      if (page.length < batchSize) {
        break;
      }
    }

    return { scanned, timedOut };
  }

  async claimContinuation(
    id: string,
    input: ClaimExecutionContinuationInput,
  ): Promise<ClaimExecutionContinuationResult> {
    const store = this.continuationStore();
    const now = this.clock();

    return store.acquireContinuation(id, {
      deliveryToken: input.deliveryToken,
      workerId: input.workerId,
      proposedAttemptToken: this.tokenGenerator(),
      fencingToken: this.tokenGenerator(),
      now,
      leaseDurationMs: this.continuationLeaseDurationMs,
      initialToken: this.initialContinuationToken,
    });
  }

  async renewContinuationClaim(
    id: string,
    claim: ExecutionContinuationClaim,
    input: RenewExecutionContinuationInput,
  ): Promise<Execution> {
    const now = this.clock();
    return this.updateClaimedContinuation(id, claim, {
      kind: "renew",
      workerId: input.workerId,
      now,
      expiresAt: new Date(now.getTime() + this.continuationLeaseDurationMs),
    });
  }

  async stageContinuation(
    id: string,
    claim: ExecutionContinuationClaim,
    input: StageExecutionContinuationInput,
  ): Promise<Execution> {
    return this.updateClaimedContinuation(id, claim, {
      kind: "stage",
      checkpoints: input.checkpoints,
      nextToken: input.nextToken,
    });
  }

  async confirmContinuationPublication(
    id: string,
    claim: ExecutionContinuationClaim,
  ): Promise<Execution> {
    return this.updateClaimedContinuation(id, claim, { kind: "confirm_publication" });
  }

  async completeContinuation(
    id: string,
    claim: ExecutionContinuationClaim,
    result?: unknown,
  ): Promise<Execution> {
    return this.updateClaimedContinuation(id, claim, {
      kind: "complete",
      result,
      completedAt: this.clock(),
    });
  }

  async failContinuation(
    id: string,
    claim: ExecutionContinuationClaim,
    error: ExecutionError,
  ): Promise<Execution> {
    return this.updateClaimedContinuation(id, claim, {
      kind: "fail",
      error,
      failedAt: this.clock(),
    });
  }

  async recordLog(id: string, params: AddExecutionLogParams): Promise<Execution> {
    if (!supportsExecutionLogStore(this.store)) {
      throw ExecutionProblems.conflict(
        "Execution store does not support atomic execution log append",
      );
    }

    const entry: ExecutionLogEntry = {
      timestamp: toIsoTimestamp(params.timestamp),
      level: params.level ?? "info",
      message: params.message,
      ...(params.data !== undefined ? { data: params.data } : {}),
    };

    return this.store.appendLog(id, entry);
  }

  async replay(id: string, params: ReplayExecutionParams = {}): Promise<Execution> {
    const execution = await this.findExisting(id);

    if (!isReplayableStatus(execution.status)) {
      throw ExecutionProblems.invalidStateTransition(
        `Cannot replay execution in '${execution.status}' status`,
      );
    }

    const replayedAt = new Date().toISOString();
    const logData = params.reason
      ? { sourceExecutionId: execution.id, reason: params.reason }
      : { sourceExecutionId: execution.id };

    return this.create({
      type: execution.type,
      payload: params.payload !== undefined ? params.payload : execution.payload,
      maxAttempts: execution.maxAttempts,
      timeout: execution.timeout,
      parentId: execution.parentId,
      replayOf: execution.id,
      metadata: {
        ...execution.metadata,
        ...params.metadata,
        replayOf: execution.id,
        replayedAt,
        ...(params.reason ? { replayReason: params.reason } : {}),
      },
      logs: [
        {
          timestamp: replayedAt,
          level: "info",
          message: "Execution replay created",
          data: logData,
        },
      ],
    });
  }

  private async findExisting(id: string): Promise<Execution> {
    const execution = await this.store.findById(id);

    if (!execution) {
      throw ExecutionProblems.notFound(`Execution with id '${id}' not found`);
    }

    return execution;
  }

  private continuationStore(): ExecutionStore & ExecutionContinuationStore {
    if (!supportsExecutionContinuationStore(this.store)) {
      throw ExecutionProblems.continuationUnsupported(
        "Execution store does not support atomic continuation claims",
      );
    }

    return this.store;
  }

  private async updateClaimedContinuation(
    id: string,
    claim: ExecutionContinuationClaim,
    update: Parameters<ExecutionContinuationStore["updateClaimedContinuation"]>[1]["update"],
  ): Promise<Execution> {
    const store = this.continuationStore();
    const updated = await store.updateClaimedContinuation(id, {
      fencingToken: claim.fencingToken,
      update,
    });

    if (updated) {
      return updated;
    }

    const current = await store.findById(id);
    throw ExecutionProblems.continuationConflict(
      `Continuation claim no longer owns execution '${id}'`,
      {
        currentWorkerId: current?.continuation?.claim?.workerId,
        currentLeaseExpiresAt: current?.continuation?.claim?.expiresAt.toISOString(),
        currentStatus: current?.status,
      },
    );
  }

  private async transition(
    execution: Execution,
    targetStatus: ExecutionStatus,
    data: Partial<Execution>,
  ): Promise<Execution> {
    const updated = await this.store.updateIfStatus(execution.id, execution.status, data);

    if (updated) {
      return updated;
    }

    const current = await this.findExisting(execution.id);
    throw ExecutionProblems.invalidStateTransition(
      `Cannot transition execution '${execution.id}' from '${execution.status}' to '${targetStatus}'; current status is '${current.status}'`,
    );
  }

  private isTimedOutAt(execution: Execution, now: Date): boolean {
    return (
      execution.startedAt !== undefined &&
      execution.timeout !== undefined &&
      execution.timeout > 0 &&
      execution.startedAt.getTime() + execution.timeout <= now.getTime()
    );
  }
}
