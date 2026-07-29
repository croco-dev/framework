import {
  type AcquireExecutionContinuationInput,
  type AcquireExecutionContinuationResult,
  type CreateExecutionRecordParams,
  type Execution,
  type ExecutionContinuationClaim,
  type ExecutionContinuationState,
  type ExecutionContinuationStore,
  type ExecutionLogEntry,
  type ExecutionLogStore,
  ExecutionProblems,
  type ExecutionStatus,
  ExecutionStore,
  type ListExecutionsOptions,
  type ListRunningExecutionsOptions,
  type UpdateClaimedExecutionContinuationInput,
} from "@croco/execution-core";
import { and, asc, eq, gt, isNull, sql } from "drizzle-orm";
import { ulid } from "ulid";
import type { ExecutionRow, NewExecutionRow } from "./schema";
import { executions } from "./schema";

type AwaitableQueryResult = PromiseLike<unknown>;

function serializeCheckpoint(key: string, value: unknown): string {
  let checkpoint: string;
  try {
    checkpoint = JSON.stringify({ [key]: value });
  } catch {
    throw ExecutionProblems.checkpointStoreConformance(
      `Checkpoint '${key}' must contain a JSON-serializable value`,
    );
  }

  const serialized = JSON.parse(checkpoint) as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(serialized, key)) {
    throw ExecutionProblems.checkpointStoreConformance(
      `Checkpoint '${key}' must contain a JSON-serializable value`,
    );
  }
  return checkpoint;
}

type InsertQuery = {
  values(values: unknown): {
    onConflictDoNothing(config: { target: unknown }): {
      returning(): AwaitableQueryResult;
    };
    returning(): AwaitableQueryResult;
  };
};

type SelectOrderedQuery = {
  limit(limit: number): AwaitableQueryResult & {
    offset(offset: number): AwaitableQueryResult;
  };
};

type SelectFilteredQuery = {
  limit(limit: number): AwaitableQueryResult;
  orderBy(...values: unknown[]): SelectOrderedQuery;
};

type SelectQuery = {
  from(table: unknown): {
    where(condition: unknown): SelectFilteredQuery;
  };
};

type UpdateQuery = {
  set(values: unknown): {
    where(condition: unknown): {
      returning(): AwaitableQueryResult;
    };
  };
};

type DeleteQuery = {
  where(condition: unknown): {
    returning(): AwaitableQueryResult;
  };
};

type ExecutionDb = {
  select(): SelectQuery;
  insert(table: unknown): InsertQuery;
  update(table: unknown): UpdateQuery;
  delete(table: unknown): DeleteQuery;
};

function hasUpdateField(data: Partial<Execution>, key: keyof Execution): boolean {
  return Object.prototype.hasOwnProperty.call(data, key);
}

function toUpdateData(data: Partial<Execution>): Record<string, unknown> {
  return {
    ...(data.status !== undefined ? { status: data.status } : {}),
    ...(data.payload !== undefined ? { payload: data.payload } : {}),
    ...(data.result !== undefined ? { result: data.result } : {}),
    ...(hasUpdateField(data, "error") ? { error: data.error ?? null } : {}),
    ...(data.attempts !== undefined ? { attempts: data.attempts } : {}),
    ...(data.maxAttempts !== undefined ? { maxAttempts: data.maxAttempts } : {}),
    ...(data.startedAt !== undefined ? { startedAt: data.startedAt } : {}),
    ...(hasUpdateField(data, "completedAt") ? { completedAt: data.completedAt ?? null } : {}),
    ...(data.scheduledFor !== undefined ? { scheduledFor: data.scheduledFor } : {}),
    ...(data.timeout !== undefined ? { timeout: data.timeout } : {}),
    ...(data.replayOf !== undefined ? { replayOf: data.replayOf } : {}),
    ...(data.logs !== undefined ? { logs: data.logs } : {}),
    ...(data.metadata !== undefined ? { metadata: data.metadata } : {}),
    ...(data.checkpoints !== undefined ? { checkpoints: data.checkpoints } : {}),
    ...(data.progress !== undefined ? { progress: data.progress } : {}),
    ...(hasUpdateField(data, "continuation") ? { continuation: data.continuation ?? null } : {}),
  };
}

/**
 * 실행 요청을 Drizzle 테이블에 저장하는 구현체입니다.
 */
export class DrizzleExecutionStore<TDb extends ExecutionDb>
  extends ExecutionStore
  implements ExecutionLogStore, ExecutionContinuationStore
{
  /**
   * Drizzle 클라이언트를 받아 실행 저장소를 초기화합니다.
   */
  constructor(private readonly db: TDb) {
    super();
  }

  private get dbOp(): TDb {
    return this.db;
  }

  /**
   * 새 실행을 생성합니다. idempotencyKey가 있으면 중복 생성을 방지합니다.
   */
  async create(params: CreateExecutionRecordParams): Promise<Execution> {
    const existing = params.idempotencyKey
      ? await this.findByIdempotencyKey(params.idempotencyKey)
      : null;

    if (existing) {
      return existing;
    }

    const newExecution: NewExecutionRow = {
      id: this.generateId(),
      type: params.type,
      status: "pending",
      payload: params.payload ?? null,
      result: null,
      error: null,
      attempts: 0,
      maxAttempts: params.maxAttempts ?? 1,
      startedAt: null,
      completedAt: null,
      timeout: params.timeout ?? null,
      scheduledFor: params.scheduledFor ?? null,
      idempotencyKey: params.idempotencyKey ?? null,
      requestFingerprint: params.requestFingerprint,
      replayOf: params.replayOf ?? null,
      logs: params.logs ?? null,
      parentId: params.parentId ?? null,
      metadata: params.metadata ?? null,
      checkpoints: null,
      progress: null,
      continuation: null,
    };

    if (params.idempotencyKey) {
      const result = (await this.dbOp
        .insert(executions)
        .values(newExecution)
        .onConflictDoNothing({ target: executions.idempotencyKey })
        .returning()) as ExecutionRow[];

      if (result.length > 0) {
        return this.mapToExecution(result[0]);
      }

      const duplicated = await this.findByIdempotencyKey(params.idempotencyKey);
      if (duplicated) {
        return duplicated;
      }

      throw ExecutionProblems.conflict(
        `Execution with idempotency key '${params.idempotencyKey}' already exists`,
      );
    }

    const result = (await this.dbOp
      .insert(executions)
      .values(newExecution)
      .returning()) as ExecutionRow[];
    return this.mapToExecution(result[0]);
  }

  /**
   * 실행 ID로 단일 실행을 조회합니다.
   */
  async findById(id: string): Promise<Execution | null> {
    const result = (await this.dbOp
      .select()
      .from(executions)
      .where(eq(executions.id, id))
      .limit(1)) as ExecutionRow[];

    return result.length > 0 ? this.mapToExecution(result[0]) : null;
  }

  /**
   * idempotencyKey로 기존 실행을 조회합니다.
   */
  async findByIdempotencyKey(key: string): Promise<Execution | null> {
    const result = (await this.dbOp
      .select()
      .from(executions)
      .where(eq(executions.idempotencyKey, key))
      .limit(1)) as ExecutionRow[];

    return result.length > 0 ? this.mapToExecution(result[0]) : null;
  }

  /**
   * 실행 상태와 메타데이터를 부분 업데이트합니다.
   */
  async update(id: string, data: Partial<Execution>): Promise<Execution> {
    const updateData = toUpdateData(data);

    const result = (await this.dbOp
      .update(executions)
      .set(updateData)
      .where(eq(executions.id, id))
      .returning()) as ExecutionRow[];

    if (result.length === 0) {
      throw ExecutionProblems.notFound(`Execution with id '${id}' not found`);
    }

    return this.mapToExecution(result[0]);
  }

  /**
   * 현재 상태가 예상 상태와 일치할 때만 실행을 원자적으로 업데이트합니다.
   */
  async updateIfStatus(
    id: string,
    expectedStatus: ExecutionStatus,
    data: Partial<Execution>,
  ): Promise<Execution | null> {
    const result = (await this.dbOp
      .update(executions)
      .set(toUpdateData(data))
      .where(and(eq(executions.id, id), eq(executions.status, expectedStatus)))
      .returning()) as ExecutionRow[];

    return result.length > 0 ? this.mapToExecution(result[0]) : null;
  }

  /**
   * 실행 중 레코드를 ID 기준 키셋 순서로 조회합니다.
   */
  async listRunning(options: ListRunningExecutionsOptions): Promise<Execution[]> {
    const condition = options.afterId
      ? and(eq(executions.status, "running"), gt(executions.id, options.afterId))
      : eq(executions.status, "running");
    const result = (await this.dbOp
      .select()
      .from(executions)
      .where(condition)
      .orderBy(asc(executions.id))
      .limit(options.limit)) as ExecutionRow[];

    return result.map((row) => this.mapToExecution(row));
  }

  /**
   * 실행 로그를 원자적으로 추가합니다.
   */
  async appendLog(id: string, entry: ExecutionLogEntry): Promise<Execution> {
    const result = (await this.dbOp
      .update(executions)
      .set({
        logs: sql`coalesce(${executions.logs}, '[]'::jsonb) || ${JSON.stringify([entry])}::jsonb`,
      })
      .where(eq(executions.id, id))
      .returning()) as ExecutionRow[];

    if (result.length === 0) {
      throw ExecutionProblems.notFound(`Execution with id '${id}' not found`);
    }

    return this.mapToExecution(result[0]);
  }

  /**
   * 체크포인트 키 하나를 원자적으로 병합합니다.
   */
  async mergeCheckpoint(id: string, key: string, value: unknown): Promise<Execution> {
    const checkpoint = serializeCheckpoint(key, value);
    const result = (await this.dbOp
      .update(executions)
      .set({
        checkpoints: sql`(coalesce(${executions.checkpoints}::jsonb, '{}'::jsonb) || ${checkpoint}::jsonb)::json`,
      })
      .where(eq(executions.id, id))
      .returning()) as ExecutionRow[];

    if (result.length === 0) {
      throw ExecutionProblems.notFound(`Execution with id '${id}' not found`);
    }

    return this.mapToExecution(result[0]);
  }

  /**
   * 전달 토큰과 현재 continuation 상태를 비교해 실행 소유권을 원자적으로 획득합니다.
   */
  async acquireContinuation(
    id: string,
    input: AcquireExecutionContinuationInput,
  ): Promise<AcquireExecutionContinuationResult> {
    return this.acquireContinuationCas(id, input, true);
  }

  private async acquireContinuationCas(
    id: string,
    input: AcquireExecutionContinuationInput,
    retryOnCasLoss: boolean,
  ): Promise<AcquireExecutionContinuationResult> {
    const row = await this.findRowById(id);
    if (!row) {
      throw ExecutionProblems.notFound(`Execution with id '${id}' not found`);
    }

    const execution = this.mapToExecution(row);
    const continuation = execution.continuation;
    const activeClaim = continuation?.claim;
    if (execution.status === "running" && activeClaim && activeClaim.expiresAt > input.now) {
      return this.acceptsToken(continuation, input.deliveryToken)
        ? {
            kind: "contended",
            execution,
            deliveryToken: input.deliveryToken,
            claim: activeClaim,
          }
        : this.stale(execution, input.deliveryToken);
    }

    let attempt: number;
    let processingToken: string;
    let nextContinuation: ExecutionContinuationState;
    let publication: ExecutionContinuationState["pendingPublication"];

    if (execution.status === "pending" && !continuation) {
      if (input.deliveryToken !== input.initialToken) {
        return this.stale(execution, input.deliveryToken);
      }
      attempt = 1;
      processingToken = input.proposedAttemptToken;
      nextContinuation = { attempt, expectedToken: input.initialToken };
    } else if (execution.status === "retrying" && continuation?.pendingPublication) {
      publication = continuation.pendingPublication;
      if (
        input.deliveryToken !== publication.sourceToken &&
        input.deliveryToken !== publication.nextToken
      ) {
        return this.stale(execution, input.deliveryToken);
      }
      attempt = execution.attempts + 1;
      processingToken = input.proposedAttemptToken;
      publication = { ...publication, attempt };
      nextContinuation = {
        ...continuation,
        attempt,
        expectedToken: publication.nextToken,
        retrySourceToken: undefined,
        pendingPublication: publication,
      };
    } else if (execution.status === "retrying" && continuation?.retrySourceToken) {
      if (!continuation.expectedToken || input.deliveryToken !== continuation.expectedToken) {
        return this.stale(execution, input.deliveryToken);
      }
      attempt = execution.attempts + 1;
      processingToken = continuation.retrySourceToken;
      nextContinuation = { attempt, expectedToken: continuation.expectedToken };
    } else if (execution.status === "running" && continuation) {
      if (!this.acceptsToken(continuation, input.deliveryToken)) {
        return this.stale(execution, input.deliveryToken);
      }
      attempt = execution.attempts;
      processingToken =
        continuation.claim?.processingToken ??
        continuation.pendingPublication?.nextToken ??
        continuation.expectedToken ??
        input.deliveryToken;
      publication = continuation.pendingPublication;
      nextContinuation = continuation;
    } else {
      return this.stale(execution, input.deliveryToken);
    }

    const claim: ExecutionContinuationClaim = {
      fencingToken: input.fencingToken,
      processingToken,
      workerId: input.workerId,
      attempt,
      expiresAt: new Date(input.now.getTime() + input.leaseDurationMs),
    };
    nextContinuation = { ...nextContinuation, attempt, claim };

    const result = (await this.dbOp
      .update(executions)
      .set({
        status: "running",
        attempts: attempt,
        ...(execution.status === "running" ? {} : { startedAt: input.now }),
        completedAt: null,
        error: null,
        continuation: nextContinuation,
      })
      .where(this.compareContinuation(row))
      .returning()) as ExecutionRow[];

    if (result.length === 0) {
      if (retryOnCasLoss) {
        return this.acquireContinuationCas(id, input, false);
      }

      const latest = await this.findRowById(id);
      if (!latest) {
        throw ExecutionProblems.notFound(`Execution with id '${id}' not found`);
      }
      const latestExecution = this.mapToExecution(latest);
      const latestClaim = latestExecution.continuation?.claim;
      if (
        latestExecution.status === "running" &&
        latestClaim &&
        latestClaim.expiresAt > input.now &&
        latestExecution.continuation &&
        this.acceptsToken(latestExecution.continuation, input.deliveryToken)
      ) {
        return {
          kind: "contended",
          execution: latestExecution,
          deliveryToken: input.deliveryToken,
          claim: latestClaim,
        };
      }
      return this.stale(latestExecution, input.deliveryToken);
    }

    const acquired = this.mapToExecution(result[0]);
    return publication
      ? { kind: "publish_pending", execution: acquired, claim, publication }
      : { kind: "process", execution: acquired, claim };
  }

  /**
   * fencing token이 현재 claim과 일치할 때만 continuation 상태를 갱신합니다.
   */
  async updateClaimedContinuation(
    id: string,
    input: UpdateClaimedExecutionContinuationInput,
  ): Promise<Execution | null> {
    const row = await this.findRowById(id);
    if (!row) {
      throw ExecutionProblems.notFound(`Execution with id '${id}' not found`);
    }

    const execution = this.mapToExecution(row);
    const continuation = execution.continuation;
    const claim = continuation?.claim;
    if (
      execution.status !== "running" ||
      !continuation ||
      !claim ||
      claim.fencingToken !== input.fencingToken
    ) {
      return null;
    }

    const values: Partial<ExecutionRow> = {};
    switch (input.update.kind) {
      case "renew":
        values.continuation = {
          ...continuation,
          claim: {
            ...claim,
            workerId: input.update.workerId,
            expiresAt: input.update.expiresAt,
          },
        };
        break;
      case "stage":
        if (!continuation.expectedToken) return null;
        values.checkpoints = input.update.checkpoints;
        values.continuation = {
          ...continuation,
          pendingPublication: {
            attempt: claim.attempt,
            sourceToken: continuation.expectedToken,
            nextToken: input.update.nextToken,
          },
        };
        break;
      case "confirm_publication": {
        const pending = continuation.pendingPublication;
        values.continuation = pending
          ? { attempt: continuation.attempt, expectedToken: pending.nextToken }
          : continuation;
        break;
      }
      case "complete":
        values.status = "completed";
        values.result = input.update.result ?? null;
        values.completedAt = input.update.completedAt;
        values.continuation = { ...continuation, claim: undefined };
        break;
      case "fail": {
        const retrying = input.update.error.retryable && execution.attempts < execution.maxAttempts;
        values.status = retrying ? "retrying" : "failed";
        values.error = input.update.error;
        values.completedAt = retrying ? null : input.update.failedAt;
        values.continuation = {
          ...continuation,
          claim: undefined,
          retrySourceToken: continuation.pendingPublication ? undefined : claim.processingToken,
        };
        break;
      }
    }

    const result = (await this.dbOp
      .update(executions)
      .set(values)
      .where(this.compareContinuation(row))
      .returning()) as ExecutionRow[];

    return result.length > 0 ? this.mapToExecution(result[0]) : null;
  }

  /**
   * 상태, 타입, 부모 실행 조건으로 실행 목록을 조회합니다.
   */
  async list(options: ListExecutionsOptions = {}): Promise<Execution[]> {
    const conditions = [];

    if (options.status) {
      conditions.push(eq(executions.status, options.status));
    }

    if (options.type) {
      conditions.push(eq(executions.type, options.type));
    }

    if (options.parentId !== undefined) {
      conditions.push(
        options.parentId === null
          ? isNull(executions.parentId)
          : eq(executions.parentId, options.parentId),
      );
    }

    if (options.replayOf !== undefined) {
      conditions.push(
        options.replayOf === null
          ? isNull(executions.replayOf)
          : eq(executions.replayOf, options.replayOf),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const query = this.dbOp
      .select()
      .from(executions)
      .where(whereClause)
      .orderBy(asc(executions.createdAt))
      .limit(options.limit ?? 100);

    const queryWithOffset = options.offset !== undefined ? query.offset(options.offset) : query;

    const result = (await queryWithOffset) as ExecutionRow[];

    return result.map((row: ExecutionRow) => this.mapToExecution(row));
  }

  /**
   * 실행을 삭제합니다.
   */
  async delete(id: string): Promise<void> {
    const result = (await this.dbOp
      .delete(executions)
      .where(eq(executions.id, id))
      .returning()) as ExecutionRow[];

    if (result.length === 0) {
      throw ExecutionProblems.notFound(`Execution with id '${id}' not found`);
    }
  }

  private mapToExecution(row: ExecutionRow): Execution {
    return {
      id: row.id,
      type: row.type,
      status: row.status,
      payload: row.payload ?? undefined,
      result: row.result ?? undefined,
      error: (row.error as Execution["error"]) ?? undefined,
      attempts: row.attempts,
      maxAttempts: row.maxAttempts,
      createdAt: row.createdAt,
      startedAt: row.startedAt ?? undefined,
      completedAt: row.completedAt ?? undefined,
      scheduledFor: row.scheduledFor ?? undefined,
      timeout: row.timeout ?? undefined,
      idempotencyKey: row.idempotencyKey ?? undefined,
      requestFingerprint: row.requestFingerprint ?? undefined,
      replayOf: row.replayOf ?? undefined,
      logs: (row.logs as Execution["logs"]) ?? undefined,
      parentId: row.parentId ?? undefined,
      metadata: (row.metadata as Execution["metadata"]) ?? undefined,
      checkpoints: (row.checkpoints as Execution["checkpoints"]) ?? undefined,
      progress: (row.progress as Execution["progress"]) ?? undefined,
      continuation: this.mapContinuation(row.continuation),
    };
  }

  private async findRowById(id: string): Promise<ExecutionRow | null> {
    const result = (await this.dbOp
      .select()
      .from(executions)
      .where(eq(executions.id, id))
      .limit(1)) as ExecutionRow[];
    return result[0] ?? null;
  }

  private compareContinuation(row: ExecutionRow): unknown {
    const continuationMatches =
      row.continuation === null || row.continuation === undefined
        ? isNull(executions.continuation)
        : sql`${executions.continuation} = ${JSON.stringify(row.continuation)}::jsonb`;
    return and(eq(executions.id, row.id), eq(executions.status, row.status), continuationMatches);
  }

  private mapContinuation(
    continuation: ExecutionRow["continuation"],
  ): ExecutionContinuationState | undefined {
    if (!continuation) return undefined;
    return {
      ...continuation,
      claim: continuation.claim
        ? {
            ...continuation.claim,
            expiresAt:
              continuation.claim.expiresAt instanceof Date
                ? continuation.claim.expiresAt
                : new Date(continuation.claim.expiresAt),
          }
        : undefined,
    };
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

  private generateId(): string {
    return ulid();
  }
}
