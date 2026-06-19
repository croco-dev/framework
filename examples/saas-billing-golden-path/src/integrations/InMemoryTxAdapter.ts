import type { TxAdapter } from "@croco/tx-core";

export type InMemoryTxClient = {
  readonly id: string;
};

export function createInMemoryTxAdapter(): TxAdapter<InMemoryTxClient> {
  return {
    async transaction<T>(
      fn: (client: InMemoryTxClient) => Promise<T>,
      _options?: unknown,
      signal?: AbortSignal,
    ): Promise<T> {
      if (signal?.aborted) {
        throw signal.reason instanceof Error ? signal.reason : new Error("Transaction aborted");
      }

      return await fn({ id: "in-memory-root" });
    },
    async savepoint<T>(
      client: InMemoryTxClient,
      fn: (client: InMemoryTxClient) => Promise<T>,
      _options?: unknown,
      signal?: AbortSignal,
    ): Promise<T> {
      if (signal?.aborted) {
        throw signal.reason instanceof Error ? signal.reason : new Error("Transaction aborted");
      }

      return await fn(client);
    },
    supportsSavepoint(): boolean {
      return true;
    },
  };
}
