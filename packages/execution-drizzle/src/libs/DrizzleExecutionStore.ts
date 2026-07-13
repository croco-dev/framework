import {
  type CreateExecutionParams,
  type Execution,
  type ExecutionLogEntry,
  type ExecutionLogStore,
  ExecutionProblems,
  type ExecutionStatus,
  ExecutionStore,
  type ListExecutionsOptions,
  type ListRunningExecutionsOptions,
} from "@croco/execution-core";
import { and, asc, eq, gt, isNull, sql } from "drizzle-orm";
import { ulid } from "ulid";
import type { ExecutionRow, NewExecutionRow } from "./schema";
import { executions } from "./schema";

type AwaitableQueryResult = PromiseLike<unknown>;

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
  };
}

/**
 * 실행 요청을 Drizzle 테이블에 저장하는 구현체입니다.
 */
export class DrizzleExecutionStore<TDb extends ExecutionDb>
  extends ExecutionStore
  implements ExecutionLogStore
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
  async create(params: CreateExecutionParams): Promise<Execution> {
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
      replayOf: params.replayOf ?? null,
      logs: params.logs ?? null,
      parentId: params.parentId ?? null,
      metadata: params.metadata ?? null,
      checkpoints: null,
      progress: null,
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
      replayOf: row.replayOf ?? undefined,
      logs: (row.logs as Execution["logs"]) ?? undefined,
      parentId: row.parentId ?? undefined,
      metadata: (row.metadata as Execution["metadata"]) ?? undefined,
      checkpoints: (row.checkpoints as Execution["checkpoints"]) ?? undefined,
      progress: (row.progress as Execution["progress"]) ?? undefined,
    };
  }

  private generateId(): string {
    return ulid();
  }
}
