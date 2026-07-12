import { Container } from "@croco/framework-context";
import { Logger } from "@croco/framework-logger";
import type { TxAdapter } from "@croco/tx-core";
import { sql } from "drizzle-orm";
import { createDrizzleTxAdapter } from "./DrizzleTxAdapter";
import {
  RlsExecuteUnsupportedProblem,
  TenantContextRequiredProblem,
} from "./problems/TxDrizzleProblems";
import { validateRlsConfigKey } from "./RlsSql";
import type { DrizzleDb, InferTxClient, InferTxOptions } from "./types";

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
  if (typeof client !== "object" || client === null || !("execute" in client)) {
    return false;
  }

  const executableClient = client as { execute?: unknown };
  return typeof executableClient.execute === "function";
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
  options: RlsOptions = {},
): TxAdapter<InferTxClient<TDb>, InferTxOptions<TDb>> {
  const configKey = validateRlsConfigKey(options.configKey ?? "app.current_tenant");
  const baseAdapter = createDrizzleTxAdapter(db);

  // Try to resolve logger, fallback to null if not available
  let logger: Logger | null = null;
  try {
    logger = Container.get(Logger);
  } catch {
    // Logger might not be registered
  }

  return {
    async transaction<T>(
      fn: (client: InferTxClient<TDb>) => Promise<T>,
      txOptions?: InferTxOptions<TDb>,
      signal?: AbortSignal,
    ): Promise<T> {
      const tenantId = getTenantIdOrThrow(tenantProvider);

      return baseAdapter.transaction(
        async (tx) => {
          if (options.debug) {
            logger?.info(`[RlsTxAdapter] Setting ${configKey} = '${tenantId}'`);
          }

          // Drizzle transaction client usually has .execute
          if (!supportsExecute(tx)) {
            const problem = new RlsExecuteUnsupportedProblem(configKey);
            logger?.error(`[RlsTxAdapter] ${problem.detail}`);
            throw problem;
          }

          await tx.execute(sql`select set_config(${configKey}, ${tenantId}, true)`);

          return fn(tx);
        },
        txOptions,
        signal,
      );
    },

    async savepoint<T>(
      client: InferTxClient<TDb>,
      fn: (client: InferTxClient<TDb>) => Promise<T>,
      txOptions?: InferTxOptions<TDb>,
      signal?: AbortSignal,
    ): Promise<T> {
      // Nested transactions inherit RLS settings from the parent.
      return baseAdapter.savepoint(client, fn, txOptions, signal);
    },

    supportsSavepoint() {
      return baseAdapter.supportsSavepoint();
    },
  };
}
