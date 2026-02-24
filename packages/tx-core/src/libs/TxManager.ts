import { AsyncLocalStorage } from 'node:async_hooks';
import { TRANSACTION_CONTEXT_TOKEN, type TransactionContext } from '@croco/events-core';
import { Container } from '@croco/framework-context';
import { Logger } from '@croco/framework-logger';
import type { TxAdapter } from './TxAdapter';
import type { AfterCommitHook, NestingStrategy, TxManagerConfig, TxRunOptions } from './types';

interface TxContext<TClient> {
  client: TClient;
  afterCommitHooks: AfterCommitHook[];
  isRoot: boolean;
}

type NullableTxContext<TClient> = TxContext<TClient> | null;

export class TxManager<TClient, TOptions = unknown> implements TransactionContext {
  private readonly als = new AsyncLocalStorage<NullableTxContext<TClient>>();
  private readonly defaultNesting: NestingStrategy;

  constructor(
    private readonly adapter: TxAdapter<TClient, TOptions>,
    config: TxManagerConfig = {}
  ) {
    this.defaultNesting = config.defaultNesting ?? 'join';
    Container.set(TRANSACTION_CONTEXT_TOKEN as never, this);
  }

  async run<T>(fn: () => Promise<T>, runOptions?: TxRunOptions<TOptions>): Promise<T> {
    const nesting = runOptions?.nesting ?? this.defaultNesting;
    const options = runOptions?.options;

    const currentContext = this.als.getStore();

    if (!currentContext) {
      const rootAfterCommitHooks: AfterCommitHook[] = [];

      const result = await this.adapter.transaction(async (client) => {
        const context: TxContext<TClient> = {
          client,
          afterCommitHooks: rootAfterCommitHooks,
          isRoot: true,
        };

        return this.als.run(context, fn);
      }, options);

      await this.executeAfterCommitHooks(rootAfterCommitHooks);

      return result;
    }

    if (nesting === 'join') {
      return fn();
    }

    if (!this.adapter.supportsSavepoint()) {
      this.warnSavepointNotSupported();
      return fn();
    }

    const nestedHooks: AfterCommitHook[] = [];
    let shouldMergeNestedHooks = false;

    const result = await this.adapter.savepoint(
      currentContext.client,
      async (nestedClient) => {
        const nestedContext: TxContext<TClient> = {
          client: nestedClient,
          afterCommitHooks: nestedHooks,
          isRoot: false,
        };

        const nestedResult = await this.als.run(nestedContext, fn);
        shouldMergeNestedHooks = true;

        return nestedResult;
      },
      options
    );

    if (shouldMergeNestedHooks) {
      currentContext.afterCommitHooks.push(...nestedHooks);
    }

    return result;
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
      throw new Error('onAfterCommit must be called within a transaction');
    }
    context.afterCommitHooks.push(hook);
  }

  private async executeAfterCommitHooks(hooks: AfterCommitHook[]): Promise<void> {
    for (const hook of hooks) {
      try {
        await hook();
      } catch (error) {
        this.safeLog('error', 'AfterCommit hook failed:', { error });
      }
    }
  }

  /**
   * Suspend current transaction context and run function outside of it.
   * Used for REQUIRES_NEW propagation to ensure clean transaction state.
   */
  async suspend<T>(fn: () => Promise<T>): Promise<T> {
    return this.als.run(null, fn);
  }

  private warnSavepointNotSupported(): void {
    this.safeLog('warn', 'Savepoint nesting requested but adapter does not support savepoint. Falling back to join.');
  }

  private safeLog(level: 'error' | 'warn', message: string, meta?: Record<string, unknown>): void {
    const formattedMessage = `[TxManager] ${message}`;
    try {
      const logger = Container.get(Logger);
      if (meta) {
        logger[level](formattedMessage, meta);
      } else {
        logger[level](formattedMessage);
      }
    } catch {
      if (meta) {
        console[level](formattedMessage, meta);
      } else {
        console[level](formattedMessage);
      }
    }
  }
}
