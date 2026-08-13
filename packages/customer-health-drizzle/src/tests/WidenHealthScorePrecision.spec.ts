import type { SQLWrapper } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  widenHealthScorePrecisionPostgres,
  type HealthScorePrecisionMigrationClient,
} from "../migrations/widenHealthScorePrecision";

describe("widenHealthScorePrecisionPostgres", () => {
  let rootExecute: ReturnType<typeof vi.fn<(query: SQLWrapper) => Promise<unknown>>>;
  let transactionExecute: ReturnType<typeof vi.fn<(query: SQLWrapper) => Promise<unknown>>>;
  let transactionSpy: ReturnType<typeof vi.fn<() => void>>;
  let client: HealthScorePrecisionMigrationClient;

  beforeEach(() => {
    rootExecute = vi.fn().mockResolvedValue(undefined);
    transactionExecute = vi.fn().mockResolvedValue(undefined);
    transactionSpy = vi.fn();
    const transaction: HealthScorePrecisionMigrationClient["transaction"] = async <T>(
      callback: (tx: { execute(query: SQLWrapper): Promise<unknown> }) => Promise<T>,
    ): Promise<T> => {
      transactionSpy();
      return callback({ execute: transactionExecute });
    };
    client = { execute: rootExecute, transaction };
  });

  it("widens current and previous scores to double precision in one transaction", async () => {
    await widenHealthScorePrecisionPostgres(client);

    expect(transactionSpy).toHaveBeenCalledTimes(1);
    expect(rootExecute).not.toHaveBeenCalled();
    const renderedSql = transactionExecute.mock.calls.map(([query]) =>
      (query as unknown as { queryChunks: Array<{ value?: string[] }> }).queryChunks
        .flatMap((chunk) => chunk.value ?? [])
        .join("")
        .replace(/\s+/g, " ")
        .trim(),
    );
    expect(renderedSql).toEqual([
      "ALTER TABLE tenant_health_scores ALTER COLUMN overall_score TYPE DOUBLE PRECISION, " +
        "ALTER COLUMN previous_score TYPE DOUBLE PRECISION",
    ]);
  });
});
