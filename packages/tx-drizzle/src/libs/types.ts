type TransactionFn<TClient, TOptions> = <T>(
  fn: (tx: TClient) => Promise<T>,
  options?: TOptions,
) => Promise<T>;

export type DrizzleCallable<TResult = unknown> = (...args: unknown[]) => TResult;
export type DrizzleSelectFn<TResult = unknown> = DrizzleCallable<TResult>;
export type DrizzleInsertFn<TResult = unknown> = DrizzleCallable<TResult>;
export type DrizzleUpdateFn<TResult = unknown> = DrizzleCallable<TResult>;
export type DrizzleDeleteFn<TResult = unknown> = DrizzleCallable<TResult>;

export interface DrizzleDb<TClient = unknown, TOptions = unknown> {
  transaction: TransactionFn<TClient, TOptions>;
}

export interface DrizzleTx<TClient = unknown, TOptions = unknown> {
  transaction: TransactionFn<TClient, TOptions>;
}

export type InferTxClient<TDb> = TDb extends {
  transaction: (fn: (tx: infer TClient) => Promise<unknown>) => Promise<unknown>;
}
  ? TClient
  : never;

export type InferTxOptions<TDb> = TDb extends {
  transaction: (
    fn: (tx: unknown) => Promise<unknown>,
    options?: infer TOptions,
  ) => Promise<unknown>;
}
  ? TOptions
  : undefined;
