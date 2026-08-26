import { describe, expect, it } from "vitest";
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
} from "../index";
import {
  ExecutionManagerImpl,
  ExecutionProblem,
  ExecutionProblems,
  InvalidContinuationLeaseDurationProblem,
  MAX_CONTINUATION_LEASE_DURATION_MS,
  MIN_CONTINUATION_LEASE_DURATION_MS,
  prepareExecutionCheckpoint,
} from "../index";

class InMemoryExecutionStore implements ExecutionStore, ExecutionContinuationStore {
  private execution?: Execution;

  async create(params: CreateExecutionParams): Promise<Execution> {
    this.execution = {
      id: "execution-1",
      type: params.type,
      status: "pending",
      attempts: 0,
      maxAttempts: params.maxAttempts ?? 1,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    return this.execution;
  }

  async findById(id: string): Promise<Execution | null> {
    return this.execution?.id === id ? this.execution : null;
  }

  async findByIdempotencyKey(): Promise<Execution | null> {
    return null;
  }

  async update(id: string, data: Partial<Execution>): Promise<Execution> {
    const execution = await this.required(id);
    this.execution = { ...execution, ...data };
    return this.execution;
  }

  async mergeCheckpoint(id: string, key: string, value: unknown): Promise<Execution> {
    if (this.execution?.id !== id) {
      throw ExecutionProblems.notFound(`Execution '${id}' not found`);
    }
    const checkpoint = prepareExecutionCheckpoint(key, value);
    this.execution = {
      ...this.execution,
      checkpoints: { ...this.execution.checkpoints, [key]: checkpoint.value },
    };
    return this.execution;
  }

  async updateIfStatus(
    id: string,
    expectedStatus: ExecutionStatus,
    data: Partial<Execution>,
  ): Promise<Execution | null> {
    const execution = await this.required(id);
    if (execution.status !== expectedStatus) return null;
    this.execution = { ...execution, ...data };
    return this.execution;
  }

  async listRunning(options: ListRunningExecutionsOptions): Promise<Execution[]> {
    const execution = this.execution;
    if (!execution || execution.status !== "running") return [];
    if (options.afterId !== undefined && execution.id <= options.afterId) return [];
    return [execution].slice(0, options.limit);
  }

  async list(_options?: ListExecutionsOptions): Promise<Execution[]> {
    return this.execution ? [this.execution] : [];
  }

  async delete(): Promise<void> {
    this.execution = undefined;
  }

  async acquireContinuation(
    id: string,
    input: AcquireExecutionContinuationInput,
  ): Promise<AcquireExecutionContinuationResult> {
    const execution = await this.required(id);
    const continuation = execution.continuation;
    const activeClaim = continuation?.claim;
    const leaseActive = activeClaim && activeClaim.expiresAt.getTime() > input.now.getTime();

    if (execution.status === "running" && leaseActive) {
      if (this.acceptsToken(continuation, input.deliveryToken)) {
        return {
          kind: "contended",
          execution,
          deliveryToken: input.deliveryToken,
          claim: activeClaim,
        };
      }
      return this.stale(execution, input.deliveryToken);
    }

    if (execution.status === "pending" && !continuation) {
      if (input.deliveryToken !== input.initialToken) {
        return this.stale(execution, input.deliveryToken);
      }

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
    const execution = await this.required(id);
    const continuation = execution.continuation;
    if (
      execution.status !== "running" ||
      !continuation?.claim ||
      continuation.claim.fencingToken !== input.fencingToken
    ) {
      return null;
    }

    this.execution = this.applyClaimedUpdate(
      execution,
      { ...continuation, claim: continuation.claim },
      input.update,
    );
    return this.execution;
  }

  private applyClaimedUpdate(
    execution: Execution,
    continuation: ExecutionContinuationState & { claim: ExecutionContinuationClaim },
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
    this.execution = {
      ...execution,
      status: "running",
      attempts: attempt,
      startedAt: execution.status === "running" ? execution.startedAt : input.now,
      completedAt: undefined,
      error: undefined,
      continuation: { ...continuation, attempt, claim },
    };

    if (kind === "publish_pending" && publication) {
      return { kind, execution: this.execution, claim, publication };
    }
    return { kind: "process", execution: this.execution, claim };
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

  private async required(id: string): Promise<Execution> {
    if (!this.execution || this.execution.id !== id) throw new Error("missing execution");
    return this.execution;
  }
}

function createHarness(maxAttempts = 3) {
  const store = new InMemoryExecutionStore();
  const tokens = ["attempt-2", "fence-1", "attempt-3", "fence-2", "unused", "fence-3"];
  let now = new Date("2026-01-01T00:00:00.000Z");
  const manager = new ExecutionManagerImpl(store, {
    clock: () => now,
    tokenGenerator: () => tokens.shift() ?? "fallback-token",
    continuationLeaseDurationMs: 1_000,
  });

  return {
    store,
    manager,
    create: () => manager.create({ type: "batch", maxAttempts }),
    advance: (milliseconds: number) => {
      now = new Date(now.getTime() + milliseconds);
    },
  };
}

function acquiredClaim(
  result: Awaited<ReturnType<ExecutionManagerImpl["claimContinuation"]>>,
): ExecutionContinuationClaim {
  if (result.kind !== "process" && result.kind !== "publish_pending") {
    throw new Error(`Expected acquired continuation, received ${result.kind}`);
  }
  return result.claim;
}

describe("ExecutionManagerImpl continuation claims", () => {
  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2_147_483_648])(
    "rejects invalid continuation lease duration %s before execution work",
    (continuationLeaseDurationMs) => {
      const store = new InMemoryExecutionStore();

      expect(() => new ExecutionManagerImpl(store, { continuationLeaseDurationMs })).toThrowError(
        expect.objectContaining({
          code: "execution/invalid-continuation-lease-duration",
          receivedValue: continuationLeaseDurationMs,
          minimumMs: MIN_CONTINUATION_LEASE_DURATION_MS,
          maximumMs: MAX_CONTINUATION_LEASE_DURATION_MS,
        }),
      );
    },
  );

  it.each([MIN_CONTINUATION_LEASE_DURATION_MS, MAX_CONTINUATION_LEASE_DURATION_MS])(
    "accepts continuation lease boundary %s",
    (continuationLeaseDurationMs) => {
      const manager = new ExecutionManagerImpl(new InMemoryExecutionStore(), {
        continuationLeaseDurationMs,
      });

      expect(manager.getContinuationLeaseDurationMs()).toBe(continuationLeaseDurationMs);
    },
  );

  it("exposes invalid continuation lease configuration as a typed Problem", () => {
    expect(() => {
      new ExecutionManagerImpl(new InMemoryExecutionStore(), {
        continuationLeaseDurationMs: Number.NEGATIVE_INFINITY,
      });
    }).toThrow(InvalidContinuationLeaseDurationProblem);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "preserves non-finite lease duration %s in serialized evidence",
    (continuationLeaseDurationMs) => {
      const problem = (() => {
        try {
          new ExecutionManagerImpl(new InMemoryExecutionStore(), {
            continuationLeaseDurationMs,
          });
        } catch (error) {
          return error;
        }
      })();

      expect(problem).toBeInstanceOf(InvalidContinuationLeaseDurationProblem);
      expect((problem as InvalidContinuationLeaseDurationProblem).receivedValue).toBe(
        continuationLeaseDurationMs,
      );
      expect((problem as InvalidContinuationLeaseDurationProblem).toJSON()).toMatchObject({
        receivedValue: String(continuationLeaseDurationMs),
      });
    },
  );

  it("omits absent continuation conflict evidence from Problem serialization", () => {
    const problem = ExecutionProblems.continuationConflict("claim lost", {
      currentWorkerId: undefined,
      currentStatus: "running",
    });

    expect(problem.toJSON()).toMatchObject({ currentStatus: "running" });
    expect(problem.toJSON()).not.toHaveProperty("currentWorkerId");
  });

  it("atomically starts the first attempt and records deterministic claim evidence", async () => {
    const { create, manager } = createHarness();
    const execution = await create();

    const result = await manager.claimContinuation(execution.id, {
      deliveryToken: "initial",
      workerId: "worker-a",
    });

    expect(result).toMatchObject({
      kind: "process",
      execution: { status: "running", attempts: 1 },
      claim: {
        fencingToken: "fence-1",
        processingToken: "attempt-2",
        workerId: "worker-a",
        attempt: 1,
        expiresAt: new Date("2026-01-01T00:00:01.000Z"),
      },
    });
  });

  it("reports contention without incrementing the active attempt", async () => {
    const { create, manager } = createHarness();
    const execution = await create();
    await manager.claimContinuation(execution.id, {
      deliveryToken: "initial",
      workerId: "worker-a",
    });

    const result = await manager.claimContinuation(execution.id, {
      deliveryToken: "initial",
      workerId: "worker-b",
    });

    expect(result.kind).toBe("contended");
    expect(result.execution.attempts).toBe(1);
  });

  it("keeps duplicate acquisition contended after the owner renews its lease", async () => {
    const { advance, create, manager } = createHarness();
    const execution = await create();
    const first = await manager.claimContinuation(execution.id, {
      deliveryToken: "initial",
      workerId: "worker-a",
    });
    advance(999);

    await manager.renewContinuationClaim(execution.id, acquiredClaim(first), {
      workerId: "worker-a",
    });
    advance(2);

    const duplicate = await manager.claimContinuation(execution.id, {
      deliveryToken: "initial",
      workerId: "worker-b",
    });

    expect(duplicate).toMatchObject({
      kind: "contended",
      execution: { attempts: 1 },
      claim: {
        workerId: "worker-a",
        expiresAt: new Date("2026-01-01T00:00:01.999Z"),
      },
    });
  });

  it("lets one owner reclaim an expired lease while fencing every stale mutation", async () => {
    const { advance, create, manager } = createHarness();
    const execution = await create();
    const first = await manager.claimContinuation(execution.id, {
      deliveryToken: "initial",
      workerId: "worker-a",
    });
    advance(1_001);
    const winner = await manager.claimContinuation(execution.id, {
      deliveryToken: "initial",
      workerId: "worker-b",
    });

    await expect(
      manager.stageContinuation(execution.id, acquiredClaim(first), {
        checkpoints: { cursor: 1 },
        nextToken: "next-1",
      }),
    ).rejects.toMatchObject({
      code: "execution/continuation-conflict",
      evidence: {
        currentWorkerId: "worker-b",
      },
    });
    await expect(
      manager.completeContinuation(execution.id, acquiredClaim(first)),
    ).rejects.toSatisfy(
      (problem: ExecutionProblem) => problem.toJSON().currentStatus === "running",
    );
    const conflict = await manager
      .renewContinuationClaim(execution.id, acquiredClaim(first), { workerId: "worker-a" })
      .catch((error: unknown) => error);
    expect(conflict).toBeInstanceOf(ExecutionProblem);
    const serializedConflict = JSON.stringify((conflict as ExecutionProblem).toJSON());
    expect(serializedConflict).not.toContain("fence-1");
    expect(serializedConflict).not.toContain("fence-2");
    expect(serializedConflict).not.toContain("initial");
    expect(serializedConflict).not.toContain("next-1");
    await expect(
      manager.renewContinuationClaim(execution.id, acquiredClaim(first), {
        workerId: "worker-a",
      }),
    ).rejects.toMatchObject({ code: "execution/continuation-conflict" });
    await expect(
      manager.confirmContinuationPublication(execution.id, acquiredClaim(first)),
    ).rejects.toMatchObject({ code: "execution/continuation-conflict" });
    await expect(
      manager.failContinuation(execution.id, acquiredClaim(first), {
        message: "late failure",
        retryable: true,
      }),
    ).rejects.toMatchObject({ code: "execution/continuation-conflict" });
    await expect(manager.get(execution.id)).resolves.toMatchObject({
      status: "running",
      attempts: 1,
      error: undefined,
      continuation: { claim: { fencingToken: "fence-2" } },
    });
    expect(winner.execution.attempts).toBe(1);
  });

  it("advances the expected token only after fenced publication confirmation", async () => {
    const { create, manager } = createHarness();
    const execution = await create();
    const result = await manager.claimContinuation(execution.id, {
      deliveryToken: "initial",
      workerId: "worker-a",
    });
    const claim = acquiredClaim(result);
    await manager.stageContinuation(execution.id, claim, {
      checkpoints: { cursor: 7, count: 7 },
      nextToken: "next-1",
    });

    const confirmed = await manager.confirmContinuationPublication(execution.id, claim);
    const duplicate = await manager.claimContinuation(execution.id, {
      deliveryToken: "initial",
      workerId: "worker-b",
    });

    expect(confirmed.checkpoints).toEqual({ cursor: 7, count: 7 });
    expect(confirmed.continuation).toEqual({ attempt: 1, expectedToken: "next-1" });
    expect(duplicate.kind).toBe("stale");
  });

  it("preserves the processing token when retrying the same checkpoint", async () => {
    const { create, manager } = createHarness();
    const execution = await create();
    const first = await manager.claimContinuation(execution.id, {
      deliveryToken: "initial",
      workerId: "worker-a",
    });
    await manager.failContinuation(execution.id, acquiredClaim(first), {
      message: "transient",
      retryable: true,
    });

    const retry = await manager.claimContinuation(execution.id, {
      deliveryToken: "initial",
      workerId: "worker-b",
    });
    const delayed = await manager.claimContinuation(execution.id, {
      deliveryToken: "initial",
      workerId: "worker-c",
    });

    expect(retry).toMatchObject({
      kind: "process",
      execution: { attempts: 2, error: undefined },
      claim: { attempt: 2, processingToken: "attempt-2" },
    });
    expect(delayed.kind).toBe("contended");
    expect(delayed.execution.attempts).toBe(2);
  });

  it("preserves the staged publication token on one retry claim", async () => {
    const { create, manager } = createHarness();
    const execution = await create();
    const first = await manager.claimContinuation(execution.id, {
      deliveryToken: "initial",
      workerId: "worker-a",
    });
    const firstClaim = acquiredClaim(first);
    await manager.stageContinuation(execution.id, firstClaim, {
      checkpoints: { cursor: 3 },
      nextToken: "old-next",
    });
    await manager.failContinuation(execution.id, firstClaim, {
      message: "publish failed",
      retryable: true,
    });

    const retry = await manager.claimContinuation(execution.id, {
      deliveryToken: "old-next",
      workerId: "worker-b",
    });

    expect(retry).toMatchObject({
      kind: "publish_pending",
      execution: { attempts: 2, checkpoints: { cursor: 3 } },
      publication: { attempt: 2, sourceToken: "initial", nextToken: "old-next" },
      claim: { attempt: 2, processingToken: "attempt-3" },
    });
  });

  it("fails explicitly when the store lacks atomic continuation support", async () => {
    const store = {
      create: async () => {
        throw new Error("unused");
      },
      findById: async () => null,
      findByIdempotencyKey: async () => null,
      update: async () => {
        throw new Error("unused");
      },
      mergeCheckpoint: async () => {
        throw ExecutionProblems.checkpointStoreConformance(
          "Unexpected checkpoint merge without atomic continuation support",
        );
      },
      updateIfStatus: async () => null,
      listRunning: async () => [],
      list: async () => [],
      delete: async () => undefined,
    } satisfies ExecutionStore;
    const manager = new ExecutionManagerImpl(store);

    await expect(
      manager.claimContinuation("execution-1", {
        deliveryToken: "initial",
        workerId: "worker-a",
      }),
    ).rejects.toMatchObject({ code: "execution/continuation-unsupported" });
  });
});
