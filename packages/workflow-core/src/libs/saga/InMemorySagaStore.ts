import {
  SagaDefinitionProblem,
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

function snapshotExecution(execution: SagaExecution): SagaExecution {
  const copies = new Map<object, object>();
  function copy(value: unknown): unknown {
    if (typeof value === "function" || typeof value === "symbol") {
      throw new SagaDefinitionProblem(execution.sagaName, "store data contains unsupported values");
    }
    if (value === null || typeof value !== "object") return value;
    const previous = copies.get(value);
    if (previous) return previous;

    let result: object;
    if (value instanceof Date) {
      const timestamp = Date.prototype.getTime.call(value);
      if (!Number.isFinite(timestamp)) {
        throw new SagaDefinitionProblem(execution.sagaName, "store data contains an invalid date");
      }
      result = new Date(timestamp);
    } else if (Array.isArray(value)) {
      result = Array<unknown>(value.length);
    } else {
      const prototype: unknown = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new SagaDefinitionProblem(
          execution.sagaName,
          "store data contains an unsupported object type",
        );
      }
      result = Object.create(prototype) as object;
    }
    copies.set(value, result);
    for (const key of Reflect.ownKeys(value)) {
      if (!Object.prototype.propertyIsEnumerable.call(value, key)) continue;
      if (typeof key === "symbol") {
        throw new SagaDefinitionProblem(
          execution.sagaName,
          "store data contains symbol-keyed data",
        );
      }
      Object.defineProperty(result, key, {
        value: copy(Reflect.get(value, key)),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    return result;
  }
  try {
    return copy(execution) as SagaExecution;
  } catch (error) {
    if (error instanceof SagaDefinitionProblem) throw error;
    throw new SagaDefinitionProblem(execution.sagaName, "store data could not be snapshotted");
  }
}

export class InMemorySagaStore implements SagaStore {
  private readonly executions = new Map<string, SagaExecution>();
  private idCounter = 0;

  constructor(private readonly clock: () => Date = () => new Date()) {}

  async create(params: CreateSagaExecutionParams): Promise<SagaExecution> {
    if (params.idempotencyKey !== undefined) {
      const existing = this.findExistingByIdempotencyKey(params.sagaName, params.idempotencyKey);
      if (existing) {
        return snapshotExecution(existing);
      }
    }

    const execution: SagaExecution = {
      id: `saga-${++this.idCounter}`,
      sagaName: params.sagaName,
      status: "pending",
      payload: params.payload,
      ...(params.requestFingerprint !== undefined
        ? { requestFingerprint: params.requestFingerprint }
        : {}),
      steps: [],
      compensationFailures: [],
      createdAt: this.clock(),
      ...(params.idempotencyKey !== undefined ? { idempotencyKey: params.idempotencyKey } : {}),
      ...(params.replayOf !== undefined ? { replayOf: params.replayOf } : {}),
      ...(params.metadata !== undefined ? { metadata: params.metadata } : {}),
    };

    const snapshot = snapshotExecution(execution);
    this.executions.set(snapshot.id, snapshot);
    return snapshotExecution(snapshot);
  }

  async findById(id: string): Promise<SagaExecution | null> {
    const execution = this.executions.get(id);
    return execution ? snapshotExecution(execution) : null;
  }

  async findByIdempotencyKey(sagaName: string, key: string): Promise<SagaExecution | null> {
    const execution = this.findExistingByIdempotencyKey(sagaName, key);
    return execution ? snapshotExecution(execution) : null;
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
    const existing = this.executions.get(id);
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
    const snapshot = snapshotExecution(updated);
    this.executions.set(id, snapshot);

    return snapshotExecution(snapshot);
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
    return executions
      .slice(offset, options.limit === undefined ? undefined : offset + options.limit)
      .map(snapshotExecution);
  }
}
