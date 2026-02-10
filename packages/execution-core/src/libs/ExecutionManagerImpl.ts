import { ExecutionProblems } from './ExecutionProblem';
import type { ExecutionManager } from './interfaces/ExecutionManager';
import type { ExecutionStore } from './interfaces/ExecutionStore';
import type { CreateExecutionParams, Execution, ExecutionError, ExecutionStatus, ProgressInfo } from './types';

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
  pending: ['running', 'cancelled'],
  running: ['completed', 'failed', 'timed_out', 'cancelled', 'retrying'],
  completed: [],
  failed: ['retrying'],
  cancelled: [],
  retrying: ['running', 'failed'],
  timed_out: ['retrying'],
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
export class ExecutionManagerImpl implements ExecutionManager {
  constructor(private readonly store: ExecutionStore) {}

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
    const execution = await this.store.findById(id);

    if (!execution) {
      throw ExecutionProblems.notFound(`Execution with id '${id}' not found`);
    }

    // Allow: pending → running, retrying → running
    const targetStatus: ExecutionStatus = 'running';
    validateTransition(execution.status, targetStatus);

    const now = new Date();
    const startedAt = execution.status === 'pending' ? now : execution.startedAt;
    const attempts = execution.attempts + 1;

    // Check if timeout exceeded
    if (execution.timeout && startedAt) {
      const elapsed = now.getTime() - startedAt.getTime();
      if (elapsed > execution.timeout) {
        return this.timeout(id);
      }
    }

    return this.store.update(id, {
      status: targetStatus,
      startedAt,
      attempts,
    });
  }

  async complete(id: string, result?: unknown): Promise<Execution> {
    const execution = await this.store.findById(id);

    if (!execution) {
      throw ExecutionProblems.notFound(`Execution with id '${id}' not found`);
    }

    validateTransition(execution.status, 'completed');

    return this.store.update(id, {
      status: 'completed',
      result,
      completedAt: new Date(),
    });
  }

  async fail(id: string, error: ExecutionError): Promise<Execution> {
    const execution = await this.store.findById(id);

    if (!execution) {
      throw ExecutionProblems.notFound(`Execution with id '${id}' not found`);
    }

    // Check if should retry
    if (error.retryable && execution.attempts < execution.maxAttempts) {
      return this.store.update(id, {
        status: 'retrying',
        error,
      });
    }

    // Max attempts exhausted or not retryable
    validateTransition(execution.status, 'failed');

    return this.store.update(id, {
      status: 'failed',
      error,
      completedAt: new Date(),
    });
  }

  async cancel(id: string, reason?: string): Promise<Execution> {
    const execution = await this.store.findById(id);

    if (!execution) {
      throw ExecutionProblems.notFound(`Execution with id '${id}' not found`);
    }

    validateTransition(execution.status, 'cancelled');

    const metadata = reason ? { ...(execution.metadata ?? {}), cancellationReason: reason } : execution.metadata;

    return this.store.update(id, {
      status: 'cancelled',
      completedAt: new Date(),
      metadata,
    });
  }

  async retry(id: string): Promise<Execution> {
    const execution = await this.store.findById(id);

    if (!execution) {
      throw ExecutionProblems.notFound(`Execution with id '${id}' not found`);
    }

    if (execution.attempts >= execution.maxAttempts) {
      throw ExecutionProblems.maxRetriesExceeded('Maximum retry attempts exceeded');
    }

    // Allow: failed → retrying, timed_out → retrying
    const targetStatus: ExecutionStatus = 'retrying';
    validateTransition(execution.status, targetStatus);

    return this.store.update(id, {
      status: targetStatus,
      attempts: execution.attempts + 1,
      error: undefined, // Clear previous error
    });
  }

  async updateProgress(id: string, progress: ProgressInfo): Promise<Execution> {
    const execution = await this.store.findById(id);

    if (!execution) {
      throw ExecutionProblems.notFound(`Execution with id '${id}' not found`);
    }

    const percent = progress.percent ?? calculatePercent(progress.current, progress.total);

    return this.store.update(id, {
      progress: {
        ...progress,
        percent,
      },
    });
  }

  async checkpoint(id: string, key: string, value: unknown): Promise<Execution> {
    const execution = await this.store.findById(id);

    if (!execution) {
      throw ExecutionProblems.notFound(`Execution with id '${id}' not found`);
    }

    return this.store.update(id, {
      checkpoints: {
        ...(execution.checkpoints ?? {}),
        [key]: value,
      },
    });
  }

  async timeout(id: string): Promise<Execution> {
    const execution = await this.store.findById(id);

    if (!execution) {
      throw ExecutionProblems.notFound(`Execution with id '${id}' not found`);
    }

    validateTransition(execution.status, 'timed_out');

    return this.store.update(id, {
      status: 'timed_out',
      completedAt: new Date(),
      error: {
        message: 'Execution timed out',
        retryable: true,
      },
    });
  }
}
