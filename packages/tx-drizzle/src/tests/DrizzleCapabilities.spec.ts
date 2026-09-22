import { describe, expectTypeOf, it } from "vitest";

import type {
  DrizzleDeleteCapability,
  DrizzleExecuteCapability,
  DrizzleInsertCapability,
  DrizzleSelectCapability,
  DrizzleTransactionCapability,
  DrizzleUpdateCapability,
} from "../index";

type QueryCapabilities = DrizzleSelectCapability<(table: string) => Promise<unknown[]>> &
  DrizzleInsertCapability<(table: string, value: unknown) => Promise<void>> &
  DrizzleUpdateCapability<(table: string, value: unknown) => Promise<void>> &
  DrizzleDeleteCapability<(table: string) => Promise<void>>;

type DatabaseCapabilities = QueryCapabilities &
  DrizzleExecuteCapability<(query: string) => Promise<unknown>> &
  DrizzleTransactionCapability<QueryCapabilities>;

describe("Drizzle database capabilities", () => {
  it("composes only the database methods required by an adapter", () => {
    expectTypeOf<DatabaseCapabilities>().toHaveProperty("execute");
    expectTypeOf<DatabaseCapabilities>().toHaveProperty("transaction");
    expectTypeOf<DatabaseCapabilities>().toHaveProperty("select");
    expectTypeOf<DatabaseCapabilities>().toHaveProperty("insert");
    expectTypeOf<DatabaseCapabilities>().toHaveProperty("update");
    expectTypeOf<DatabaseCapabilities>().toHaveProperty("delete");
  });

  it("rejects clients that omit a required capability", () => {
    const executeOnly: DrizzleExecuteCapability<(query: string) => Promise<unknown>> = {
      execute: async (query) => query,
    };

    // @ts-expect-error A transaction-capable adapter cannot accept an execute-only client.
    const invalidDatabase: DatabaseCapabilities = executeOnly;

    expectTypeOf(invalidDatabase).toMatchTypeOf<DatabaseCapabilities>();
  });
});
