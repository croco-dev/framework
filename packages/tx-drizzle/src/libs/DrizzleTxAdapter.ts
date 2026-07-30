import { TransactionRollbackConfirmedProblem } from "@croco/tx-core";
import type { TxAdapter } from "@croco/tx-core";
import { SavepointUnsupportedProblem } from "./problems/TxDrizzleProblems";
import type { DrizzleDb, DrizzleTx, InferTxClient, InferTxOptions } from "./types";

function getAbortReason(signal: AbortSignal): Error {
  return signal.reason instanceof Error ? signal.reason : new Error("Transaction aborted");
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw getAbortReason(signal);
  }
}

function createAbortGuardedValue<TValue>(
  value: TValue,
  signal: AbortSignal | undefined,
  cache: WeakMap<object, unknown>,
): TValue {
  if (!signal || value === null || (typeof value !== "object" && typeof value !== "function")) {
    return value;
  }

  if (cache.has(value)) {
    return cache.get(value) as TValue;
  }

  const guarded = new Proxy(value as object, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);

      if (typeof value !== "function") {
        return createAbortGuardedValue(value, signal, cache);
      }

      return (...args: unknown[]) => {
        throwIfAborted(signal);
        return createAbortGuardedValue(value.apply(target, args), signal, cache);
      };
    },
  });

  cache.set(value, guarded);

  return guarded as TValue;
}

async function runAbortableCallback<T>(
  operation: () => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (!signal) {
    return operation();
  }

  throwIfAborted(signal);

  let abortListener: (() => void) | undefined;
  const abortPromise = new Promise<never>((_, reject) => {
    abortListener = () => reject(getAbortReason(signal));
    signal.addEventListener("abort", abortListener, { once: true });
  });

  try {
    return await Promise.race([Promise.resolve().then(operation), abortPromise]);
  } finally {
    if (abortListener) {
      signal.removeEventListener("abort", abortListener);
    }
  }
}

function createAbortableCallback<TClient, T>(
  fn: (client: TClient) => Promise<T>,
  signal?: AbortSignal,
): (client: TClient) => Promise<T> {
  return (client) => {
    const cache = new WeakMap<object, unknown>();
    const guardedClient = createAbortGuardedValue(client, signal, cache);

    return runAbortableCallback(async () => fn(guardedClient), signal);
  };
}

function classifyAdapterFailure(error: unknown, signal?: AbortSignal): never {
  if (signal?.aborted && error === signal.reason) {
    throw new TransactionRollbackConfirmedProblem(getAbortReason(signal));
  }

  throw error;
}

export function createDrizzleTxAdapter<TDb extends DrizzleDb>(
  db: TDb,
): TxAdapter<InferTxClient<TDb>, InferTxOptions<TDb>> {
  type TClient = InferTxClient<TDb>;
  type TOptions = InferTxOptions<TDb>;

  return {
    async transaction<T>(
      fn: (client: TClient) => Promise<T>,
      options?: TOptions,
      signal?: AbortSignal,
    ): Promise<T> {
      throwIfAborted(signal);

      try {
        return (await db.transaction(
          createAbortableCallback(fn, signal) as (tx: unknown) => Promise<T>,
          options,
        )) as T;
      } catch (error) {
        classifyAdapterFailure(error, signal);
      }
    },

    async savepoint<T>(
      client: TClient,
      fn: (client: TClient) => Promise<T>,
      options?: TOptions,
      signal?: AbortSignal,
    ): Promise<T> {
      const txClient = client as unknown as DrizzleTx<TClient, TOptions>;

      if (typeof txClient.transaction !== "function") {
        throw new SavepointUnsupportedProblem();
      }

      throwIfAborted(signal);

      try {
        return (await txClient.transaction(
          createAbortableCallback(fn, signal) as (tx: unknown) => Promise<T>,
          options,
        )) as T;
      } catch (error) {
        classifyAdapterFailure(error, signal);
      }
    },

    supportsSavepoint(): boolean {
      return true;
    },
  };
}
