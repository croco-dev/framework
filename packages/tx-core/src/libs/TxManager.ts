import { AsyncLocalStorage } from 'node:async_hooks';
import type { TxAdapter } from './TxAdapter';
import type { NestingStrategy, TxManagerConfig, TxRunOptions } from './types';

interface TxContext<TClient> {
  client: TClient;
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
      return this.adapter.transaction(async (client) => {
        return this.als.run({ client }, fn);
      }, options);
    }

    if (nesting === 'join') {
      return fn();
    }

    if (!this.adapter.supportsSavepoint()) {
      return fn();
    }

    return this.adapter.savepoint(
      currentContext.client,
      async (nestedClient) => {
        return this.als.run({ client: nestedClient }, fn);
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

  /**
   * Suspend current transaction context and run function outside of it.
   * Used for REQUIRES_NEW propagation to ensure clean transaction state.
   */
  async suspend<T>(fn: () => Promise<T>): Promise<T> {
    return this.als.run(undefined as unknown as TxContext<TClient>, fn);
  }
}
