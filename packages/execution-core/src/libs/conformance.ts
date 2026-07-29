import { ExecutionProblems } from "./ExecutionProblem";
import type { ExecutionStore } from "./interfaces/ExecutionStore";

export type ExecutionCheckpointWrite = {
  readonly key: string;
  readonly value: unknown;
};

export type ExecutionCheckpointConcurrencyResult = {
  /**
   * Index of the write whose storage mutation was applied last.
   *
   * Invocation order and Promise settlement order are not storage ordering evidence. Adapter
   * harnesses must control or observe the actual mutation order before returning this index.
   */
  readonly lastAppliedWrite: number;
};

export type ExecutionCheckpointStoreConformanceCase = {
  readonly name: string;
  run(): Promise<void>;
};

export type ExecutionCheckpointStoreConformanceOptions<TStore extends ExecutionStore> = {
  readonly createStore: () => TStore | Promise<TStore>;
  readonly disposeStore?: (store: TStore) => Promise<void> | void;
  readonly runConcurrentWrites: (
    store: TStore,
    executionId: string,
    writes: readonly ExecutionCheckpointWrite[],
  ) => Promise<ExecutionCheckpointConcurrencyResult>;
};

export type ExecutionCheckpointStoreConformanceSuite = {
  readonly cases: readonly ExecutionCheckpointStoreConformanceCase[];
};

function assertConformance(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw ExecutionProblems.checkpointStoreConformance(
      `Execution checkpoint store conformance failed: ${message}`,
    );
  }
}

async function withStore<TStore extends ExecutionStore>(
  options: ExecutionCheckpointStoreConformanceOptions<TStore>,
  run: (store: TStore) => Promise<void>,
): Promise<void> {
  const store = await options.createStore();
  try {
    await run(store);
  } finally {
    await options.disposeStore?.(store);
  }
}

/**
 * Creates the executable concurrency contract shared by in-memory and durable execution stores.
 */
export function createExecutionCheckpointStoreConformanceSuite<TStore extends ExecutionStore>(
  options: ExecutionCheckpointStoreConformanceOptions<TStore>,
): ExecutionCheckpointStoreConformanceSuite {
  return {
    cases: [
      {
        name: "preserves concurrent checkpoint writes to different keys",
        run: () =>
          withStore(options, async (store) => {
            const execution = await store.create({ type: "checkpoint-conformance-different-keys" });
            const writes = [
              { key: "page", value: 10 },
              { key: "cursor", value: "cursor-10" },
            ] as const;

            await options.runConcurrentWrites(store, execution.id, writes);

            const checkpoints = (await store.findById(execution.id))?.checkpoints;
            assertConformance(checkpoints?.page === 10, "concurrent page checkpoint was lost");
            assertConformance(
              checkpoints.cursor === "cursor-10",
              "concurrent cursor checkpoint was lost",
            );
          }),
      },
      {
        name: "retains the last applied concurrent checkpoint write to the same key",
        run: () =>
          withStore(options, async (store) => {
            const execution = await store.create({ type: "checkpoint-conformance-same-key" });
            const writes = [
              { key: "cursor", value: "first-value" },
              { key: "cursor", value: "second-value" },
            ] as const;

            const result = await options.runConcurrentWrites(store, execution.id, writes);
            const lastApplied = writes[result.lastAppliedWrite];
            assertConformance(
              lastApplied !== undefined,
              "concurrency harness did not identify a valid last applied write",
            );
            assertConformance(
              (await store.findById(execution.id))?.checkpoints?.cursor === lastApplied.value,
              "same-key checkpoint does not contain the last applied write",
            );
          }),
      },
    ],
  };
}
