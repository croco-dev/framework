import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { compileCohortPredicate } from "../index";
import { asOf, input } from "./fixtures/cohortMaterialization";

const dialect = new PgDialect();
describe("parameterized compiler", () => {
  it.each(["2026-09-20", "2026-09-20T00:00:00", "invalid"])(
    "rejects asOf without a valid timezone: %s",
    (asOfValue) => {
      expect(() =>
        compileCohortPredicate(
          input.definition,
          input.registration,
          input.context,
          input.mapping,
          asOfValue,
        ),
      ).toThrow("timestamp");
    },
  );
  it("binds literals and rejects unauthorized fields and identifiers", () => {
    const query = dialect.sqlToQuery(
      compileCohortPredicate(
        input.definition,
        input.registration,
        input.context,
        input.mapping,
        asOf,
      ),
    );
    expect(query.sql).not.toContain("report.created");
    expect(query.params).toContain("report.created");
    expect(query.params).toContain("trial");
    expect(() =>
      compileCohortPredicate(
        input.definition,
        input.registration,
        { ...input.context, allowedFields: [] },
        input.mapping,
        asOf,
      ),
    ).toThrow();
    expect(() =>
      compileCohortPredicate(
        input.definition,
        input.registration,
        input.context,
        { ...input.mapping, facts: { plan: "plan; DROP TABLE users" } },
        asOf,
      ),
    ).toThrow();
  });
});
