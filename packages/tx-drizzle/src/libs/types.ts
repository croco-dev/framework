type TransactionFn<TClient, TOptions> = <T>(
  fn: (tx: TClient) => Promise<T>,
  options?: TOptions,
) => Promise<T>;

type DrizzleCapabilityMethod = (...args: never[]) => unknown;

export type DrizzleCallable<TResult = unknown> = (...args: unknown[]) => TResult;
export type DrizzleSelectFn<TResult = unknown> = DrizzleCallable<TResult>;
export type DrizzleInsertFn<TResult = unknown> = DrizzleCallable<TResult>;
export type DrizzleUpdateFn<TResult = unknown> = DrizzleCallable<TResult>;
export type DrizzleDeleteFn<TResult = unknown> = DrizzleCallable<TResult>;

/** SQL 실행 메서드를 제공하는 최소 Drizzle capability입니다. */
export interface DrizzleExecuteCapability<
  TExecute extends DrizzleCapabilityMethod = DrizzleCapabilityMethod,
> {
  execute: TExecute;
}

/** 조회 빌더를 시작하는 메서드를 제공하는 최소 Drizzle capability입니다. */
export interface DrizzleSelectCapability<
  TSelect extends DrizzleCapabilityMethod = DrizzleCapabilityMethod,
> {
  select: TSelect;
}

/** 삽입 빌더를 시작하는 메서드를 제공하는 최소 Drizzle capability입니다. */
export interface DrizzleInsertCapability<
  TInsert extends DrizzleCapabilityMethod = DrizzleCapabilityMethod,
> {
  insert: TInsert;
}

/** 갱신 빌더를 시작하는 메서드를 제공하는 최소 Drizzle capability입니다. */
export interface DrizzleUpdateCapability<
  TUpdate extends DrizzleCapabilityMethod = DrizzleCapabilityMethod,
> {
  update: TUpdate;
}

/** 삭제 빌더를 시작하는 메서드를 제공하는 최소 Drizzle capability입니다. */
export interface DrizzleDeleteCapability<
  TDelete extends DrizzleCapabilityMethod = DrizzleCapabilityMethod,
> {
  delete: TDelete;
}

/** 지정한 클라이언트와 옵션으로 트랜잭션을 실행하는 최소 Drizzle capability입니다. */
export interface DrizzleTransactionCapability<TClient = unknown, TOptions = never> {
  transaction: TransactionFn<TClient, TOptions>;
}

export interface DrizzleDb<
  TClient = unknown,
  TOptions = never,
> extends DrizzleTransactionCapability<TClient, TOptions> {}

export interface DrizzleTx<
  TClient = unknown,
  TOptions = never,
> extends DrizzleTransactionCapability<TClient, TOptions> {}

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
