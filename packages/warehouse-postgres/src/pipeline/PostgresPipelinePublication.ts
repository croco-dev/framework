import { createHash } from "node:crypto";
import { PipelineProblem } from "@croco/etl-core/pipeline";
import { ExecutionManagerImpl } from "@croco/execution-core";
import { DrizzleExecutionStore } from "@croco/execution-drizzle";
import { WarehouseContractError } from "@croco/warehouse-core";
import { drizzle } from "drizzle-orm/node-postgres";
import { PostgresWarehouseCatalog } from "../facts/PostgresWarehouseCatalog";
import type { PipelinePublication, PipelineResult, RunBinding } from "@croco/etl-core/pipeline";
import type { Execution, ExecutionManagerOptions } from "@croco/execution-core";
import type { FactDescriptor } from "@croco/warehouse-core";
import type {
  WarehouseAccess,
  WarehouseCandidate,
  WarehouseSnapshot,
} from "@croco/warehouse-core/runtime";
import type { Pool, PoolClient } from "pg";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, canonical(child)]),
    );
  return value;
}
const serialize = (value: unknown): string => JSON.stringify(canonical(value));
const digest = (value: unknown): string =>
  createHash("sha256").update(serialize(value)).digest("hex");

export class PostgresPipelinePublication implements PipelinePublication {
  readonly executions: ExecutionManagerImpl;

  constructor(
    private readonly pool: Pool,
    private readonly descriptor: FactDescriptor,
    private readonly resolveAccess: () => WarehouseAccess,
    private readonly executionOptions?: ExecutionManagerOptions,
  ) {
    this.executions = new ExecutionManagerImpl(
      new DrizzleExecutionStore(drizzle(pool) as never),
      executionOptions,
    );
  }

  async publish(input: Parameters<PipelinePublication["publish"]>[0]): Promise<PipelineResult> {
    const { request, token, result } = input;
    if (
      request.candidateId !== `etl:${token.executionId}` ||
      result.executionId !== token.executionId ||
      result.state !== "published"
    )
      throw new PipelineProblem("binding-changed");
    const original = await this.executions.get(token.executionId);
    const originalBinding = original.payload as RunBinding | undefined;
    if (
      !originalBinding ||
      original.type !== "etl" ||
      original.attempts !== token.attempt ||
      originalBinding.targetModelVersion !== this.descriptor.semanticHash ||
      originalBinding.expectedRevision !== request.audit.expectedRevision ||
      request.fence !== originalBinding.expectedRevision + 1 ||
      serialize(originalBinding.scope) !== serialize(request.access.scope) ||
      originalBinding.accessHash !== digest(request.access) ||
      originalBinding.accessHash !== digest(this.resolveAccess())
    )
      throw new PipelineProblem("binding-changed");
    let attemptedSnapshot: WarehouseSnapshot | undefined;
    let attemptedExecution: Execution | undefined;
    const catalog = new PostgresWarehouseCatalog(
      this.pool,
      this.descriptor,
      this.resolveAccess,
      async (connection, snapshot) => {
        const manager = new ExecutionManagerImpl(
          new DrizzleExecutionStore(drizzle(connection as unknown as PoolClient) as never),
          this.executionOptions,
        );
        const execution = await manager.get(token.executionId);

        const binding = execution.payload as RunBinding | undefined;
        const candidates = await connection.query<{ data: WarehouseCandidate }>(
          "SELECT data FROM warehouse_candidates WHERE id=$1",
          [request.candidateId],
        );
        const candidate = candidates.rows[0]?.data;
        if (
          !binding ||
          !candidate ||
          execution.type !== "etl" ||
          execution.status !== "running" ||
          execution.attempts !== token.attempt ||
          serialize(original.payload) !== serialize(execution.payload) ||
          binding.targetModelVersion !== this.descriptor.semanticHash ||
          binding.targetModelVersion !== snapshot.modelVersion ||
          binding.targetModelVersion !== candidate.modelVersion ||
          binding.transformHash !== candidate.transformHash ||
          binding.expectedHead !== candidate.expectedHead ||
          binding.expectedRevision !== request.audit.expectedRevision ||
          request.fence !== binding.expectedRevision + 1 ||
          candidate.fence !== request.fence ||
          serialize(binding.scope) !== serialize(candidate.scope) ||
          serialize(binding.scope) !== serialize(request.access.scope) ||
          binding.accessHash !== digest(request.access) ||
          binding.accessHash !== digest(this.resolveAccess())
        )
          throw new PipelineProblem("binding-changed");
        if (input.signal?.aborted) throw new PipelineProblem("interrupted");
        attemptedSnapshot = snapshot;
        attemptedExecution = execution;
        await manager.completeAttempt(token, { ...result, snapshotId: snapshot.id });
      },
    );
    try {
      const snapshot = await catalog.publishCandidate(request);
      const expected = { ...result, snapshotId: snapshot.id };
      if (attemptedSnapshot) return expected;
      const completed = await this.executions.get(token.executionId);
      if (
        completed.status !== "completed" ||
        completed.attempts !== token.attempt ||
        serialize(completed.result) !== serialize(expected) ||
        serialize(completed.payload) !== serialize(original.payload)
      )
        throw new PipelineProblem("binding-changed");
      return expected;
    } catch (error) {
      if (
        !(error instanceof WarehouseContractError) ||
        error.code !== "WAREHOUSE_COMMIT_INDETERMINATE"
      )
        throw error;
      if (attemptedSnapshot && attemptedExecution) {
        try {
          const completed = await this.executions.get(token.executionId);
          const expected = { ...result, snapshotId: attemptedSnapshot.id };
          if (
            completed.status === "completed" &&
            completed.attempts === token.attempt &&
            serialize(completed.payload) === serialize(attemptedExecution.payload) &&
            serialize(completed.result) === serialize(expected)
          )
            return expected;
        } catch {
          throw error;
        }
      }
      throw error;
    }
  }
}
