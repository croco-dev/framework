import {
  type CreateExecutionParams,
  type Execution,
  ExecutionProblems,
  type ExecutionStore,
  type ListExecutionsOptions,
} from '@croco/execution-core';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { ulid } from 'ulid';
import type { ExecutionRow, NewExecutionRow } from './schema';
import { executions } from './schema';

export class DrizzleExecutionStore<TDb extends Record<string, unknown>> implements ExecutionStore {
  constructor(private readonly db: TDb) {}

  private get dbOp(): any {
    return this.db;
  }

  async create(params: CreateExecutionParams): Promise<Execution> {
    const existing = params.idempotencyKey ? await this.findByIdempotencyKey(params.idempotencyKey) : null;

    if (existing) {
      return existing;
    }

    const newExecution: NewExecutionRow = {
      id: this.generateId(),
      type: params.type,
      status: 'pending',
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
      parentId: params.parentId ?? null,
      metadata: params.metadata ?? null,
      checkpoints: null,
      progress: null,
    };

    let result: ExecutionRow[];

    try {
      result = (await this.dbOp.insert(executions).values(newExecution).returning()) as ExecutionRow[];
    } catch (error) {
      if (params.idempotencyKey && this.isIdempotencyConstraintError(error)) {
        const duplicated = await this.findByIdempotencyKey(params.idempotencyKey);
        if (duplicated) {
          return duplicated;
        }

        throw ExecutionProblems.conflict(`Execution with idempotency key '${params.idempotencyKey}' already exists`);
      }

      throw error;
    }

    return this.mapToExecution(result[0]);
  }

  async findById(id: string): Promise<Execution | null> {
    const result = (await this.dbOp.select().from(executions).where(eq(executions.id, id)).limit(1)) as ExecutionRow[];

    return result.length > 0 ? this.mapToExecution(result[0]) : null;
  }

  async findByIdempotencyKey(key: string): Promise<Execution | null> {
    const result = (await this.dbOp
      .select()
      .from(executions)
      .where(eq(executions.idempotencyKey, key))
      .limit(1)) as ExecutionRow[];

    return result.length > 0 ? this.mapToExecution(result[0]) : null;
  }

  async update(id: string, data: Partial<Execution>): Promise<Execution> {
    const result = (await this.dbOp
      .update(executions)
      .set({
        status: data.status,
        payload: data.payload ?? null,
        result: data.result ?? null,
        error: data.error ?? null,
        attempts: data.attempts,
        maxAttempts: data.maxAttempts,
        startedAt: data.startedAt ?? null,
        completedAt: data.completedAt ?? null,
        scheduledFor: data.scheduledFor ?? null,
        timeout: data.timeout ?? null,
        metadata: data.metadata ?? null,
        checkpoints: data.checkpoints ?? null,
        progress: data.progress ?? null,
      })
      .where(eq(executions.id, id))
      .returning()) as ExecutionRow[];

    if (result.length === 0) {
      throw ExecutionProblems.notFound(`Execution with id '${id}' not found`);
    }

    return this.mapToExecution(result[0]);
  }

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
        options.parentId === null ? isNull(executions.parentId) : eq(executions.parentId, options.parentId)
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

  async delete(id: string): Promise<void> {
    const result = (await this.dbOp.delete(executions).where(eq(executions.id, id)).returning()) as ExecutionRow[];

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
      error: (row.error as Execution['error']) ?? undefined,
      attempts: row.attempts,
      maxAttempts: row.maxAttempts,
      createdAt: row.createdAt,
      startedAt: row.startedAt ?? undefined,
      completedAt: row.completedAt ?? undefined,
      scheduledFor: row.scheduledFor ?? undefined,
      timeout: row.timeout ?? undefined,
      idempotencyKey: row.idempotencyKey ?? undefined,
      parentId: row.parentId ?? undefined,
      metadata: (row.metadata as Execution['metadata']) ?? undefined,
      checkpoints: (row.checkpoints as Execution['checkpoints']) ?? undefined,
      progress: (row.progress as Execution['progress']) ?? undefined,
    };
  }

  private generateId(): string {
    return ulid();
  }

  private isIdempotencyConstraintError(error: unknown): boolean {
    if (typeof error === 'object' && error !== null) {
      const code = Reflect.get(error, 'code');
      const constraint = Reflect.get(error, 'constraint');

      if (code === '23505' && typeof constraint === 'string' && constraint.includes('idempotency_key')) {
        return true;
      }
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return message.includes('idempotency') || message.includes('duplicate key');
    }

    return false;
  }
}
