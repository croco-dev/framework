import {
  SagaExecutionNotFoundProblem,
  SagaStoreConflictProblem,
} from "../problems/WorkflowProblems";
import { assertValidListSagaExecutionsOptions } from "./assertValidListSagaExecutionsOptions";
import type {
  CreateSagaExecutionParams,
  ListSagaExecutionsOptions,
  SagaExecution,
  SagaStore,
} from "./types";

export class InMemorySagaStore implements SagaStore {
  private readonly executions = new Map<string, SagaExecution>();
  private idCounter = 0;

  async create(params: CreateSagaExecutionParams): Promise<SagaExecution> {
    if (params.idempotencyKey !== undefined) {
      const existing = this.findExistingByIdempotencyKey(params.sagaName, params.idempotencyKey);
      if (existing) {
        return existing;
      }
    }

    const execution: SagaExecution = {
      id: `saga-${++this.idCounter}`,
      sagaName: params.sagaName,
      status: "pending",
      payload: params.payload,
      steps: [],
      compensationFailures: [],
      createdAt: new Date(),
      ...(params.idempotencyKey !== undefined ? { idempotencyKey: params.idempotencyKey } : {}),
      ...(params.replayOf !== undefined ? { replayOf: params.replayOf } : {}),
      ...(params.metadata !== undefined ? { metadata: params.metadata } : {}),
    };

    this.executions.set(execution.id, execution);
    return execution;
  }

  async findById(id: string): Promise<SagaExecution | null> {
    return this.executions.get(id) ?? null;
  }

  async findByIdempotencyKey(sagaName: string, key: string): Promise<SagaExecution | null> {
    return this.findExistingByIdempotencyKey(sagaName, key);
  }

  private findExistingByIdempotencyKey(sagaName: string, key: string): SagaExecution | null {
    for (const execution of this.executions.values()) {
      if (execution.sagaName === sagaName && execution.idempotencyKey === key) {
        return execution;
      }
    }

    return null;
  }

  async update(id: string, data: Partial<SagaExecution>): Promise<SagaExecution> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new SagaExecutionNotFoundProblem(id);
    }

    if (data.id !== undefined && data.id !== id) {
      throw new SagaStoreConflictProblem(id, "saga execution id cannot be changed");
    }

    const updated: SagaExecution = {
      ...existing,
      ...data,
      id,
    };
    this.executions.set(id, updated);

    return updated;
  }

  async list(options: ListSagaExecutionsOptions = {}): Promise<SagaExecution[]> {
    assertValidListSagaExecutionsOptions(options);
    let executions = Array.from(this.executions.values());

    if (options.sagaName !== undefined) {
      executions = executions.filter((execution) => execution.sagaName === options.sagaName);
    }

    if (options.status !== undefined) {
      executions = executions.filter((execution) => execution.status === options.status);
    }

    if (options.replayOf === null) {
      executions = executions.filter((execution) => execution.replayOf === undefined);
    } else if (options.replayOf !== undefined) {
      executions = executions.filter((execution) => execution.replayOf === options.replayOf);
    }

    const offset = options.offset ?? 0;
    return executions.slice(
      offset,
      options.limit === undefined ? undefined : offset + options.limit,
    );
  }
}
