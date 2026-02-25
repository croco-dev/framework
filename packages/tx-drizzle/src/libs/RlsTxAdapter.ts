import { Container } from '@croco/framework-context';
import { Logger } from '@croco/framework-logger';
import type { TxAdapter } from '@croco/tx-core';
import { sql } from 'drizzle-orm';
import { createDrizzleTxAdapter } from './DrizzleTxAdapter';
import { TenantContextRequiredProblem } from './problems/TxDrizzleProblems';
import type { DrizzleDb, InferTxClient, InferTxOptions } from './types';

export interface RlsTenantProvider {
  getTenantId(): string | null;
}

export interface RlsOptions {
  /**
   * The configuration parameter name to use for RLS.
   * @default 'app.current_tenant'
   */
  configKey?: string;
  /**
   * If true, logs when RLS variable is set.
   * @default false
   */
  debug?: boolean;
}

type ExecutableTransactionClient = {
  execute(query: unknown): Promise<unknown>;
};

function supportsExecute(client: unknown): client is ExecutableTransactionClient {
  if (typeof client !== 'object' || client === null || !('execute' in client)) {
    return false;
  }

  const executableClient = client as { execute?: unknown };
  return typeof executableClient.execute === 'function';
}

function getTenantIdOrThrow(tenantProvider: RlsTenantProvider): string {
  const tenantId = tenantProvider.getTenantId();

  if (!tenantId) {
    throw new TenantContextRequiredProblem();
  }

  return tenantId;
}

export function createRlsTxAdapter<TDb extends DrizzleDb>(
  db: TDb,
  tenantProvider: RlsTenantProvider,
  options: RlsOptions = {}
): TxAdapter<InferTxClient<TDb>, InferTxOptions<TDb>> {
  const baseAdapter = createDrizzleTxAdapter(db);
  const configKey = options.configKey ?? 'app.current_tenant';

  // Try to resolve logger, fallback to null if not available
  let logger: Logger | null = null;
  try {
    logger = Container.get(Logger);
  } catch {
    // Logger might not be registered
  }

  return {
    async transaction<T>(fn: (client: InferTxClient<TDb>) => Promise<T>, txOptions?: InferTxOptions<TDb>): Promise<T> {
      const tenantId = getTenantIdOrThrow(tenantProvider);

      return baseAdapter.transaction(async (tx) => {
        if (options.debug) {
          logger?.info(`[RlsTxAdapter] Setting ${configKey} = '${tenantId}'`);
        }

        // Drizzle transaction client usually has .execute
        if (!supportsExecute(tx)) {
          logger?.warn('[RlsTxAdapter] Transaction client does not support .execute(), skipping RLS setup');
          return fn(tx);
        }

        await tx.execute(sql`SET LOCAL ${sql.raw(configKey)} = ${tenantId}`);

        return fn(tx);
      }, txOptions);
    },

    async savepoint<T>(
      client: InferTxClient<TDb>,
      fn: (client: InferTxClient<TDb>) => Promise<T>,
      txOptions?: InferTxOptions<TDb>
    ): Promise<T> {
      // Nested transactions inherit RLS settings from the parent.
      return baseAdapter.savepoint(client, fn, txOptions);
    },

    supportsSavepoint() {
      return baseAdapter.supportsSavepoint();
    },
  };
}
