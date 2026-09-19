import type { SQL, SQLWrapper } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import { widenUsageRecordIdsPostgres } from "../migrations/widenUsageRecordIds";
import type { UsageRecordIdMigrationClient } from "../migrations/widenUsageRecordIds";

describe("widenUsageRecordIdsPostgres", () => {
  it("preserves existing UUID values while accepting metering operation IDs", async () => {
    const dialect = new PgDialect();
    const execute = vi.fn().mockResolvedValue(undefined);
    const transaction: UsageRecordIdMigrationClient["transaction"] = async <T>(
      callback: (tx: { execute(query: SQLWrapper): Promise<unknown> }) => Promise<T>,
    ): Promise<T> => callback({ execute });

    await widenUsageRecordIdsPostgres({ execute, transaction });

    expect(execute).toHaveBeenCalledTimes(1);
    const rendered = dialect.sqlToQuery(execute.mock.calls[0]?.[0] as SQL);
    expect(rendered.sql.replace(/\s+/g, " ").trim()).toBe(
      "ALTER TABLE usage_records ALTER COLUMN id DROP DEFAULT, ALTER COLUMN id TYPE TEXT USING id::text, ALTER COLUMN id SET DEFAULT gen_random_uuid()::text",
    );
  });
});
