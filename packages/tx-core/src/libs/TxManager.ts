import { AsyncLocalStorage } from "node:async_hooks";
import type { TransactionContext } from "@croco/framework-context";
import type { Logger } from "@croco/framework-logger";
import {
  AfterCommitHooksProblem,
  InvalidTransactionTimeoutProblem,
  TransactionContextProblem,
  TransactionTimeoutProblem,
} from "./problems/TransactionProblems";
import type { TxAdapter } from "./TxAdapter";
import type { AfterCommitHook, NestingStrategy, TxManagerConfig, TxRunOptions } from "./types";

interface TxContext<TClient> {
  client: TClient;
  afterCommitHooks: AfterCommitHook[];
  isRoot: boolean;
}

type NullableTxContext<TClient> = TxContext<TClient> | null;

type TxManagerLogger = Pick<Logger, "error" | "warn">;

type AfterCommitHookFailure = {
  error: Error;
  name: string;
  message: string;
};

const DEFAULT_LOGGER: TxManagerLogger = console;
const MAX_TIMER_DELAY_MS = 2_147_483_647;

function assertValidTimeout(timeout: number, source: "default" | "run"): void {
  if (!Number.isSafeInteger(timeout) || timeout <= 0 || timeout > MAX_TIMER_DELAY_MS) {
    throw new InvalidTransactionTimeoutProblem(source, timeout);
  }
}

function getAbortReason(signal: AbortSignal): Error {
  return signal.reason instanceof Error ? signal.reason : new Error("Transaction aborted");
}

async function executeWithTimeout<T>(
  operation: () => Promise<T>,
  timeout: number,
  controller: AbortController,
): Promise<T> {
  const timeoutHandle = setTimeout(() => {
    controller.abort(new TransactionTimeoutProblem(timeout));
  }, timeout);

  try {
    const result = await operation();

    if (controller.signal.aborted) {
      throw getAbortReason(controller.signal);
    }

    return result;
  } catch (error) {
    if (controller.signal.aborted) {
      throw getAbortReason(controller.signal);
    }

    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

/**
 * AsyncLocalStorage 기반으로 현재 트랜잭션 컨텍스트를 관리하는 매니저입니다.
 */
export class TxManager<TClient, TOptions = unknown> implements TransactionContext {
  private readonly als = new AsyncLocalStorage<NullableTxContext<TClient>>();
  private readonly defaultNesting: NestingStrategy;
  private readonly defaultTimeout: number | undefined;
  private readonly logger: TxManagerLogger;

  constructor(adapter: TxAdapter<TClient, TOptions>, config?: TxManagerConfig);
  constructor(
    private readonly adapter: TxAdapter<TClient, TOptions>,
    config: TxManagerConfig = {},
    logger: TxManagerLogger = DEFAULT_LOGGER,
  ) {
    if (config.defaultTimeout !== undefined) {
      assertValidTimeout(config.defaultTimeout, "default");
    }

    this.defaultNesting = config.defaultNesting ?? "join";
    this.defaultTimeout = config.defaultTimeout;
    this.logger = logger;
  }

  async run<T>(fn: () => Promise<T>, runOptions?: TxRunOptions<TOptions>): Promise<T> {
    if (runOptions?.timeout !== undefined) {
      assertValidTimeout(runOptions.timeout, "run");
    }

    const nesting = runOptions?.nesting ?? this.defaultNesting;
    const options = runOptions?.options;
    const timeout = runOptions?.timeout ?? this.defaultTimeout;
    const currentContext = this.als.getStore();

    if (!currentContext) {
      return this.executeRoot(fn, options, timeout);
    }

    if (nesting === "join") {
      return fn();
    }

    return this.executeNested(currentContext, fn, options, timeout);
  }

  private async executeRoot<T>(
    fn: () => Promise<T>,
    options?: TOptions,
    timeout?: number,
  ): Promise<T> {
    const afterCommitHooks: AfterCommitHook[] = [];
    const controller = new AbortController();

    const executeTransaction = async (): Promise<T> => {
      const result = await this.adapter.transaction(
        async (client) => {
          const context: TxContext<TClient> = {
            client,
            afterCommitHooks,
            isRoot: true,
          };

          return this.setupContext(context, fn);
        },
        options,
        controller.signal,
      );

      if (afterCommitHooks.length > 0) {
        await this.setupContext(null, () => this.executeAfterCommitHooks(afterCommitHooks));
      }

      return result;
    };

    if (timeout !== undefined) {
      return executeWithTimeout(executeTransaction, timeout, controller);
    }

    return executeTransaction();
  }

  private async executeNested<T>(
    currentContext: TxContext<TClient>,
    fn: () => Promise<T>,
    options?: TOptions,
    timeout?: number,
  ): Promise<T> {
    if (!this.adapter.supportsSavepoint()) {
      this.warnSavepointNotSupported();
      return fn();
    }

    const nestedHooks: AfterCommitHook[] = [];
    let shouldMergeNestedHooks = false;
    const controller = new AbortController();

    const executeSavepoint = async (): Promise<T> => {
      const result = await this.adapter.savepoint(
        currentContext.client,
        async (nestedClient) => {
          const nestedContext: TxContext<TClient> = {
            client: nestedClient,
            afterCommitHooks: nestedHooks,
            isRoot: false,
          };

          const nestedResult = await this.setupContext(nestedContext, fn);
          shouldMergeNestedHooks = true;

          return nestedResult;
        },
        options,
        controller.signal,
      );

      if (shouldMergeNestedHooks) {
        currentContext.afterCommitHooks.push(...nestedHooks);
      }

      return result;
    };

    if (timeout !== undefined) {
      return executeWithTimeout(executeSavepoint, timeout, controller);
    }

    return executeSavepoint();
  }

  private async setupContext<T>(
    context: NullableTxContext<TClient>,
    fn: () => Promise<T>,
  ): Promise<T> {
    return this.als.run(context, fn);
  }

  getClient(): TClient | null {
    const context = this.als.getStore();
    return context?.client ?? null;
  }

  isInTransaction(): boolean {
    return this.als.getStore() != null;
  }

  onAfterCommit(hook: AfterCommitHook): void {
    const context = this.als.getStore();
    if (!context) {
      throw new TransactionContextProblem();
    }
    context.afterCommitHooks.push(hook);
  }

  private async executeAfterCommitHooks(hooks: AfterCommitHook[]): Promise<void> {
    const failures: AfterCommitHookFailure[] = [];

    for (const hook of hooks) {
      try {
        await hook();
      } catch (error) {
        const normalizedError = this.normalizeError(error);
        failures.push({
          error: normalizedError,
          name: normalizedError.name,
          message: normalizedError.message,
        });
        this.safeLog("error", "AfterCommit hook failed:", { error: normalizedError });
      }
    }

    if (failures.length > 0) {
      throw new AfterCommitHooksProblem(
        failures.map(({ name, message }) => ({ name, message })),
        failures[0].error,
      );
    }
  }

  private normalizeError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }

    return new Error(String(error));
  }

  /**
   * Suspend current transaction context and run function outside of it.
   * Used for REQUIRES_NEW propagation to ensure clean transaction state.
   */
  async suspend<T>(fn: () => Promise<T>): Promise<T> {
    return this.als.run(null, fn);
  }

  private warnSavepointNotSupported(): void {
    this.safeLog(
      "warn",
      "Savepoint nesting requested but adapter does not support savepoint. Falling back to join.",
    );
  }

  private safeLog(level: "error" | "warn", message: string, meta?: Record<string, unknown>): void {
    const formattedMessage = `[TxManager] ${message}`;

    if (meta) {
      this.logger[level](formattedMessage, meta);
      return;
    }

    this.logger[level](formattedMessage);
  }
}
