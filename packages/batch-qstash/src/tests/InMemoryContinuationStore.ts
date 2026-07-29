import type {
  AcquireExecutionContinuationInput,
  AcquireExecutionContinuationResult,
  ClaimedExecutionContinuationUpdate,
  CreateExecutionParams,
  Execution,
  ExecutionContinuationClaim,
  ExecutionContinuationState,
  ExecutionContinuationStore,
  ExecutionStatus,
  ExecutionStore,
  ListExecutionsOptions,
  ListRunningExecutionsOptions,
  UpdateClaimedExecutionContinuationInput,
} from "@croco/execution-core";
import { ExecutionProblems } from "@croco/execution-core";

export class InMemoryContinuationStore implements ExecutionStore, ExecutionContinuationStore {
  private readonly executions = new Map<string, Execution>();
  private nextId = 1;

  async create(params: CreateExecutionParams): Promise<Execution> {
    const execution: Execution = {
      id: `execution-${this.nextId++}`,
      type: params.type,
      status: "pending",
      attempts: 0,
      maxAttempts: params.maxAttempts ?? 1,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    this.executions.set(execution.id, execution);
    return execution;
  }

  async findById(id: string): Promise<Execution | null> {
    return this.executions.get(id) ?? null;
  }

  async findByIdempotencyKey(): Promise<Execution | null> {
    return null;
  }

  async update(id: string, data: Partial<Execution>): Promise<Execution> {
    const execution = this.required(id);
    const updated = { ...execution, ...data };
    this.executions.set(id, updated);
    return updated;
  }

  async mergeCheckpoint(id: string, key: string, value: unknown): Promise<Execution> {
    const execution = this.required(id);
    return this.update(id, {
      checkpoints: { ...execution.checkpoints, [key]: value },
    });
  }

  async updateIfStatus(
    id: string,
    expectedStatus: ExecutionStatus,
    data: Partial<Execution>,
  ): Promise<Execution | null> {
    const execution = this.required(id);
    if (execution.status !== expectedStatus) return null;
    const updated = { ...execution, ...data };
    this.executions.set(id, updated);
    return updated;
  }

  async listRunning(options: ListRunningExecutionsOptions): Promise<Execution[]> {
    return [...this.executions.values()]
      .filter(
        (execution) =>
          execution.status === "running" &&
          (options.afterId === undefined || execution.id > options.afterId),
      )
      .sort((left, right) => left.id.localeCompare(right.id))
      .slice(0, options.limit);
  }

  async list(_options?: ListExecutionsOptions): Promise<Execution[]> {
    return [...this.executions.values()];
  }

  async delete(id: string): Promise<void> {
    this.executions.delete(id);
  }

  async acquireContinuation(
    id: string,
    input: AcquireExecutionContinuationInput,
  ): Promise<AcquireExecutionContinuationResult> {
    const execution = this.required(id);
    const continuation = execution.continuation;
    const activeClaim = continuation?.claim;
    const leaseActive = activeClaim && activeClaim.expiresAt.getTime() > input.now.getTime();

    if (execution.status === "running" && leaseActive) {
      return this.acceptsToken(continuation, input.deliveryToken)
        ? {
            kind: "contended",
            execution,
            deliveryToken: input.deliveryToken,
            claim: activeClaim,
          }
        : this.stale(execution, input.deliveryToken);
    }
    if (execution.status === "pending" && !continuation) {
      if (input.deliveryToken !== input.initialToken)
        return this.stale(execution, input.deliveryToken);
      return this.acquire(execution, input, input.proposedAttemptToken, 1, "process", {
        attempt: 1,
        expectedToken: input.initialToken,
      });
    }
    if (execution.status === "retrying" && continuation?.pendingPublication) {
      const pending = continuation.pendingPublication;
      if (
        input.deliveryToken !== pending.sourceToken &&
        input.deliveryToken !== pending.nextToken
      ) {
        return this.stale(execution, input.deliveryToken);
      }
      const attempt = execution.attempts + 1;
      const rotated = {
        ...pending,
        attempt,
      };
      return this.acquire(
        execution,
        input,
        input.proposedAttemptToken,
        attempt,
        "publish_pending",
        {
          ...continuation,
          attempt,
          expectedToken: pending.nextToken,
          retrySourceToken: undefined,
          pendingPublication: rotated,
        },
        rotated,
      );
    }
    if (execution.status === "retrying" && continuation?.retrySourceToken) {
      if (!continuation.expectedToken || input.deliveryToken !== continuation.expectedToken) {
        return this.stale(execution, input.deliveryToken);
      }
      const attempt = execution.attempts + 1;
      return this.acquire(execution, input, continuation.retrySourceToken, attempt, "process", {
        attempt,
        expectedToken: continuation.expectedToken,
      });
    }
    if (execution.status === "running" && continuation) {
      if (!this.acceptsToken(continuation, input.deliveryToken)) {
        return this.stale(execution, input.deliveryToken);
      }
      const processingToken =
        continuation.claim?.processingToken ??
        continuation.pendingPublication?.nextToken ??
        continuation.expectedToken ??
        input.deliveryToken;
      const kind = continuation.pendingPublication ? "publish_pending" : "process";
      return this.acquire(
        execution,
        input,
        processingToken,
        execution.attempts,
        kind,
        continuation,
        continuation.pendingPublication,
      );
    }
    return this.stale(execution, input.deliveryToken);
  }

  async updateClaimedContinuation(
    id: string,
    input: UpdateClaimedExecutionContinuationInput,
  ): Promise<Execution | null> {
    const execution = this.required(id);
    const continuation = execution.continuation;
    if (
      execution.status !== "running" ||
      !continuation?.claim ||
      continuation.claim.fencingToken !== input.fencingToken
    ) {
      return null;
    }
    const updated = this.applyUpdate(
      execution,
      { ...continuation, claim: continuation.claim },
      input.update,
    );
    this.executions.set(id, updated);
    return updated;
  }

  private applyUpdate(
    execution: Execution,
    continuation: ExecutionContinuationState & {
      claim: ExecutionContinuationClaim;
    },
    update: ClaimedExecutionContinuationUpdate,
  ): Execution {
    switch (update.kind) {
      case "renew":
        return {
          ...execution,
          continuation: {
            ...continuation,
            claim: {
              ...continuation.claim,
              workerId: update.workerId,
              expiresAt: update.expiresAt,
            },
          },
        };
      case "stage":
        if (!continuation.expectedToken) throw new Error("Missing continuation expected token");
        return {
          ...execution,
          checkpoints: update.checkpoints,
          continuation: {
            ...continuation,
            pendingPublication: {
              attempt: continuation.claim.attempt,
              sourceToken: continuation.expectedToken,
              nextToken: update.nextToken,
            },
          },
        };
      case "confirm_publication": {
        const pending = continuation.pendingPublication;
        if (!pending) return execution;
        return {
          ...execution,
          continuation: {
            attempt: continuation.attempt,
            expectedToken: pending.nextToken,
          },
        };
      }
      case "complete":
        return {
          ...execution,
          status: "completed",
          result: update.result,
          completedAt: update.completedAt,
          continuation: { ...continuation, claim: undefined },
        };
      case "fail": {
        const retrying = update.error.retryable && execution.attempts < execution.maxAttempts;
        return {
          ...execution,
          status: retrying ? "retrying" : "failed",
          error: update.error,
          completedAt: retrying ? undefined : update.failedAt,
          continuation: {
            ...continuation,
            claim: undefined,
            retrySourceToken: continuation.pendingPublication
              ? undefined
              : continuation.claim.processingToken,
          },
        };
      }
    }
  }

  private acquire(
    execution: Execution,
    input: AcquireExecutionContinuationInput,
    processingToken: string,
    attempt: number,
    kind: "process" | "publish_pending",
    continuation: ExecutionContinuationState,
    publication?: ExecutionContinuationState["pendingPublication"],
  ): AcquireExecutionContinuationResult {
    const claim: ExecutionContinuationClaim = {
      fencingToken: input.fencingToken,
      processingToken,
      workerId: input.workerId,
      attempt,
      expiresAt: new Date(input.now.getTime() + input.leaseDurationMs),
    };
    const updated: Execution = {
      ...execution,
      status: "running",
      attempts: attempt,
      startedAt: execution.status === "running" ? execution.startedAt : input.now,
      completedAt: undefined,
      error: undefined,
      continuation: { ...continuation, attempt, claim },
    };
    this.executions.set(execution.id, updated);
    return kind === "publish_pending" && publication
      ? { kind, execution: updated, claim, publication }
      : { kind: "process", execution: updated, claim };
  }

  private acceptsToken(continuation: ExecutionContinuationState, token: string): boolean {
    return (
      continuation.expectedToken === token ||
      continuation.pendingPublication?.sourceToken === token ||
      continuation.pendingPublication?.nextToken === token
    );
  }

  private stale(execution: Execution, deliveryToken: string): AcquireExecutionContinuationResult {
    return {
      kind: "stale",
      execution,
      deliveryToken,
      expectedToken:
        execution.continuation?.pendingPublication?.nextToken ??
        execution.continuation?.expectedToken,
    };
  }

  private required(id: string): Execution {
    const execution = this.executions.get(id);
    if (!execution) {
      throw ExecutionProblems.notFound(`Execution with id '${id}' not found`);
    }
    return execution;
  }
}
