export const TRANSACTION_CONTEXT_TOKEN = Symbol('TransactionContext');

export interface TransactionContext {
  isInTransaction(): boolean;
  onAfterCommit(hook: () => void | Promise<void>): void;
}
