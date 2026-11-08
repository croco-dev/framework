// croco-test-clock: controlled
import { ExecutionStore, ExecutionProblems } from "@croco/execution-core";
import type {
  Execution,
  CreateExecutionRecordParams,
  ExecutionStatus,
  ExecutionLogEntry,
  ListRunningExecutionsOptions,
  ListExecutionsOptions,
} from "@croco/execution-core";

export class MemoryExecutionStore extends ExecutionStore {
  private readonly executions = new Map<string, Execution>();
  private sequence = 0;

  async create(params: CreateExecutionRecordParams): Promise<Execution> {
    const duplicate = [...this.executions.values()].find(
      (item) =>
        params.idempotencyKey !== undefined && item.idempotencyKey === params.idempotencyKey,
    );
    if (duplicate) return duplicate;
    const execution: Execution = {
      id: `exec-${String(++this.sequence).padStart(4, "0")}`,
      type: params.type,
      status: "pending",
      attempts: 0,
      maxAttempts: params.maxAttempts ?? 1,
      createdAt: new Date(0),
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
