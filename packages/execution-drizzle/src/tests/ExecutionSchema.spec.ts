import { getTableColumns } from "drizzle-orm";
import { describe, expect, expectTypeOf, it } from "vitest";

import { executions } from "../libs/schema";
import type { NewExecutionRow } from "../libs/schema";

describe("executions schema", () => {
  it("stores timeout values as PostgreSQL bigint numbers", () => {
    const columns = getTableColumns(executions);

    expect(columns.timeout.getSQLType()).toBe("bigint");
    expectTypeOf<NewExecutionRow["timeout"]>().toEqualTypeOf<number | null | undefined>();
  });

  it.each([2_147_483_647, 2_147_483_648])(
    "maps timeout %i to the existing number contract without narrowing",
    (timeout) => {
      const column = getTableColumns(executions).timeout;

      expect(column.mapToDriverValue(timeout)).toBe(timeout);
      expect(column.mapFromDriverValue(String(timeout))).toBe(timeout);
    },
  );
});
