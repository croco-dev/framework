import { EnrichmentProblem, enrichmentScopeKey } from "@croco/analytics-core/enrichment";
import { ChunkExecutor, Step } from "@croco/batch-core";
import type { Checkpointable, ItemReader } from "@croco/batch-core";
import type { ExecutionManager } from "@croco/execution-core";
import type { EnrichmentService, EnrichmentScope } from "@croco/analytics-core/enrichment";

/** Existing bounded batch runner; durable per-item claims make replay safe across chunk boundaries. */
export async function classifyBatch(
  executions: ExecutionManager,
  executionId: string,
  service: EnrichmentService,
  scope: EnrichmentScope,
  runId: string,
  itemIds: readonly string[],
  version: string,
): Promise<void> {
  if (itemIds.length > 100 || new Set(itemIds).size !== itemIds.length)
    throw new EnrichmentProblem("invalid-batch");
  const execution = await executions.get(executionId);
  const payload: unknown = execution.payload;
  if (
    !payload ||
    typeof payload !== "object" ||
    !("runId" in payload) ||
    payload.runId !== runId ||
    !("scopeKey" in payload) ||
    payload.scopeKey !== enrichmentScopeKey(scope)
  )
    throw new EnrichmentProblem("invalid-input");
  let cursor = 0;
  const reader: ItemReader<string> & Checkpointable = {
    read: async () => itemIds[cursor++] ?? null,
    getCheckpoint: () => cursor,
    restoreCheckpoint: (value) => {
      if (
        typeof value !== "number" ||
        !Number.isSafeInteger(value) ||
        value < 0 ||
        value > itemIds.length
      )
        throw new EnrichmentProblem("invalid-input");
      cursor = value;
    },
  };
  const step = new Step<string, string>({
    name: "enrichment",
    chunkSize: 1,
    reader,
    processor: {
      process: async (itemId) => {
        await service.classify(scope, runId, itemId, "intent", version);
        return itemId;
      },
    },
    writer: {
      write: async () => {
        await service.settle(scope, runId);
      },
    },
  });
  await new ChunkExecutor(executions).execute(executionId, step);
  // Runner completion means traversal completed, not that unknown/failed items were classified or reviewed.
}
