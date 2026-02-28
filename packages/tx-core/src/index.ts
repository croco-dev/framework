/**
 * Error thrown when a transaction manager is requested but not registered.
 */
/**
 * Error thrown when an invalid propagation rule is used.
 */
export { TxManagerNotRegisteredError, TxPropagationError } from './libs/errors';
/**
 * Problem thrown when `@Transactional` is applied to a non-method target.
 */
/**
 * Problem thrown when transaction context is required but not available.
 */
export { TransactionContextProblem, TransactionDecoratorProblem } from './libs/problems/TransactionProblems';

/**
 * Method decorator that applies transaction propagation and nesting semantics.
 */
export { Transactional } from './libs/Transactional';

/**
 * Adapter contract for opening root transactions and nested savepoints.
 */
export type { TxAdapter } from './libs/TxAdapter';

/**
 * AsyncLocalStorage-based Unit of Work manager for transaction execution.
 */
export { TxManager } from './libs/TxManager';

/**
 * Registry for resolving transaction managers by key.
 */
export { TxManagerRegistry } from './libs/TxManagerRegistry';
/**
 * Hook executed after the root transaction successfully commits.
 */
/**
 * Strategy used for nested transaction behavior.
 */
/**
 * Propagation mode used by `@Transactional`.
 */
/**
 * Options for configuring `@Transactional` behavior.
 */
/**
 * Configuration for creating a transaction manager.
 */
/**
 * Identifier used to register and resolve a transaction manager.
 */
/**
 * Options for executing a function within a transaction.
 */
export type {
  AfterCommitHook,
  NestingStrategy,
  Propagation,
  TransactionalOptions,
  TxManagerConfig,
  TxManagerKey,
  TxRunOptions,
} from './libs/types';

/**
 * Default key used by the transaction manager registry.
 */
export { DEFAULT_TX_MANAGER_KEY } from './libs/types';
