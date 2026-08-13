import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";
import {
  addHealthEventIntents,
  removeHealthEventIntents,
  type CustomerHealthMigrationClient,
} from "../migrations/addHealthEventIntents";

describe("health event intent migrations", () => {
  const dialect = new PgDialect();

  it("creates the durable intent table and pending-delivery index", async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const db = { execute } as CustomerHealthMigrationClient;

    await addHealthEventIntents(db);

    expect(execute).toHaveBeenCalledTimes(8);
    expect(dialect.sqlToQuery(execute.mock.calls[0]?.[0] as SQL).sql).toContain("CREATE SEQUENCE");
    expect(dialect.sqlToQuery(execute.mock.calls[1]?.[0] as SQL).sql).toContain(
      "ADD COLUMN IF NOT EXISTS transition_sequence",
    );
    expect(dialect.sqlToQuery(execute.mock.calls[2]?.[0] as SQL).sql).toContain("ROW_NUMBER()");
    expect(dialect.sqlToQuery(execute.mock.calls[3]?.[0] as SQL).sql).toContain("setval");
    expect(dialect.sqlToQuery(execute.mock.calls[4]?.[0] as SQL).sql).toContain("SET DEFAULT");
    expect(dialect.sqlToQuery(execute.mock.calls[5]?.[0] as SQL).sql).toContain("OWNED BY");
    expect(dialect.sqlToQuery(execute.mock.calls[6]?.[0] as SQL).sql).toContain(
      "tenant_health_event_intents",
    );
    expect(dialect.sqlToQuery(execute.mock.calls[7]?.[0] as SQL).sql).toContain(
      "tenant_health_event_intents_pending_idx",
    );
  });

  it("removes the durable intent table", async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const db = { execute } as CustomerHealthMigrationClient;

    await removeHealthEventIntents(db);

    expect(execute).toHaveBeenCalledTimes(2);
    expect(dialect.sqlToQuery(execute.mock.calls[0]?.[0] as SQL).sql).toContain(
      "DROP TABLE IF EXISTS",
    );
    expect(dialect.sqlToQuery(execute.mock.calls[1]?.[0] as SQL).sql).toContain(
      "transition_sequence",
    );
  });
});
