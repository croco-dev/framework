import { ExecutionManagerImpl, ExecutionStore } from "@croco/execution-core";
import type {
  CreateExecutionRecordParams,
  Execution,
  ExecutionAttemptStore,
  ExecutionLogEntry,
  ExecutionStatus,
  ListExecutionsOptions,
  ListRunningExecutionsOptions,
} from "@croco/execution-core";
import { PipelineProblem } from "../pipeline/PipelineProblem";

export const pipelineClock = () => new Date("2026-10-07T00:00:00.000Z");

export class PipelineExecutionStore extends ExecutionStore implements ExecutionAttemptStore {
  readonly records = new Map<string, Execution>();
  readonly checkpointWrites: { id: string; key: string; value: unknown }[] = [];
  beforeCheckpoint?: (id: string, key: string, value: unknown) => void;
  private sequence = 0;

  async create(params: CreateExecutionRecordParams): Promise<Execution> {
    const record: Execution = {
      ...structuredClone(params),
      id: `execution-${++this.sequence}`,
      status: "pending",
      attempts: 0,
      maxAttempts: params.maxAttempts ?? 3,
      createdAt: pipelineClock(),
    };
    this.records.set(record.id, record);
    return structuredClone(record);
  }
  async findById(id: string) {
    return structuredClone(this.records.get(id) ?? null);
  }
  async findByIdempotencyKey(key: string) {
    return structuredClone(
      [...this.records.values()].find((record) => record.idempotencyKey === key) ?? null,
    );
  }
  async update(id: string, data: Partial<Execution>) {
    return this.mutate(id, data);
  }
  async mergeCheckpoint(id: string, key: string, value: unknown) {
    return this.checkpoint(id, key, value);
  }
  async updateIfStatus(id: string, status: ExecutionStatus, data: Partial<Execution>) {
    return this.records.get(id)?.status === status ? this.mutate(id, data) : null;
  }
  async updateIfStatusAndAttempt(
    id: string,
    status: ExecutionStatus,
    attempt: number,
    data: Partial<Execution>,
  ) {
    return this.matches(id, status, attempt) ? this.mutate(id, data) : null;
  }
  async mergeCheckpointIfStatusAndAttempt(
    id: string,
    status: ExecutionStatus,
    attempt: number,
    key: string,
    value: unknown,
  ) {
    return this.matches(id, status, attempt) ? this.checkpoint(id, key, value) : null;
  }
  async appendLogIfStatusAndAttempt(
    id: string,
    status: ExecutionStatus,
    attempt: number,
    entry: ExecutionLogEntry,
  ) {
    return this.matches(id, status, attempt)
      ? this.mutate(id, { logs: [...(this.require(id).logs ?? []), entry] })
      : null;
  }
  async listRunning(options: ListRunningExecutionsOptions) {
    return structuredClone(
      [...this.records.values()]
        .filter(
          (record) =>
            record.status === "running" && (!options.afterId || record.id > options.afterId),
        )
        .sort((a, b) => a.id.localeCompare(b.id))
        .slice(0, options.limit),
    );
  }
  async list(_options?: ListExecutionsOptions) {
    return structuredClone([...this.records.values()]);
  }
  async delete(id: string) {
    this.records.delete(id);
  }
  private require(id: string) {
    const record = this.records.get(id);
    if (!record) throw new PipelineProblem("invalid-checkpoint");
    return record;
  }
  private matches(id: string, status: ExecutionStatus, attempt: number) {
    const record = this.records.get(id);
    return record?.status === status && record.attempts === attempt;
  }
  private mutate(id: string, data: Partial<Execution>) {
    const updated = { ...this.require(id), ...structuredClone(data) };
    this.records.set(id, updated);
    return structuredClone(updated);
  }
  private checkpoint(id: string, key: string, value: unknown) {
    this.beforeCheckpoint?.(id, key, value);
    this.checkpointWrites.push({ id, key, value: structuredClone(value) });
    return this.mutate(id, {
      checkpoints: { ...this.require(id).checkpoints, [key]: structuredClone(value) },
    });
  }
}

export function createExecutionFixture() {
  const store = new PipelineExecutionStore();
  return { store, executions: new ExecutionManagerImpl(store, { clock: pipelineClock }) };
}
