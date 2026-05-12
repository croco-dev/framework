import type { TxAdapter } from "@croco/tx-core";
import { SavepointUnsupportedProblem } from "./problems/TxDrizzleProblems";
import type { DrizzleDb, DrizzleTx, InferTxClient, InferTxOptions } from "./types";

export function createDrizzleTxAdapter<TDb extends DrizzleDb>(
  db: TDb,
): TxAdapter<InferTxClient<TDb>, InferTxOptions<TDb>> {
  type TClient = InferTxClient<TDb>;
  type TOptions = InferTxOptions<TDb>;

  return {
    async transaction<T>(fn: (client: TClient) => Promise<T>, options?: TOptions): Promise<T> {
      return db.transaction(fn as (tx: unknown) => Promise<T>, options) as Promise<T>;
    },

    async savepoint<T>(
      client: TClient,
      fn: (client: TClient) => Promise<T>,
      options?: TOptions,
    ): Promise<T> {
      const txClient = client as unknown as DrizzleTx<TClient, TOptions>;

      if (typeof txClient.transaction !== "function") {
        throw new SavepointUnsupportedProblem();
      }

      return txClient.transaction(fn as (tx: unknown) => Promise<T>, options) as Promise<T>;
    },

    supportsSavepoint(): boolean {
      return true;
    },
  };
}
