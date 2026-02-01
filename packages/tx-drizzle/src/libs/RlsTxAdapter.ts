import type { TxAdapter } from '@croco/tx-core';
import { sql } from 'drizzle-orm';
import { createDrizzleTxAdapter } from './DrizzleTxAdapter';
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

export function createRlsTxAdapter<TDb extends DrizzleDb>(
  db: TDb,
  tenantProvider: RlsTenantProvider,
  options: RlsOptions = {}
): TxAdapter<InferTxClient<TDb>, InferTxOptions<TDb>> {
  const baseAdapter = createDrizzleTxAdapter(db);
  const configKey = options.configKey ?? 'app.current_tenant';

  return {
    async transaction<T>(fn: (client: InferTxClient<TDb>) => Promise<T>, txOptions?: InferTxOptions<TDb>): Promise<T> {
      return baseAdapter.transaction(async (tx) => {
        const tenantId = tenantProvider.getTenantId();

        if (tenantId) {
          if (options.debug) {
            console.log(`[RlsTxAdapter] Setting ${configKey} = '${tenantId}'`);
          }

          // Drizzle transaction client usually has .execute
          if (typeof (tx as any).execute === 'function') {
            await (tx as any).execute(sql`SET LOCAL ${sql.raw(configKey)} = ${tenantId}`);
          } else {
            console.warn('[RlsTxAdapter] Transaction client does not support .execute(), skipping RLS setup');
          }
        }

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
