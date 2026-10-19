import { sql } from "drizzle-orm";
import { Problem, ProblemCategory } from "@croco/problems-core";
import { createDrizzleTxAdapter } from "./libs/DrizzleTxAdapter";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgTransactionConfig } from "drizzle-orm/pg-core";
import type { Client as PgClient } from "pg";
import type { InferTxClient } from "./libs/types";
// Driver modules load inside the request, keeping the pg peer optional during import.

/** Native Worker binding subset; no Cloudflare SDK or global environment lookup. */
export type HyperdriveBinding = { readonly connectionString: string };
export type HyperdriveTransactionClient = InferTxClient<NodePgDatabase>;
export type HyperdriveTransactionPhase = "configuration" | "connect" | "transaction" | "close";
export type HyperdriveTransactionOutcome = "not-started" | "unknown" | "committed";

export type HyperdriveTransactionOptions = {
  readonly signal?: AbortSignal;
  /** Driver connection deadline, in milliseconds. Defaults to 5000. */
  readonly connectionTimeoutMs?: number;
  /** PostgreSQL statement_timeout, in milliseconds. Defaults to 10000. */
  readonly statementTimeoutMs?: number;
  /** Abort drain deadline passed to the existing Drizzle adapter. Defaults to 5000. */
  readonly operationDrainTimeoutMs?: number;
  readonly transaction?: PgTransactionConfig;
};

/** Redacted boundary error. No connection string, SQL, parameters or driver cause is retained. */
export class HyperdriveTransactionProblem extends Problem {
  readonly code = "tx-drizzle/hyperdrive-transaction-failed";
  readonly category = ProblemCategory.InternalServerError;

  constructor(
    phase: HyperdriveTransactionPhase,
    outcome: HyperdriveTransactionOutcome,
    aborted: boolean,
    cleanupFailed = false,
  ) {
    super(
      "tx-drizzle/hyperdrive-transaction-failed",
      ProblemCategory.InternalServerError,
      `Hyperdrive transaction failed during ${phase}`,
      {
        extensions: { phase, outcome, aborted, cleanupFailed, retryable: false },
      },
    );
  }
}

function isDeadline(value: number): boolean {
  return Number.isInteger(value) && value > 0 && value <= 2_147_483_647;
}

/**
 * Runs one transaction on a fresh request-owned pg connection and awaits its close.
 * Reuses the existing Drizzle abort/savepoint boundary. Never retries or installs a global provider.
 * A transaction failure has an unknown outcome; a close failure after success is marked committed.
 * Callers must await all work and must not retain the transaction client after the callback returns.
 * Local workerd evidence does not certify a deployed Hyperdrive service or any durable domain adapter.
 */
export async function withHyperdriveTransaction<T>(
  binding: HyperdriveBinding | undefined,
  operation: (tx: HyperdriveTransactionClient) => Promise<T>,
  options: HyperdriveTransactionOptions = {},
): Promise<T> {
  const connectionTimeoutMs = options.connectionTimeoutMs ?? 5000;
  const statementTimeoutMs = options.statementTimeoutMs ?? 10000;
  const operationDrainTimeoutMs = options.operationDrainTimeoutMs ?? 5000;
  if (
    !binding ||
    typeof binding.connectionString !== "string" ||
    !binding.connectionString.trim() ||
    ![connectionTimeoutMs, statementTimeoutMs, operationDrainTimeoutMs].every(isDeadline)
  ) {
    throw new HyperdriveTransactionProblem("configuration", "not-started", false);
  }
  if (options.signal?.aborted) {
    throw new HyperdriveTransactionProblem("connect", "not-started", true);
  }

  let phase: HyperdriveTransactionPhase = "connect";
  let outcome: HyperdriveTransactionOutcome = "not-started";
  let failed = false;
  let cleanupFailed = false;
  let result: T | undefined;
  let client: PgClient | undefined;
  // pg can emit idle socket errors independently of a query promise. Contain them at this boundary.
  let transportFailed = false;
  try {
    const [{ drizzle }, { Client }] = await Promise.all([
      import("drizzle-orm/node-postgres"),
      import("pg"),
    ]);
    client = new Client({
      connectionString: binding.connectionString,
      connectionTimeoutMillis: connectionTimeoutMs,
    });
    client.on("error", () => {
      transportFailed = true;
    });
    await client.connect();
    const db = drizzle(client);
    // Recheck after connect: abort during connection acquisition must not enter user code.
    if (options.signal?.aborted || transportFailed) {
      failed = true;
    } else {
      phase = "transaction";
      outcome = "unknown";
      result = await createDrizzleTxAdapter(db, { operationDrainTimeoutMs }).transaction(
        async (tx) => {
          // Transaction-local state survives transaction pooling without leaking to the next borrower.
          await tx.execute(
            sql`select set_config('statement_timeout', ${String(statementTimeoutMs)}, true)`,
          );
          return operation(tx);
        },
        options.transaction,
        options.signal,
      );
      outcome = "committed";
      phase = "close";
    }
  } catch {
    failed = true;
  } finally {
    if (client) {
      try {
        await client.end();
      } catch {
        cleanupFailed = true;
      }
    }
  }
  if (failed || cleanupFailed || transportFailed) {
    throw new HyperdriveTransactionProblem(
      phase,
      outcome,
      options.signal?.aborted ?? false,
      cleanupFailed,
    );
  }
  return result as T;
}
