import { AsyncLocalStorage } from 'node:async_hooks';
import { Container } from '@croco/framework-context';
import { Logger } from '@croco/framework-logger';
import type { TxAdapter } from './TxAdapter';
import type { AfterCommitHook, NestingStrategy, TxManagerConfig, TxRunOptions } from './types';

interface TxContext<TClient> {
  client: TClient;
  afterCommitHooks: AfterCommitHook[];
  isRoot: boolean;
}

export class TxManager<TClient, TOptions = unknown> {
  private readonly als = new AsyncLocalStorage<TxContext<TClient>>();
  private readonly defaultNesting: NestingStrategy;

  constructor(
    private readonly adapter: TxAdapter<TClient, TOptions>,
    config: TxManagerConfig = {}
  ) {
    this.defaultNesting = config.defaultNesting ?? 'join';
  }

  async run<T>(fn: () => Promise<T>, runOptions?: TxRunOptions<TOptions>): Promise<T> {
    const nesting = runOptions?.nesting ?? this.defaultNesting;
    const options = runOptions?.options;

    const currentContext = this.als.getStore();

    if (!currentContext) {
      const context: TxContext<TClient> = {
        client: null as unknown as TClient,
        afterCommitHooks: [],
        isRoot: true,
      };

      const result = await this.adapter.transaction(async (client) => {
        context.client = client;
        return this.als.run(context, fn);
      }, options);

      await this.executeAfterCommitHooks(context.afterCommitHooks);

      return result;
    }

    if (nesting === 'join') {
      return fn();
    }

    if (!this.adapter.supportsSavepoint()) {
      return fn();
    }

    const nestedContext: TxContext<TClient> = {
      client: currentContext.client,
      afterCommitHooks: currentContext.afterCommitHooks,
      isRoot: false,
    };

    return this.adapter.savepoint(
      currentContext.client,
      async (nestedClient) => {
        nestedContext.client = nestedClient;
        return this.als.run(nestedContext, fn);
      },
      options
    );
  }

  getClient(): TClient | null {
    const context = this.als.getStore();
    return context?.client ?? null;
  }

  isInTransaction(): boolean {
    return this.als.getStore() !== undefined;
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
        try {
          const logger = Container.get(Logger);
          logger.error('[TxManager] AfterCommit hook failed:', error as Error);
        } catch {
          console.error('[TxManager] AfterCommit hook failed:', error);
        }
      }
    }
  }

  /**
   * Suspend current transaction context and run function outside of it.
   * Used for REQUIRES_NEW propagation to ensure clean transaction state.
   */
  async suspend<T>(fn: () => Promise<T>): Promise<T> {
    return this.als.run(undefined as unknown as TxContext<TClient>, fn);
  }
}
