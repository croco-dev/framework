export type NestingStrategy = 'join' | 'savepoint';

export interface TxRunOptions<TOptions = unknown> {
  nesting?: NestingStrategy;
  options?: TOptions;
}

export interface TxManagerConfig {
  defaultNesting?: NestingStrategy;
}


