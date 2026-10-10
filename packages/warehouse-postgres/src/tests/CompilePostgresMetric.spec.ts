import { beforeAll, describe, expect, it } from "vitest";
import {
  average,
  count,
  dateBucket,
  defineMetric,
  eq,
  exactDistinct,
  max,
  min,
  project,
  ratio,
  sum,
} from "@croco/metrics-core";
import type { MetricDefinition, MetricExpression } from "@croco/metrics-core";
import { c, compileFact, defineFact } from "@croco/warehouse-core";
import type { FactDescriptor } from "@croco/warehouse-core";
import { compilePostgresMetric, decodePostgresMetricResult } from "../facts/compilePostgresMetric";
import { factColumnName, quoteIdentifier } from "../facts/schema";

let fact: FactDescriptor;
beforeAll(async () => {
  fact = await compileFact(
    defineFact("metric_facts", {
      version: 1,
      kind: "transaction",
      scope: "tenant",
      grain: { description: "payment", key: ["id"] },
      columns: {
        id: c.id(),
        at: c.instant({ precision: "microsecond" }),
        amount: c.decimal({ precision: 38, scale: 2 }),
        currency: c.currencyCode(),
        total: c.moneyMinor({ currency: "currency" }),
        label: c.nullable(c.string()),
        day: c.date({ zone: "UTC" }),
      },
      time: { event: "at" },
      write: { mode: "append", duplicate: "ignore-identical", conflict: "reject" },
    }),
  );
});
const window = { from: "2026-01-01T00:00:00Z", to: "2026-02-01T00:00:00Z" };
function definition(measure: MetricExpression = count()): MetricDefinition {
  return defineMetric("payments", {
    version: 1,
    from: fact,
    measure,
    time: project(fact, "at"),
    unit: "payments",
    population: "paid",
  });
}
function compile(metric = definition()) {
  return compilePostgresMetric(fact, metric, window, "scope", 3, 10, 4096);
}

describe("native PostgreSQL metric compiler", () => {
  it("binds window, scope, revision and suppression and bounds the aggregate before transfer", () => {
    const result = compile();
    expect(result.sql).toContain("count(*)::text");
    expect(result.sql).toContain("warehouse_suppressions");
    expect(result.sql).toContain("f._visible_from <=");
    expect(result.sql).toContain("LIMIT (");
    expect(result.sql).toContain("octet_length(result::text)");
    expect(result.sql).toContain("CASE WHEN exceeded THEN NULL");
    expect(result.params).toEqual(
      expect.arrayContaining([window.from, window.to, "scope", 3, 10, 4096]),
    );
    expect(result.requiredColumns).toEqual(["at"]);
  });
  it("compiles all primitive aggregates with exact numeric results", () => {
    const amount = project(fact, "amount");
    for (const [expression, sql] of [
      [sum(amount), "COALESCE(sum("],
      [min(amount), "min("],
      [max(amount), "max("],
      [exactDistinct(amount), "count(DISTINCT"],
      [count(amount), "count(f."],
    ] as const) {
      expect(compile(definition(expression)).sql).toContain(sql);
    }
  });
  it("binds filters and zones and includes currency in authorization columns", () => {
    const metric = defineMetric("money", {
      ...definition(),
      measure: sum(project(fact, "total")),
      filter: eq(project(fact, "currency"), "USD"),
      bucket: dateBucket("month", "America/New_York"),
    });
    const result = compile(metric);
    expect(result.requiredColumns).toEqual(["at", "currency", "total"]);
    expect(result.params).toEqual(expect.arrayContaining(["USD", "America/New_York", "YYYY-MM"]));
    expect(result.sql).not.toContain("America/New_York");
  });
  it("compares date filters as canonical text without PostgreSQL alias or alternate date coercion", () => {
    for (const value of ["tomorrow", "2026-1-2", "2026-01-02"]) {
      const metric = defineMetric("filtered", {
        ...definition(),
        filter: eq(project(fact, "day"), value),
      });
      const result = compile(metric);
      const column = `f.${quoteIdentifier(factColumnName(fact, "day"))}`;
      const bound = `$${result.params.indexOf(value) + 1}`;
      expect(result.sql).toContain(`to_char(${column}, 'YYYY-MM-DD') = ${bound}::text`);
      expect(result.params).toContain(value);
    }
  });
  it("formats date groups as ISO independently of DateStyle and preserves fixed-scale numeric groups", () => {
    const metric = defineMetric("grouped", {
      ...definition(),
      groupByRequired: [project(fact, "day"), project(fact, "amount")],
    });
    const result = compile(metric);
    const dateColumn = `f.${quoteIdentifier(factColumnName(fact, "day"))}`;
    const numericColumn = `f.${quoteIdentifier(factColumnName(fact, "amount"))}`;
    expect(result.sql).toContain(`to_char(${dateColumn}, 'YYYY-MM-DD')`);
    expect(result.sql).not.toContain(`${dateColumn}::text`);
    expect(result.sql).toContain(`${numericColumn}::text`);
    expect(
      decodePostgresMetricResult(metric, {
        exceeded: false,
        results: [{ group: { day: "2026-01-02", amount: "-12345678901234567890.10" }, value: "1" }],
      }),
    ).toEqual([{ group: { day: "2026-01-02", amount: "-12345678901234567890.10" }, value: "1" }]);
  });
  it("rejects altered descriptor metadata and nullable grouping", () => {
    const altered = {
      ...fact,
      columns: { ...fact.columns, amount: { type: "decimal", precision: 38, scale: 3 } },
    } as FactDescriptor;
    const metric = defineMetric("altered", {
      ...definition(),
      from: altered,
      time: project(altered, "at"),
    });
    expect(() => compile(metric)).toThrow("METRIC_DESCRIPTOR_MISMATCH");
    expect(() =>
      compile(
        defineMetric("nullable", { ...definition(), groupByRequired: [project(fact, "label")] }),
      ),
    ).toThrow("METRIC_INVALID_GROUP");
  });
  it("rejects reversed or unsupported nanosecond windows", () => {
    expect(() =>
      compilePostgresMetric(
        fact,
        definition(),
        { from: window.to, to: window.from },
        "s",
        1,
        10,
        100,
      ),
    ).toThrow("METRIC_INVALID_WINDOW");
    expect(() =>
      compilePostgresMetric(
        fact,
        definition(),
        { ...window, from: "2026-01-01T00:00:00.000000001Z" },
        "s",
        1,
        10,
        100,
      ),
    ).toThrow("METRIC_INVALID_WINDOW");
  });
  it("rejects result sentinels and empty extrema, retaining empty zero aggregates", () => {
    expect(() => decodePostgresMetricResult(definition(), undefined)).toThrow(
      "METRIC_INVALID_RESULT",
    );
    expect(() =>
      decodePostgresMetricResult(definition(), { exceeded: true, results: null }),
    ).toThrow("METRIC_RESULT_LIMIT");
    expect(() =>
      decodePostgresMetricResult(definition(min(project(fact, "amount"))), {
        exceeded: false,
        results: [{ group: {}, value: null }],
      }),
    ).toThrow("METRIC_EMPTY_EXTREMA");
    expect(
      decodePostgresMetricResult(definition(), {
        exceeded: false,
        results: [{ group: {}, value: "0" }],
      }),
    ).toEqual([{ group: {}, value: "0" }]);
  });
  it("preserves wide aggregate integers and trims decimal zeros", () => {
    expect(
      decodePostgresMetricResult(definition(sum(project(fact, "amount"))), {
        exceeded: false,
        results: [{ group: {}, value: "18446744073709551614.00" }],
      })[0].value,
    ).toBe("18446744073709551614");
  });
  it("uses exact half-even quotient rounding with zero and signed denominators", () => {
    const metric = definition(
      ratio({ numerator: count(), denominator: count(), zeroDenominator: "null" }),
    );
    for (const [numerator, denominator, value] of [
      ["1", "2000000000000", "0"],
      ["3", "2000000000000", "0.000000000002"],
      ["-1", "3", "-0.333333333333"],
      ["1", "0", null],
    ]) {
      expect(
        decodePostgresMetricResult(metric, {
          exceeded: false,
          results: [{ group: {}, numerator, denominator }],
        })[0].value,
      ).toBe(value);
    }
    const avg = definition(average(sum(project(fact, "amount")), count(project(fact, "amount"))));
    expect(
      decodePostgresMetricResult(avg, {
        exceeded: false,
        results: [{ group: {}, numerator: "1.00", denominator: "3" }],
      })[0],
    ).toMatchObject({
      numerator: "1",
      denominator: "3",
      value: "0.333333333333",
      valueScale: 12,
      valueRounding: "half-even",
    });
  });
});
