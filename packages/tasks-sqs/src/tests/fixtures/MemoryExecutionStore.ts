import { ExecutionStore, ExecutionProblems } from "@croco/execution-core";
import { fixedClock } from "@croco/testing";
import type {
  CreateExecutionRecordParams,
  Execution,
  ExecutionLogEntry,
  ExecutionStatus,
  ListRunningExecutionsOptions,
  ListExecutionsOptions,
} from "@croco/execution-core";

// croco-test-clock: controlled
export class MemoryExecutionStore extends ExecutionStore {
  private readonly clock = fixedClock("2026-11-01T00:00:00Z");
  private readonly executions = new Map<string, Execution>();
  private sequence = 0;

  async create(params: CreateExecutionRecordParams): Promise<Execution> {
    if (params.idempotencyKey) {
      const existing = [...this.executions.values()].find(
        (item) => item.idempotencyKey === params.idempotencyKey,
      );
      if (existing) return existing;
    }
    const execution: Execution = {
      id: `exec-${String(++this.sequence).padStart(4, "0")}`,
      type: params.type,
      status: "pending",
      attempts: 0,
      maxAttempts: params.maxAttempts ?? 1,
      createdAt: this.clock.now,
      ...(params.payload !== undefined ? { payload: params.payload } : {}),
      ...(params.timeout !== undefined ? { timeout: params.timeout } : {}),
      ...(params.idempotencyKey !== undefined ? { idempotencyKey: params.idempotencyKey } : {}),
      requestFingerprint: params.requestFingerprint,
      ...(params.parentId !== undefined ? { parentId: params.parentId } : {}),
      ...(params.metadata !== undefined ? { metadata: params.metadata } : {}),
    };
    this.executions.set(execution.id, execution);
    return execution;
  }

  async findById(id: string): Promise<Execution | null> {
    return this.executions.get(id) ?? null;
  }

  async findByIdempotencyKey(key: string): Promise<Execution | null> {
    return (
      [...this.executions.values()].find((execution) => execution.idempotencyKey === key) ?? null
    );
  }

  async update(id: string, data: Partial<Execution>): Promise<Execution> {
    const current = this.executions.get(id);
    if (!current) throw ExecutionProblems.notFound(`Missing execution ${id}`);
    const updated = { ...current, ...data };
    this.executions.set(id, updated);
    return updated;
  }

  async mergeCheckpoint(id: string, key: string, value: unknown): Promise<Execution> {
    const current = this.executions.get(id);
    if (!current) throw ExecutionProblems.notFound(`Missing execution ${id}`);
    return this.update(id, {
      checkpoints: { ...current.checkpoints, [key]: value },
    });
  }

  async updateIfStatus(
    id: string,
    expectedStatus: ExecutionStatus,
    data: Partial<Execution>,
  ): Promise<Execution | null> {
    const current = this.executions.get(id);
    if (!current || current.status !== expectedStatus) return null;
    return this.update(id, data);
  }

  async updateIfStatusAndAttempt(
    id: string,
    expectedStatus: ExecutionStatus,
    expectedAttempt: number,
    data: Partial<Execution>,
  ): Promise<Execution | null> {
    const current = this.executions.get(id);
    if (!current || current.status !== expectedStatus || current.attempts !== expectedAttempt) {
      return null;
    }
    return this.update(id, data);
  }

  async mergeCheckpointIfStatusAndAttempt(
    id: string,
    expectedStatus: ExecutionStatus,
    expectedAttempt: number,
    key: string,
    value: unknown,
  ): Promise<Execution | null> {
    const current = this.executions.get(id);
    if (!current || current.status !== expectedStatus || current.attempts !== expectedAttempt) {
      return null;
    }
    return this.mergeCheckpoint(id, key, value);
  }

  async appendLogIfStatusAndAttempt(
    id: string,
    expectedStatus: ExecutionStatus,
    expectedAttempt: number,
    entry: ExecutionLogEntry,
  ): Promise<Execution | null> {
    const current = this.executions.get(id);
    if (!current || current.status !== expectedStatus || current.attempts !== expectedAttempt) {
      return null;
    }
    return this.update(id, { logs: [...(current.logs ?? []), entry] });
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

  async list(options: ListExecutionsOptions = {}): Promise<Execution[]> {
    return [...this.executions.values()].filter(
      (execution) =>
        (options.status === undefined || execution.status === options.status) &&
        (options.type === undefined || execution.type === options.type),
    );
  }

  async delete(id: string): Promise<void> {
    this.executions.delete(id);
  }
}
