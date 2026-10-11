import { createHash } from "node:crypto";
import { ChunkExecutor, Step } from "@croco/batch-core";
import { Problem, ProblemCategory } from "@croco/problems-core";
import { compileFact, validateRow } from "@croco/warehouse-core";
import { openFileSource } from "./fileSource";
import { PipelineProblem } from "./PipelineProblem";
import type { Checkpointable, ItemReader } from "@croco/batch-core";
import type {
  Execution,
  ExecutionAttemptManager,
  ExecutionAttemptToken,
  ExecutionManager,
} from "@croco/execution-core";
import type { CanonicalRow, TrustedScope } from "@croco/warehouse-core";
import type {
  AggregateRange,
  CatalogStore,
  SourceCoverage,
  WarehouseAccess,
  WarehouseQuality,
  WarehouseWriter,
  WarehousePublishRequest,
} from "@croco/warehouse-core/runtime";
import type { FileSource, FileSourceReader, FileSourceRecord } from "./fileSource";
import type { Projection } from "./projection";

export type PipelineProcessor = {
  readonly artifactHash: string;
  readonly dependencies: readonly string[];
  process(row: CanonicalRow): Promise<CanonicalRow | null> | CanonicalRow | null;
};
export type PipelineDefinition = {
  readonly id: string;
  readonly version: number;
  readonly source: {
    readonly id: string;
    readonly partitions: readonly FileSource[];
    readonly coverage: SourceCoverage;
  };
  readonly project: Projection;
  readonly processor?: PipelineProcessor;
  readonly load: "strict" | "quarantine";
  readonly resume: "checkpoint" | "restart-partition";
  readonly partitionSelection?: AggregateRange;
};
export interface PipelinePublication {
  readonly executions: ExecutionManager & ExecutionAttemptManager;
  publish(input: {
    readonly request: WarehousePublishRequest;
    readonly token: ExecutionAttemptToken;
    readonly result: Omit<PipelineResult, "snapshotId">;
    readonly signal?: AbortSignal;
  }): Promise<PipelineResult>;
}

export type PipelineRuntime = {
  readonly publication: PipelinePublication;
  readonly executions: ExecutionManager & ExecutionAttemptManager;
  readonly catalog: CatalogStore;
  readonly writer: WarehouseWriter;
  readonly resolveAccess: () => WarehouseAccess;
  readonly chunkSize: number;
  readonly maxAttempts: number;
  readonly previewLimit: number;
  readonly clock: () => Date;
  readonly signal?: AbortSignal;
  readonly maxInputRecords: number;
};
export type RunBinding = {
  readonly pipelineId: string;
  readonly pipelineVersion: number;
  readonly sourceRevision: string;
  readonly inputHash: string;
  readonly targetModelVersion: string;
  readonly transformHash: string;
  readonly expectedHead: string | null;
  readonly expectedRevision: number;
  readonly scope: TrustedScope;
  readonly accessHash: string;
};
export type PipelineRejection = {
  readonly sourceId: string;
  readonly record: number;
  readonly reason: string;
  readonly sensitivity: "sensitive";
};
type Counts = { input: number; output: number; rejected: number; filtered: number };
type Cursor = {
  partition: number;
  record: number;
  counts: Counts;
  partitionStart: Counts;
  batchIds: string[];
  partitionStartBatchCount: number;
  rejections: PipelineRejection[];
  partitionStartRejectionCount: number;
};
type RecordEnvelope = FileSourceRecord & { partition: number };
type ProjectedEnvelope = { readonly row: CanonicalRow; readonly batchId: string };
export type PipelineResult = {
  readonly executionId: string;
  readonly state: "published" | "partial";
  readonly inputCount: number;
  readonly outputCount: number;
  readonly rejectedCount: number;
  readonly filteredCount: number;
  readonly snapshotId: string | null;
};

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, child]) => [key, canonical(child)]),
    );
  return value;
};
const digest = (value: unknown): string =>
  createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
const canQuarantine = (error: unknown): error is Problem =>
  error instanceof Problem && error.category === ProblemCategory.ValidationError;
const zeroCounts = (): Counts => ({ input: 0, output: 0, rejected: 0, filtered: 0 });
const initialCursor = (): Cursor => ({
  partition: 0,
  record: 0,
  counts: zeroCounts(),
  partitionStart: zeroCounts(),
  batchIds: [],
  partitionStartBatchCount: 0,
  rejections: [],
  partitionStartRejectionCount: 0,
});

function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function assertCursor(cursor: Cursor, readers: readonly FileSourceReader[]): void {
  const validCount = (value: unknown): value is number =>
    typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
  const validCounts = (value: Counts) =>
    value &&
    Object.values(value).every(validCount) &&
    value.input === value.output + value.rejected + value.filtered;
  const prefix = readers
    .slice(0, cursor.partition)
    .reduce((sum, reader) => sum + reader.recordCount, 0);
  if (
    !validCount(cursor.record) ||
    cursor.record > (readers[cursor.partition]?.recordCount ?? 0) ||
    !validCounts(cursor.counts) ||
    !validCounts(cursor.partitionStart) ||
    cursor.counts.input !== prefix + cursor.record ||
    cursor.partitionStart.input !== prefix ||
    !Array.isArray(cursor.batchIds) ||
    cursor.batchIds.some((id) => typeof id !== "string" || !/^[a-f0-9]{64}$/.test(id)) ||
    new Set(cursor.batchIds).size !== cursor.batchIds.length ||
    cursor.batchIds.length !== cursor.counts.output ||
    cursor.partitionStartBatchCount !== cursor.partitionStart.output ||
    !Array.isArray(cursor.rejections) ||
    cursor.rejections.length !== cursor.counts.rejected ||
    cursor.partitionStartRejectionCount !== cursor.partitionStart.rejected ||
    Object.keys(cursor.partitionStart).some(
      (key) => cursor.partitionStart[key as keyof Counts] > cursor.counts[key as keyof Counts],
    )
  )
    throw new PipelineProblem("invalid-checkpoint");
}

export function definePipeline(definition: PipelineDefinition): PipelineDefinition {
  if (
    !definition.id.trim() ||
    !Number.isSafeInteger(definition.version) ||
    definition.version < 1 ||
    !definition.source.id ||
    definition.source.coverage.sourceRef !== definition.source.id ||
    !definition.source.partitions.length ||
    !["strict", "quarantine"].includes(definition.load) ||
    !["checkpoint", "restart-partition"].includes(definition.resume)
  )
    throw new PipelineProblem("invalid-definition");
  const ids = new Set<string>();
  for (const partition of definition.source.partitions) {
    if (
      ids.has(partition.id) ||
      digest(partition.schema) !== digest(definition.project.source) ||
      (partition.replayability === "mutable" && definition.resume !== "restart-partition")
    )
      throw new PipelineProblem("invalid-definition");
    ids.add(partition.id);
  }
  if (
    definition.processor &&
    (!/^[a-f0-9]{64}$/.test(definition.processor.artifactHash) ||
      definition.processor.dependencies.some((ref) => !ref))
  )
    throw new PipelineProblem("invalid-definition");
  return Object.freeze({
    ...definition,
    source: freeze(structuredClone(definition.source)),
    ...(definition.partitionSelection
      ? { partitionSelection: freeze(structuredClone(definition.partitionSelection)) }
      : {}),
    ...(definition.processor
      ? {
          processor: Object.freeze({
            ...definition.processor,
            dependencies: Object.freeze([...definition.processor.dependencies]),
          }),
        }
      : {}),
  });
}

export function createPipelineOperations(input: PipelineDefinition, runtime: PipelineRuntime) {
  const definition = definePipeline(input);
  for (const limit of [
    runtime.chunkSize,
    runtime.maxAttempts,
    runtime.previewLimit,
    runtime.maxInputRecords,
  ])
    if (!Number.isSafeInteger(limit) || limit < 1) throw new PipelineProblem("invalid-definition");
  if (runtime.chunkSize > 10_000) throw new PipelineProblem("invalid-definition");
  if (runtime.publication.executions !== runtime.executions)
    throw new PipelineProblem("execution-fencing-required");
  if (!runtime.executions.supportsAttemptFencing())
    throw new PipelineProblem("execution-fencing-required");
  const key = `${definition.id}.cursor`;
  async function identities() {
    const target = await compileFact(definition.project.target);
    const transformHash = digest([
      await definition.project.artifactHash(),
      definition.processor?.artifactHash ?? null,
      definition.processor?.dependencies ?? [],
      definition.load,
    ]);
    const sourceRevision = digest(
      definition.source.partitions.map((partition) => [
        partition.id,
        partition.revision,
        partition.replayability,
      ]),
    );
    return {
      targetModelVersion: target.semanticHash,
      transformHash,
      sourceRevision,
      inputHash: digest([
        sourceRevision,
        definition.source.coverage,
        definition.partitionSelection ?? null,
      ]),
    };
  }
  async function open() {
    const readers: FileSourceReader[] = [];
    try {
      for (const source of definition.source.partitions) readers.push(await openFileSource(source));
      if (readers.reduce((sum, reader) => sum + reader.recordCount, 0) > runtime.maxInputRecords)
        throw new PipelineProblem("invalid-definition");
      return readers;
    } catch (error) {
      await Promise.all(readers.map((reader) => reader.close()));
      throw error;
    }
  }
  async function project(record: RecordEnvelope): Promise<CanonicalRow | null> {
    const row = definition.project.project(record.row);
    const output = definition.processor ? await definition.processor.process(row) : row;
    return output === null ? null : validateRow(definition.project.target, output);
  }
  async function validate() {
    const readers = await open();
    let rejectedCount = 0;
    try {
      for (let partition = 0; partition < readers.length; partition++) {
        let record;
        while ((record = await readers[partition].read()) !== null) {
          try {
            definition.project.project(record.row);
          } catch (error) {
            if (definition.load === "strict" || !canQuarantine(error)) throw error;
            rejectedCount++;
          }
        }
      }
      return {
        pipelineId: definition.id,
        ...(await identities()),
        inputCount: readers.reduce((sum, reader) => sum + reader.recordCount, 0),
        rejectedCount,
        validity: rejectedCount ? "partial" : "valid",
      };
    } finally {
      await Promise.all(readers.map((reader) => reader.close()));
    }
  }
  async function preview() {
    const readers = await open();
    const rows: CanonicalRow[] = [];
    const rejected: PipelineRejection[] = [];
    let inputCount = 0;
    try {
      outer: for (let partition = 0; partition < readers.length; partition++) {
        let record;
        while ((record = await readers[partition].read()) !== null) {
          if (inputCount >= runtime.previewLimit) break outer;
          inputCount++;
          try {
            const row = await project({ ...record, partition });
            if (row !== null) rows.push(row);
          } catch (error) {
            if (definition.load === "strict" || !canQuarantine(error)) throw error;
            rejected.push({
              sourceId: definition.source.partitions[partition].id,
              record: record.record,
              reason: error.code,
              sensitivity: "sensitive",
            });
          }
        }
      }
      return {
        pipelineId: definition.id,
        inputCount,
        rows,
        rejected,
        coverage: "preview" as const,
      };
    } finally {
      await Promise.all(readers.map((reader) => reader.close()));
    }
  }
  async function execute(executionId: string): Promise<PipelineResult> {
    const previous = await runtime.executions.get(executionId);
    const binding = previous.payload as RunBinding;
    const current = await identities();
    const access = runtime.resolveAccess();
    if (
      !binding ||
      binding.pipelineId !== definition.id ||
      binding.pipelineVersion !== definition.version ||
      Object.entries(current).some(
        ([name, value]) => binding[name as keyof RunBinding] !== value,
      ) ||
      binding.accessHash !== digest(access)
    )
      throw new PipelineProblem("binding-changed");
    if (
      previous.attempts > 0 &&
      definition.source.partitions.some((source) => source.replayability === "non-replayable")
    )
      throw new PipelineProblem("replay-unavailable");
    const readers = await open();
    let execution: Execution | undefined;
    let publicationStarted = false;
    try {
      execution = await runtime.executions.start(executionId);
      const token = { executionId, attempt: execution.attempts };
      let cursor = initialCursor();
      const assertActive = async () => {
        const state = await runtime.executions.get(executionId);
        if (
          runtime.signal?.aborted ||
          state.status !== "running" ||
          state.attempts !== token.attempt ||
          digest(runtime.resolveAccess()) !== binding.accessHash
        )
          throw new PipelineProblem("interrupted");
      };
      const reader: ItemReader<RecordEnvelope> & Checkpointable = {
        async read() {
          await assertActive();
          while (cursor.partition < readers.length) {
            const record = await readers[cursor.partition].read();
            if (record !== null) {
              cursor.record = record.record;
              return { ...record, partition: cursor.partition };
            }
            cursor.partition++;
            cursor.record = 0;
            cursor.partitionStart = { ...cursor.counts };
            cursor.partitionStartBatchCount = cursor.batchIds.length;
            cursor.partitionStartRejectionCount = cursor.rejections.length;
          }
          return null;
        },
        getCheckpoint() {
          return { bindingHash: digest(binding), cursor: structuredClone(cursor) };
        },
        restoreCheckpoint(value: unknown) {
          const saved = value as { bindingHash: string; cursor: Cursor };
          if (
            !saved ||
            saved.bindingHash !== digest(binding) ||
            !saved.cursor ||
            !Number.isSafeInteger(saved.cursor.partition) ||
            saved.cursor.partition < 0 ||
            saved.cursor.partition > readers.length
          )
            throw new PipelineProblem("invalid-checkpoint");
          assertCursor(saved.cursor, readers);
          cursor = structuredClone(saved.cursor);
          while (
            cursor.partition < readers.length &&
            cursor.record === readers[cursor.partition].recordCount
          ) {
            cursor.partition++;
            cursor.record = 0;
            cursor.partitionStart = { ...cursor.counts };
            cursor.partitionStartBatchCount = cursor.batchIds.length;
            cursor.partitionStartRejectionCount = cursor.rejections.length;
          }
          if (cursor.partition < readers.length) {
            const source = definition.source.partitions[cursor.partition];
            if (source.replayability === "mutable" || definition.resume === "restart-partition") {
              cursor.record = 0;
              cursor.counts = { ...cursor.partitionStart };
              cursor.batchIds.length = cursor.partitionStartBatchCount;
              cursor.rejections.length = cursor.partitionStartRejectionCount;
            }
            readers[cursor.partition].restoreCheckpoint({
              sourceId: source.id,
              revision: source.revision,
              record: cursor.record,
            });
          }
        },
      };
      let unresolvedReceipt = false;
      const facade: ExecutionManager = {
        get: (id) => runtime.executions.get(id),
        create: (params) => runtime.executions.create(params),
        start: (id) => runtime.executions.start(id),
        complete: (_id, result) => runtime.executions.completeAttempt(token, result),
        fail: (_id, error) =>
          runtime.executions.failAttempt(token, {
            ...error,
            message: "Pipeline attempt failed.",
            stack: undefined,
            ...(unresolvedReceipt ? { indeterminate: true } : {}),
          }),
        cancel: (id, reason) => runtime.executions.cancel(id, reason),
        retry: (id) => runtime.executions.retry(id),
        updateProgress: (_id, progress) =>
          runtime.executions.updateProgressAttempt(token, progress),
        checkpoint: (_id, checkpointKey, value) =>
          runtime.executions.checkpointAttempt(token, checkpointKey, value),
        timeout: (id) => runtime.executions.timeout(id),
        reconcileTimedOut: (options) => runtime.executions.reconcileTimedOut(options),
      };
      const candidateId = `etl:${executionId}`;
      const audit = (action: string) => ({
        reason: `Pipeline ${definition.id} ${action}`,
        expectedRevision: binding.expectedRevision,
        idempotencyKey: `${candidateId}:${action}`,
      });
      const candidate = await runtime.catalog.createCandidate({
        access,
        id: candidateId,
        transformHash: binding.transformHash,
        sourceRefs: [definition.source.id],
        expectedHead: binding.expectedHead,
        partitionSelection: definition.partitionSelection ?? null,
        audit: audit("create"),
      });
      const request = { access, candidateId, fence: candidate.fence };
      const step = new Step<RecordEnvelope, ProjectedEnvelope>({
        name: definition.id,
        chunkSize: runtime.chunkSize,
        reader,
        processor: {
          async process(record) {
            cursor.counts.input++;
            try {
              const row = await project(record);
              if (row === null) {
                cursor.counts.filtered++;
                return null;
              }
              cursor.counts.output++;
              const batchId = digest([
                binding.sourceRevision,
                binding.transformHash,
                binding.targetModelVersion,
                record.partition,
                record.record,
              ]);
              cursor.batchIds.push(batchId);
              return { row, batchId };
            } catch (error) {
              if (definition.load === "strict" || !canQuarantine(error)) throw error;
              cursor.counts.rejected++;
              cursor.rejections.push({
                sourceId: definition.source.partitions[record.partition].id,
                record: record.record,
                reason: error.code,
                sensitivity: "sensitive",
              });
              return null;
            }
          },
        },
        writer: {
          async write(items) {
            for (const item of items) {
              await assertActive();
              let receipt = await runtime.writer.write({
                ...request,
                batchId: item.batchId,
                attempt: token.attempt,
                rows: [item.row],
              });
              if (receipt.state === "indeterminate") {
                unresolvedReceipt = true;
                const reconciled = await runtime.writer.reconcileReceipt({
                  ...request,
                  batchId: item.batchId,
                  attempt: token.attempt,
                });
                if (reconciled !== null) receipt = reconciled;
                if (receipt.state === "durable") unresolvedReceipt = false;
              }
              if (receipt.state !== "durable") {
                unresolvedReceipt = receipt.state === "indeterminate";
                throw new PipelineProblem("receipt-unresolved");
              }
            }
          },
        },
        classifyFailure: () => ({ retryable: false }),
      });
      await new ChunkExecutor(facade).execute(executionId, step, {
        startExecution: false,
        completeExecution: false,
      });
      await assertActive();
      await runtime.executions.checkpointAttempt(token, key, reader.getCheckpoint());
      const coverage = definition.source.coverage;
      const complete =
        cursor.counts.rejected === 0 &&
        ["complete", "empty"].includes(coverage.state) &&
        !coverage.gaps.length &&
        !coverage.late;
      const result: PipelineResult = {
        executionId,
        state: complete ? "published" : "partial",
        inputCount: cursor.counts.input,
        outputCount: cursor.counts.output,
        rejectedCount: cursor.counts.rejected,
        filteredCount: cursor.counts.filtered,
        snapshotId: null,
      };
      if (!complete) {
        await runtime.catalog.failCandidate({ ...request, audit: audit("partial") });
        await runtime.executions.failAttempt(token, {
          code: "etl-core/partial-coverage",
          message: "Pipeline coverage is partial; candidate was not published.",
          retryable: false,
        });
        return result;
      }
      const quality: WarehouseQuality = {
        freshness: { observedAt: previous.metadata?.observedAt as string, newestEventAt: null },
        temporalCompleteness: "complete",
        populationCoverage: "complete",
        validity: "valid",
        reproducibility: "reproducible",
        sourceCoverage: [{ ...coverage, state: cursor.counts.input === 0 ? "empty" : "complete" }],
      };
      await runtime.catalog.sealCandidate({
        ...request,
        expectedBatchIds: cursor.batchIds,
        quality,
        audit: audit("seal"),
      });
      await assertActive();
      publicationStarted = true;
      return await runtime.publication.publish({
        request: { ...request, audit: audit("publish") },
        token,
        result,
        signal: runtime.signal,
      });
    } catch (error) {
      if (execution) {
        const state = await runtime.executions.get(executionId);
        if (state.status === "running" && state.attempts === execution.attempts)
          await runtime.executions.failAttempt(
            { executionId, attempt: execution.attempts },
            {
              code: error instanceof Problem ? error.code : "etl-core/pipeline-failed",
              message: "Pipeline attempt failed.",
              retryable: false,
              indeterminate:
                publicationStarted ||
                (error instanceof Problem && error.code === "WAREHOUSE_COMMIT_INDETERMINATE") ||
                (error instanceof PipelineProblem && error.reason === "receipt-unresolved"),
            },
          );
      }
      throw error;
    } finally {
      await Promise.all(readers.map((reader) => reader.close()));
    }
  }
  async function run() {
    await validate();
    const access = runtime.resolveAccess();
    const dataset = await runtime.catalog.describeDataset({ access });
    const identity = await identities();
    if (dataset.descriptor.semanticHash !== identity.targetModelVersion)
      throw new PipelineProblem("binding-changed");
    const binding: RunBinding = {
      pipelineId: definition.id,
      pipelineVersion: definition.version,
      ...identity,
      expectedHead: dataset.head?.id ?? null,
      expectedRevision: dataset.revision,
      scope: access.scope,
      accessHash: digest(access),
    };
    const execution = await runtime.executions.create({
      type: "etl",
      payload: binding,
      maxAttempts: runtime.maxAttempts,
      metadata: { observedAt: runtime.clock().toISOString() },
    });
    return execute(execution.id);
  }
  async function retry(executionId: string) {
    const execution = await runtime.executions.get(executionId);
    if ((execution.payload as RunBinding)?.pipelineId !== definition.id)
      throw new PipelineProblem("binding-changed");
    const binding = execution.payload as RunBinding;
    const current = await identities();
    if (
      binding.pipelineVersion !== definition.version ||
      Object.entries(current).some(
        ([name, value]) => binding[name as keyof RunBinding] !== value,
      ) ||
      binding.accessHash !== digest(runtime.resolveAccess())
    )
      throw new PipelineProblem("binding-changed");
    if (definition.source.partitions.some((source) => source.replayability === "non-replayable"))
      throw new PipelineProblem("replay-unavailable");
    await validate();
    await runtime.executions.retry(executionId);
    return execute(executionId);
  }
  async function status(executionId: string) {
    const execution = await runtime.executions.get(executionId);
    if ((execution.payload as RunBinding)?.pipelineId !== definition.id)
      throw new PipelineProblem("binding-changed");
    const access = runtime.resolveAccess();
    if (
      !access.roles.includes("read") ||
      digest((execution.payload as RunBinding).scope) !== digest(access.scope)
    )
      throw new PipelineProblem("binding-changed");
    return execution;
  }
  return { validate, preview, run, retry, status };
}
