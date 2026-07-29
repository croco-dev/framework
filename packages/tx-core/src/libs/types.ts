import type { AfterCommitHooksProblem } from "./problems/TransactionProblems";
import type { AfterCommitFailure } from "./afterCommitTypes";

export type { AfterCommitFailure } from "./afterCommitTypes";

export type NestingStrategy = "join" | "savepoint";

export interface TxRunOptions<TOptions = unknown> {
  nesting?: NestingStrategy;
  options?: TOptions;
  /** Positive integer milliseconds up to 2,147,483,647. Omit for no timeout. */
  timeout?: number;
}

export interface TxManagerConfig {
  defaultNesting?: NestingStrategy;
  /** Positive integer milliseconds up to 2,147,483,647. Omit for no timeout. */
  defaultTimeout?: number;
}

export type Propagation = "REQUIRED" | "REQUIRES_NEW" | "MANDATORY" | "NEVER";

export type AfterCommitHook = () => void | Promise<void>;

export type AfterCommitOutcome =
  | {
      status: "succeeded";
      hookCount: number;
    }
  | {
      status: "failed";
      hookCount: number;
      failures: readonly AfterCommitFailure[];
      problem: AfterCommitHooksProblem;
    };

export type TxRunOutcome<T> = {
  status: "committed";
  value: T;
  afterCommit: AfterCommitOutcome;
};

export type TxManagerKey = string | symbol;

export const DEFAULT_TX_MANAGER_KEY: unique symbol = Symbol.for("@croco/tx-core/defaultTxManager");

export interface TransactionalOptions<TOptions = unknown> {
  propagation?: Propagation;
  managerKey?: TxManagerKey;
  nesting?: NestingStrategy;
  options?: TOptions;
  /** Positive integer milliseconds up to 2,147,483,647. Omit for no timeout. */
  timeout?: number;
}
