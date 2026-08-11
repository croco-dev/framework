import { ExecutionProblems } from "./ExecutionProblem";
import type {
  ExecutionAttemptManager,
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
  ExecutionAttemptStore,
  ExecutionContinuationStore,
  ExecutionLogStore,
  ExecutionStore,
} from "./interfaces/ExecutionStore";
import type {
  AddExecutionLogParams,
  CreateExecutionParams,
  Execution,
  ExecutionAttemptToken,
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
  /**
   * Continuation ownership duration in milliseconds.
   *
   * Must be an integer from MIN_CONTINUATION_LEASE_DURATION_MS through
   * MAX_CONTINUATION_LEASE_DURATION_MS.
   */
  continuationLeaseDurationMs?: number;
  initialContinuationToken?: string;
}

const DEFAULT_CONTINUATION_LEASE_DURATION_MS = 30_000;
export const MIN_CONTINUATION_LEASE_DURATION_MS = 1;
export const MAX_CONTINUATION_LEASE_DURATION_MS = 2_147_483_647;

function validateContinuationLeaseDuration(durationMs: number): void {
  if (
    !Number.isSafeInteger(durationMs) ||
    durationMs < MIN_CONTINUATION_LEASE_DURATION_MS ||
    durationMs > MAX_CONTINUATION_LEASE_DURATION_MS
  ) {
    throw ExecutionProblems.invalidContinuationLeaseDuration({
      receivedValue: durationMs,
      minimumMs: MIN_CONTINUATION_LEASE_DURATION_MS,
      maximumMs: MAX_CONTINUATION_LEASE_DURATION_MS,
    });
  }
}

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

async function executionRequestFingerprint(type: string, payload: unknown): Promise<string> {
  return sha256(
    canonicalStringify({
      payload,
      type,
    }),
  );
}

async function legacyExecutionRequestFingerprint(type: string, payload: unknown): Promise<string> {
  let durablePayload: unknown;

  try {
    durablePayload = JSON.parse(JSON.stringify(payload) ?? "null") as unknown;
  } catch {
    throw ExecutionProblems.idempotencyConflict(
      "Execution request payload cannot be compared with a legacy persisted payload",
    );
  }

  return sha256(
    canonicalStringify({
      payload: durablePayload,
      type,
    }),
  );
}

async function sha256(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function canonicalStringify(value: unknown, ancestors = new WeakSet<object>()): string {
  if (value === null) return '["null"]';

  switch (typeof value) {
    case "undefined":
      return '["undefined"]';
    case "boolean":
      return JSON.stringify(["boolean", value]);
    case "string":
      return JSON.stringify(["string", value]);
    case "number":
      if (Number.isNaN(value)) return '["number","NaN"]';
      if (value === Number.POSITIVE_INFINITY) return '["number","Infinity"]';
      if (value === Number.NEGATIVE_INFINITY) return '["number","-Infinity"]';
      if (Object.is(value, -0)) return '["number","-0"]';
      return JSON.stringify(["number", value]);
    case "bigint":
      return JSON.stringify(["bigint", value.toString()]);
    case "symbol":
    case "function":
      throw ExecutionProblems.idempotencyConflict(
        `Execution request payload contains unsupported ${typeof value} data`,
      );
  }

  if (ancestors.has(value)) {
    throw ExecutionProblems.idempotencyConflict(
      "Execution request payload contains a circular reference",
    );
  }
  ancestors.add(value);

  try {
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        throw ExecutionProblems.idempotencyConflict(
          "Execution request payload contains an invalid date",
        );
      }
      return JSON.stringify(["date", value.toISOString()]);
    }

    if (Array.isArray(value)) {
      const entries = Array.from({ length: value.length }, (_, index) =>
        index in value ? canonicalStringify(value[index], ancestors) : '["hole"]',
      );
      return `["array",[${entries.join(",")}]]`;
    }

    const symbolKeys = Object.getOwnPropertySymbols(value).filter((key) =>
      Object.prototype.propertyIsEnumerable.call(value, key),
    );
    if (symbolKeys.length > 0) {
      throw ExecutionProblems.idempotencyConflict(
        "Execution request payload contains unsupported symbol-keyed data",
      );
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw ExecutionProblems.idempotencyConflict(
        "Execution request payload contains an unsupported object type",
      );
    }

    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .sort()
      .map((key) => `[${JSON.stringify(key)},${canonicalStringify(record[key], ancestors)}]`);
    return `["object",[${entries.join(",")}]]`;
  } finally {
    ancestors.delete(value);
  }
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
    ExecutionAttemptManager,
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
    const continuationLeaseDurationMs =
      options.continuationLeaseDurationMs ?? DEFAULT_CONTINUATION_LEASE_DURATION_MS;
    validateContinuationLeaseDuration(continuationLeaseDurationMs);
    this.continuationLeaseDurationMs = continuationLeaseDurationMs;
    this.initialContinuationToken =
      options.initialContinuationToken ?? INITIAL_EXECUTION_CONTINUATION_TOKEN;
  }

  getContinuationLeaseDurationMs(): number {
    return this.continuationLeaseDurationMs;
  }

  supportsAttemptFencing(): boolean {
    const store = this.store as ExecutionStore & Partial<ExecutionAttemptStore>;
    return (
      typeof store.updateIfStatusAndAttempt === "function" &&
      typeof store.mergeCheckpointIfStatusAndAttempt === "function" &&
      typeof store.appendLogIfStatusAndAttempt === "function"
    );
  }

  async get(id: string): Promise<Execution> {
    return this.findExisting(id);
  }

  async list(options?: ListExecutionsOptions): Promise<Execution[]> {
    return this.store.list(options);
  }

  async create(params: CreateExecutionParams): Promise<Execution> {
    const {
      idempotencyKey,
      legacyIdempotencyKeys = [],
      maxAttempts = 1,
      timeout,
      ...rest
    } = params;
    let requestFingerprint: string | undefined;

    if (idempotencyKey) {
      requestFingerprint = await executionRequestFingerprint(params.type, params.payload);
      const legacyRequestFingerprint =
        legacyIdempotencyKeys.length === 0
          ? undefined
          : await legacyExecutionRequestFingerprint(params.type, params.payload);
      const existing = await this.store.findByIdempotencyKey(idempotencyKey);
      if (existing) {
        await this.assertMatchingIdempotentRequest(
          existing,
          requestFingerprint,
          params.type,
          params.payload,
        );
        return existing;
      }

      for (const legacyKey of new Set(legacyIdempotencyKeys)) {
        if (legacyKey === idempotencyKey) continue;
        const legacy = await this.store.findByIdempotencyKey(legacyKey);
        if (!legacy || legacy.type !== params.type) continue;

        const matches =
          legacy.requestFingerprint === undefined
            ? legacyRequestFingerprint !== undefined &&
              (await legacyExecutionRequestFingerprint(legacy.type, legacy.payload)) ===
                legacyRequestFingerprint
            : legacy.requestFingerprint === requestFingerprint;
        if (matches) return legacy;

        throw ExecutionProblems.idempotencyConflict(
          "Execution idempotency key was reused for a different type or payload",
        );
      }
    }

    const execution = await this.store.create({
      ...rest,
      maxAttempts,
      timeout,
      idempotencyKey,
      ...(requestFingerprint === undefined ? {} : { requestFingerprint }),
    });

    if (idempotencyKey && requestFingerprint !== undefined) {
      await this.assertMatchingIdempotentRequest(
        execution,
        requestFingerprint,
        params.type,
        params.payload,
      );
    }

    return execution;
  }

  private async assertMatchingIdempotentRequest(
    existing: Execution,
    requestedFingerprint: string,
    requestedType: string,
    requestedPayload: unknown,
  ): Promise<void> {
    const matches =
      existing.requestFingerprint === undefined
        ? (await legacyExecutionRequestFingerprint(existing.type, existing.payload)) ===
          (await legacyExecutionRequestFingerprint(requestedType, requestedPayload))
        : existing.requestFingerprint === requestedFingerprint;
    if (matches) return;

    throw ExecutionProblems.idempotencyConflict(
      "Execution idempotency key was reused for a different type or payload",
    );
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

  async completeAttempt(token: ExecutionAttemptToken, result?: unknown): Promise<Execution> {
    const execution = await this.findExisting(token.executionId);
    validateTransition(execution.status, "completed");

    return this.transitionAttempt(execution, token, "completed", {
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

  async failAttempt(token: ExecutionAttemptToken, error: ExecutionError): Promise<Execution> {
    const execution = await this.findExisting(token.executionId);

    if (error.retryable && execution.attempts < execution.maxAttempts) {
      validateTransition(execution.status, "retrying");
      return this.transitionAttempt(execution, token, "retrying", {
        status: "retrying",
        error,
      });
    }

    validateTransition(execution.status, "failed");
    return this.transitionAttempt(execution, token, "failed", {
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

    if (execution.status === "timed_out" && execution.error?.indeterminate === true) {
      throw ExecutionProblems.indeterminateRetryBlocked(
        `Execution '${id}' timed out with an indeterminate outcome; inspect external effects and resolve the timeout before retry`,
      );
    }

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
    return this.store.update(id, {
      progress: this.progressWithPercent(progress),
    });
  }

  async checkpoint(id: string, key: string, value: unknown): Promise<Execution> {
    return this.store.mergeCheckpoint(id, key, value);
  }

  async timeout(id: string): Promise<Execution> {
    const execution = await this.findExisting(id);

    validateTransition(execution.status, "timed_out");

    return this.transition(execution, "timed_out", {
      status: "timed_out",
      completedAt: new Date(),
      error: {
        message: "Execution timed out",
        code: "execution/timeout-indeterminate",
        retryable: false,
        indeterminate: true,
      },
    });
  }

  async timeoutAttempt(
    token: ExecutionAttemptToken,
    options: { retryable: boolean },
  ): Promise<Execution> {
    const execution = await this.findExisting(token.executionId);
    validateTransition(execution.status, "timed_out");

    return this.transitionAttempt(execution, token, "timed_out", {
      status: "timed_out",
      completedAt: new Date(),
      error: options.retryable
        ? {
            message: "Execution timed out",
            code: "execution/timeout-retryable",
            retryable: true,
          }
        : {
            message: "Execution timed out with an indeterminate outcome",
            code: "execution/timeout-indeterminate",
            retryable: false,
            indeterminate: true,
          },
    });
  }

  async updateProgressAttempt(
    token: ExecutionAttemptToken,
    progress: ProgressInfo,
  ): Promise<Execution> {
    const execution = await this.findRunningAttempt(token);
    const progressWithPercent = this.progressWithPercent(progress);
    return this.transitionAttempt(execution, token, "running", { progress: progressWithPercent });
  }

  async checkpointAttempt(
    token: ExecutionAttemptToken,
    key: string,
    value: unknown,
  ): Promise<Execution> {
    const execution = await this.findRunningAttempt(token);
    const store = this.attemptStore(execution.id);
    const updated = await store.mergeCheckpointIfStatusAndAttempt(
      execution.id,
      "running",
      token.attempt,
      key,
      value,
    );
    if (updated) return updated;
    return this.throwAttemptFenceConflict(token, "checkpoint");
  }

  async recordLogAttempt(
    token: ExecutionAttemptToken,
    params: AddExecutionLogParams,
  ): Promise<Execution> {
    const execution = await this.findRunningAttempt(token);
    const store = this.attemptStore(execution.id);
    const entry: ExecutionLogEntry = {
      timestamp: toIsoTimestamp(params.timestamp),
      level: params.level ?? "info",
      message: params.message,
      ...(params.data === undefined ? {} : { data: params.data }),
    };
    const updated = await store.appendLogIfStatusAndAttempt(
      execution.id,
      "running",
      token.attempt,
      entry,
    );
    if (updated) return updated;
    return this.throwAttemptFenceConflict(token, "record log");
  }

  async settleTimedOutAttempt(token: ExecutionAttemptToken): Promise<Execution> {
    const execution = await this.findExisting(token.executionId);
    if (execution.status !== "timed_out" || execution.error?.indeterminate !== true) {
      throw ExecutionProblems.attemptFenceConflict(
        `Attempt ${token.attempt} cannot settle execution '${token.executionId}' from status '${execution.status}'`,
      );
    }

    return this.transitionAttempt(execution, token, "timed_out", {
      error: {
        ...execution.error,
        message: "Execution timed out after the abandoned attempt settled",
        code: "execution/timeout-quiescent",
        retryable: true,
        indeterminate: false,
      },
    });
  }

  async resolveIndeterminateTimeout(
    token: ExecutionAttemptToken,
    reason: string,
  ): Promise<Execution> {
    const execution = await this.findExisting(token.executionId);
    if (execution.status !== "timed_out" || execution.error?.indeterminate !== true) {
      throw ExecutionProblems.attemptFenceConflict(
        `Execution '${token.executionId}' is not an indeterminate timeout requiring operator recovery`,
      );
    }
    if (reason.trim().length === 0) {
      throw ExecutionProblems.conflict("Indeterminate timeout recovery requires a reason");
    }

    const store = this.attemptStore(token.executionId);
    const updated = await store.updateIfStatusAndAttempt(
      token.executionId,
      "timed_out",
      token.attempt,
      {
        error: {
          ...execution.error,
          message: "Execution timeout was resolved by an operator",
          code: "execution/timeout-operator-resolved",
          retryable: true,
          indeterminate: false,
        },
        metadata: {
          ...execution.metadata,
          timeoutRecovery: {
            reason,
            resolvedAt: this.clock().toISOString(),
          },
        },
      },
    );
    if (updated) return updated;

    throw ExecutionProblems.attemptFenceConflict(
      `Attempt ${token.attempt} lost ownership before indeterminate timeout recovery for execution '${token.executionId}' could be recorded`,
    );
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
              message: "Execution timed out with an indeterminate outcome",
              code: "execution/timeout-indeterminate",
              retryable: false,
              indeterminate: true,
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

    if (execution.status === "timed_out" && execution.error?.indeterminate === true) {
      throw ExecutionProblems.indeterminateRetryBlocked(
        `Execution '${id}' timed out with an indeterminate outcome; resolve it before replay`,
      );
    }

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

  private progressWithPercent(progress: ProgressInfo): ProgressInfo {
    return {
      ...progress,
      percent: progress.percent ?? calculatePercent(progress.current, progress.total),
    };
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

  private async transitionAttempt(
    execution: Execution,
    token: ExecutionAttemptToken,
    targetStatus: ExecutionStatus,
    data: Partial<Execution>,
  ): Promise<Execution> {
    if (token.executionId !== execution.id || token.attempt !== execution.attempts) {
      throw ExecutionProblems.attemptFenceConflict(
        `Attempt token does not own execution '${execution.id}' attempt ${execution.attempts}`,
      );
    }

    const store = this.attemptStore(execution.id);

    const updated = await store.updateIfStatusAndAttempt(
      execution.id,
      execution.status,
      token.attempt,
      data,
    );
    if (updated) return updated;

    return this.throwAttemptFenceConflict(token, `transition to '${targetStatus}'`);
  }

  private attemptStore(executionId: string): ExecutionStore & ExecutionAttemptStore {
    if (!this.supportsAttemptFencing()) {
      throw ExecutionProblems.attemptFencingUnsupported(
        `Execution store must support atomic attempt fencing for execution '${executionId}'`,
      );
    }
    return this.store as ExecutionStore & ExecutionAttemptStore;
  }

  private async findRunningAttempt(token: ExecutionAttemptToken): Promise<Execution> {
    const execution = await this.findExisting(token.executionId);
    if (execution.status !== "running" || execution.attempts !== token.attempt) {
      return this.throwAttemptFenceConflict(token, "mutate running state");
    }
    return execution;
  }

  private async throwAttemptFenceConflict(
    token: ExecutionAttemptToken,
    operation: string,
  ): Promise<never> {
    const current = await this.findExisting(token.executionId);
    throw ExecutionProblems.attemptFenceConflict(
      `Attempt ${token.attempt} can no longer ${operation} for execution '${token.executionId}'; current attempt is ${current.attempts} and status is '${current.status}'`,
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
