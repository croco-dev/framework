export type NestingStrategy = 'join' | 'savepoint';

export interface TxRunOptions<TOptions = unknown> {
  nesting?: NestingStrategy;
  options?: TOptions;
}

export interface TxManagerConfig {
  defaultNesting?: NestingStrategy;
}

export type Propagation = 'REQUIRED' | 'REQUIRES_NEW' | 'MANDATORY' | 'NEVER';

export type AfterCommitHook = () => void | Promise<void>;

export type TxManagerKey = string | symbol;

export const DEFAULT_TX_MANAGER_KEY: unique symbol = Symbol.for('@croco/tx-core/defaultTxManager');

export interface TransactionalOptions<TOptions = unknown> {
  propagation?: Propagation;
  managerKey?: TxManagerKey;
  nesting?: NestingStrategy;
  options?: TOptions;
}
