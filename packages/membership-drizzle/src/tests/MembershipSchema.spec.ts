import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { memberships } from "../libs/schema";

describe("Membership timestamp schema", () => {
  it.each([memberships.createdAt, memberships.updatedAt])(
    "stores UTC wall-clock defaults for $name",
    (column) => {
      expect(column.getSQLType()).toBe("timestamp");
      expect(column.default).toBeDefined();
      const dialect = new PgDialect();
      expect(dialect.sqlToQuery(sql`${column.default}`).sql).toBe("(now() at time zone 'utc')");
    },
  );
});
