import { describe, expect, it, vi } from "vitest";

import { widenMeteringIntegersPostgres } from "../migrations/widenMeteringIntegers";
import type { MeteringIntegerMigrationClient } from "../migrations/widenMeteringIntegers";

describe("widenMeteringIntegersPostgres", () => {
  it("widens PostgreSQL usage and quota columns to BIGINT", async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const transactionSpy = vi.fn();
    const transaction: MeteringIntegerMigrationClient["transaction"] = async <T>(
      callback: (tx: { execute(query: unknown): Promise<unknown> }) => Promise<T>,
    ): Promise<T> => {
      transactionSpy();
      return callback({ execute });
    };

    await widenMeteringIntegersPostgres({ execute, transaction });

    expect(transactionSpy).toHaveBeenCalledTimes(1);
    const renderedSql = execute.mock.calls.map(([query]) =>
      (query as { queryChunks: Array<{ value?: string[] }> }).queryChunks
        .flatMap((chunk) => chunk.value ?? [])
        .join(""),
    );
    expect(renderedSql).toEqual([
      "ALTER TABLE meters ALTER COLUMN quota TYPE BIGINT",
      "ALTER TABLE usage_records ALTER COLUMN value TYPE BIGINT",
    ]);
  });
});
