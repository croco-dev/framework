import { describe, expect, it } from "vitest";

import {
  average,
  compileMetric,
  count,
  dateBucket,
  defineMetric,
  eq,
  evaluateMetric,
  exactDistinct,
  max,
  min,
  MetricExpressionError,
  project,
  ratio,
  sum,
} from "../index";
import type { MetricExpression } from "../index";

const captures = {
  name: "captures",
  kind: "transaction",
  sourceRefs: ["payments"],
  columns: {
    capturedAt: { type: "instant", precision: "millisecond" },
    amountMinor: { type: "money", currency: "currency" },
    currency: { type: "currency" },
    customer: { type: "id" },
  },
} as const;
const events = {
  name: "events",
  kind: "transaction",
  columns: {
    at: { type: "instant" },
    clicks: { type: "int64" },
    impressions: { type: "int64" },
    latency: { type: "decimal", scale: 2 },
  },
} as const;
const window = { from: "2026-01-01T00:00:00.000Z", to: "2027-01-01T00:00:00.000Z" };

describe("MetricExpression", () => {
  it("keeps currency sums and large int64 exact, with a half-open window", () => {
    const metric = defineMetric("cash_received", {
      version: 1,
      from: captures,
      measure: sum(project(captures, "amountMinor")),
      groupByRequired: [project(captures, "currency")],
      time: project(captures, "capturedAt"),
      unit: "minor",
      population: "captured payments",
    });
    expect(
      evaluateMetric(
        metric,
        [
          {
            capturedAt: window.from,
            amountMinor: "9007199254740993",
            currency: "USD",
            customer: "a",
          },
          { capturedAt: window.from, amountMinor: "7", currency: "USD", customer: "b" },
          { capturedAt: window.from, amountMinor: "3", currency: "EUR", customer: "c" },
          { capturedAt: window.to, amountMinor: "100", currency: "USD", customer: "d" },
        ],
        window,
      ),
    ).toEqual([
      { group: { currency: "EUR" }, value: "3" },
      { group: { currency: "USD" }, value: "9007199254741000" },
    ]);
    expect(() =>
      defineMetric("mixed", {
        version: 1,
        from: captures,
        measure: sum(project(captures, "amountMinor")),
        time: project(captures, "capturedAt"),
        unit: "minor",
        population: "all",
      }),
    ).toThrowError("METRIC_MIXED_CURRENCY");
  });

  it("preserves numerator, denominator, and null for zero denominator", () => {
    const metric = defineMetric("ctr", {
      version: 1,
      from: events,
      measure: ratio({
        numerator: sum(project(events, "clicks")),
        denominator: sum(project(events, "impressions")),
        zeroDenominator: "null",
      }),
      time: project(events, "at"),
      unit: "ratio",
      population: "delivered impressions",
    });
    expect(
      evaluateMetric(
        metric,
        [
          { at: window.from, clicks: "2", impressions: "8", latency: "1.00" },
          { at: window.from, clicks: "1", impressions: "4", latency: "2.00" },
        ],
        window,
      ),
    ).toEqual([
      {
        group: {},
        value: "0.25",
        numerator: "3",
        denominator: "12",
        valueScale: 12,
        valueRounding: "half-even",
      },
    ]);
    expect(evaluateMetric(metric, [], window)).toEqual([
      {
        group: {},
        value: null,
        numerator: "0",
        denominator: "0",
        valueScale: 12,
        valueRounding: "half-even",
      },
    ]);
  });

  it("rejects ratio operands with different aggregate scales at definition time", () => {
    const decimalEvents = {
      ...events,
      columns: { ...events.columns, latencyFine: { type: "decimal", scale: 3 } },
    } as const;
    const latency = project(decimalEvents, "latency");
    const latencyFine = project(decimalEvents, "latencyFine");
    for (const measure of [
      ratio({ numerator: sum(latency), denominator: sum(latencyFine), zeroDenominator: "null" }),
      ratio({ numerator: sum(latency), denominator: count(), zeroDenominator: "null" }),
      ratio({ numerator: sum(latency), denominator: count(latency), zeroDenominator: "null" }),
    ]) {
      expect(() =>
        defineMetric("invalid_ratio_scale", {
          version: 1,
          from: decimalEvents,
          measure,
          time: project(decimalEvents, "at"),
          unit: "ratio",
          population: "events",
        }),
      ).toThrowError("METRIC_RATIO_UNIT_MISMATCH");
    }

    expect(() =>
      defineMetric("count_ratio", {
        version: 1,
        from: decimalEvents,
        measure: ratio({
          numerator: count(latency),
          denominator: count(latencyFine),
          zeroDenominator: "null",
        }),
        time: project(decimalEvents, "at"),
        unit: "ratio",
        population: "events",
      }),
    ).not.toThrow();
  });

  it("calculates a sum/count average and exact distinct from raw rows", () => {
    const averageMetric = defineMetric("latency", {
      version: 1,
      from: events,
      measure: average(sum(project(events, "latency")), count(project(events, "latency"))),
      time: project(events, "at"),
      unit: "ms",
      population: "events",
    });
    expect(
      evaluateMetric(
        averageMetric,
        [
          { at: window.from, clicks: "0", impressions: "1", latency: "1.20" },
          { at: window.from, clicks: "0", impressions: "1", latency: "2.30" },
        ],
        window,
      ),
    ).toEqual([
      {
        group: {},
        value: "1.75",
        numerator: "3.5",
        denominator: "2",
        valueScale: 12,
        valueRounding: "half-even",
      },
    ]);
    const distinctMetric = defineMetric("customers", {
      version: 1,
      from: captures,
      measure: exactDistinct(project(captures, "customer")),
      time: project(captures, "capturedAt"),
      unit: "customers",
      population: "captured payments",
    });
    expect(
      evaluateMetric(
        distinctMetric,
        [
          { capturedAt: window.from, amountMinor: "1", currency: "USD", customer: "a" },
          { capturedAt: window.from, amountMinor: "1", currency: "USD", customer: "a" },
          { capturedAt: window.from, amountMinor: "1", currency: "USD", customer: "b" },
        ],
        window,
      ),
    ).toEqual([{ group: {}, value: "2" }]);
  });

  it("enforces half-open windows at submillisecond instant precision", () => {
    const metric = defineMetric("fine_grained_count", {
      version: 1,
      from: events,
      measure: count(),
      time: project(events, "at"),
      unit: "events",
      population: "events",
    });
    const preciseWindow = {
      from: "2026-01-01T00:00:00.123456Z",
      to: "2026-01-01T00:00:00.124456Z",
    };
    expect(evaluateMetric(metric, [{ at: "2026-01-01T00:00:00.123400Z" }], preciseWindow)).toEqual([
      { group: {}, value: "0" },
    ]);
    expect(evaluateMetric(metric, [{ at: "2026-01-01T00:00:00.124100Z" }], preciseWindow)).toEqual([
      { group: {}, value: "1" },
    ]);
    expect(evaluateMetric(metric, [{ at: preciseWindow.to }], preciseWindow)).toEqual([
      { group: {}, value: "0" },
    ]);
  });

  it("normalizes typed values before exact distinct comparison", () => {
    const decimalDistinct = defineMetric("distinct_latency", {
      version: 1,
      from: events,
      measure: exactDistinct(project(events, "latency")),
      time: project(events, "at"),
      unit: "samples",
      population: "events",
    });
    expect(
      evaluateMetric(
        decimalDistinct,
        ["1", "1.0", "1.00", "2.00"].map((latency) => ({ at: window.from, latency })),
        window,
      ),
    ).toEqual([{ group: {}, value: "2" }]);

    const instantDistinct = defineMetric("distinct_instants", {
      version: 1,
      from: events,
      measure: exactDistinct(project(events, "at")),
      time: project(events, "at"),
      unit: "instants",
      population: "events",
    });
    expect(
      evaluateMetric(
        instantDistinct,
        [
          { at: "2026-01-01T00:00:00.123456Z" },
          { at: "2025-12-31T19:00:00.123456-05:00" },
          { at: "2026-01-01T00:00:00.123457Z" },
        ],
        window,
      ),
    ).toEqual([{ group: {}, value: "2" }]);
  });

  it.each([
    {
      column: { type: "decimal", scale: 2 },
      values: ["1", "1.0", "1.00", "2.00"],
      groups: [
        ["1", "3"],
        ["2", "1"],
      ],
    },
    {
      column: { type: "decimal", scale: 2 },
      values: ["9007199254740993.1", "9007199254740993.10", "9007199254740993.11"],
      groups: [
        ["9007199254740993.1", "2"],
        ["9007199254740993.11", "1"],
      ],
    },
    {
      column: { type: "decimal", scale: 2 },
      values: ["-0.00", "0", "-1.2", "-1.20"],
      groups: [
        ["-1.2", "2"],
        ["0", "2"],
      ],
    },
    {
      column: { type: "int64" },
      values: ["-0", "0", "9007199254740992", "9007199254740993"],
      groups: [
        ["0", "2"],
        ["9007199254740992", "1"],
        ["9007199254740993", "1"],
      ],
    },
    {
      column: { type: "string" },
      values: ["1", "1.0", "1.00"],
      groups: [
        ["1", "1"],
        ["1.0", "1"],
        ["1.00", "1"],
      ],
    },
    {
      column: { type: "instant" },
      values: [
        "2026-01-01T00:00:00.123456Z",
        "2025-12-31T19:00:00.123456-05:00",
        "2026-01-01T00:00:00.123457Z",
      ],
      groups: [
        ["2026-01-01T00:00:00.123456Z", "2"],
        ["2026-01-01T00:00:00.123457Z", "1"],
      ],
    },
    {
      column: { type: "instant" },
      values: [
        "1969-12-31T23:59:59.999999999Z",
        "1970-01-01T00:59:59.999999999+01:00",
        "1970-01-01T00:00:00Z",
      ],
      groups: [
        ["1969-12-31T23:59:59.999999999Z", "2"],
        ["1970-01-01T00:00:00Z", "1"],
      ],
    },
  ] as const)(
    "groups equivalent $column.type values with canonical output",
    ({ column, values, groups }) => {
      const fact = {
        name: "samples",
        kind: "transaction",
        columns: { at: { type: "instant" }, dimension: column },
      } as const;
      const base = {
        version: 1,
        from: fact,
        time: project(fact, "at"),
        unit: "rows",
        population: "samples",
      } as const;
      const dimension = project(fact, "dimension");
      const metric = defineMetric("grouped_samples", {
        ...base,
        measure: count(),
        groupByRequired: [dimension],
      });
      const rows = values.map((dimension) => ({ at: window.from, dimension }));
      const expected = groups.map(([dimension, value]) => ({ group: { dimension }, value }));
      expect(evaluateMetric(metric, rows, window)).toEqual(expected);
      expect(evaluateMetric(metric, [...rows].reverse(), window)).toEqual(expected);
      expect(
        evaluateMetric(
          defineMetric("distinct_samples", { ...base, measure: exactDistinct(dimension) }),
          rows,
          window,
        ),
      ).toEqual([{ group: {}, value: String(groups.length) }]);
    },
  );

  it.each([
    { column: { type: "int64" }, value: "9223372036854775808", code: "METRIC_INTEGER_OVERFLOW" },
    { column: { type: "int64" }, value: "1.0", code: "METRIC_INVALID_INTEGER" },
    { column: { type: "decimal", scale: 2 }, value: "1.001", code: "METRIC_DECIMAL_SCALE" },
    { column: { type: "decimal", scale: 2 }, value: "1e2", code: "METRIC_INVALID_DECIMAL" },
    { column: { type: "instant" }, value: "invalid", code: "METRIC_INVALID_INSTANT" },
    {
      column: { type: "instant" },
      value: "2026-01-01T00:00:00.1234567890Z",
      code: "METRIC_INVALID_INSTANT_PRECISION",
    },
    { column: { type: "decimal", scale: 2 }, value: null, code: "METRIC_INVALID_GROUP" },
  ] as const)("rejects invalid $column.type group values ($code)", ({ column, value, code }) => {
    const fact = {
      name: "samples",
      kind: "transaction",
      columns: { at: { type: "instant" }, dimension: column },
    } as const;
    const metric = defineMetric("invalid_group", {
      version: 1,
      from: fact,
      time: project(fact, "at"),
      measure: count(),
      groupByRequired: [project(fact, "dimension")],
      unit: "rows",
      population: "samples",
    });
    expect(() =>
      evaluateMetric(metric, [{ at: window.from, dimension: value }], window),
    ).toThrowError(code);
  });

  it("rejects a time reference not declared by the fact", () => {
    expect(() =>
      defineMetric("invalid_time", {
        version: 1,
        from: events,
        measure: count(),
        time: {
          kind: "column",
          source: events.name,
          key: "missing",
          column: { type: "instant" },
        },
        unit: "rows",
        population: "events",
      }),
    ).toThrowError("METRIC_FOREIGN_COLUMN");
  });

  it.each([
    ["Asia/Kolkata", "Asia/Calcutta", "2026-03-31T18:30:00.000Z"],
    ["Europe/Kyiv", "Europe/Kiev", "2026-03-31T21:00:00.000Z"],
    ["Etc/UTC", "UTC", "2026-04-01T00:00:00.000Z"],
  ])("uses the same day and month boundaries for %s and %s", (zone, alias, boundary) => {
    for (const granularity of ["day", "month"] as const) {
      for (const name of [zone, alias]) {
        const bucket = dateBucket(granularity, name);
        expect(bucket).toEqual({ granularity, zone: name });
        const metric = defineMetric("alias_clicks", {
          version: 1,
          from: events,
          measure: sum(project(events, "clicks")),
          time: project(events, "at"),
          unit: "clicks",
          population: "events",
          bucket,
        });
        expect(
          evaluateMetric(
            metric,
            [
              { at: new Date(Date.parse(boundary) - 1).toISOString(), clicks: "3" },
              { at: boundary, clicks: "7" },
            ],
            window,
          ),
        ).toEqual([
          { group: {}, bucket: granularity === "day" ? "2026-03-31" : "2026-03", value: "3" },
          { group: {}, bucket: granularity === "day" ? "2026-04-01" : "2026-04", value: "7" },
        ]);
      }
    }
  });

  it.each([
    ["Asia/Kolkata", "Asia/Calcutta"],
    ["Asia/Calcutta", "Asia/Kolkata"],
    ["Europe/Kyiv", "Europe/Kiev"],
    ["Europe/Kiev", "Europe/Kyiv"],
    ["Etc/UTC", "UTC"],
    ["UTC", "Etc/UTC"],
  ])("matches date column zone %s with bucket zone %s", (zone, bucketZone) => {
    const daily = {
      name: "daily",
      kind: "transaction",
      columns: { date: { type: "date", zone }, value: { type: "int64" } },
    } as const;
    // A literal bucket exercises defineMetric's validation even without dateBucket().
    const metric = defineMetric("alias_dates", {
      version: 1,
      from: daily,
      measure: sum(project(daily, "value")),
      time: project(daily, "date"),
      unit: "events",
      population: "daily rows",
      bucket: { granularity: "month", zone: bucketZone },
    });
    expect(
      evaluateMetric(
        metric,
        [
          { date: "2026-03-31", value: "3" },
          { date: "2026-04-01", value: "7" },
        ],
        { from: "2026-03-01", to: "2026-05-01" },
      ),
    ).toEqual([
      { group: {}, bucket: "2026-03", value: "3" },
      { group: {}, bucket: "2026-04", value: "7" },
    ]);
  });

  it.each(["UTC+9", "+09:00", "Etc/GMT-9", "etc/gmt-9", "Invalid/Zone", ""])(
    "rejects unsupported zone %s with a typed error",
    (zone) => {
      expect(() => dateBucket("day", zone)).toThrowError(MetricExpressionError);
      expect(() => dateBucket("day", zone)).toThrowError("METRIC_INVALID_ZONE");
    },
  );

  it.each([undefined, null, { toString: () => "UTC" }])(
    "rejects non-string zone %s instead of using an implicit zone",
    (zone) => {
      expect(() => dateBucket("day", zone as unknown as string)).toThrowError(
        MetricExpressionError,
      );
      expect(() => dateBucket("day", zone as unknown as string)).toThrowError(
        "METRIC_INVALID_ZONE",
      );
    },
  );

  it("rejects a missing literal bucket zone before metric evaluation", () => {
    expect(() =>
      defineMetric("missing_zone", {
        version: 1,
        from: events,
        measure: count(),
        time: project(events, "at"),
        unit: "rows",
        population: "events",
        bucket: { granularity: "day", zone: undefined as unknown as string },
      }),
    ).toThrowError("METRIC_INVALID_ZONE");
  });

  it("rejects distinct date zones even when their current offsets agree", () => {
    const daily = {
      name: "daily",
      kind: "transaction",
      columns: { date: { type: "date", zone: "America/New_York" } },
    } as const;
    expect(() =>
      defineMetric("different_zones", {
        version: 1,
        from: daily,
        measure: count(),
        time: project(daily, "date"),
        unit: "rows",
        population: "daily rows",
        bucket: dateBucket("day", "America/Lima"),
      }),
    ).toThrowError("METRIC_ZONE_MISMATCH");
  });

  it("uses an explicit IANA zone for DST calendar buckets", () => {
    const metric = defineMetric("daily_clicks", {
      version: 1,
      from: events,
      measure: sum(project(events, "clicks")),
      time: project(events, "at"),
      unit: "clicks",
      population: "events",
      bucket: dateBucket("day", "America/New_York"),
    });
    expect(
      evaluateMetric(
        metric,
        [
          { at: "2026-03-08T06:59:59.000Z", clicks: "1", impressions: "1", latency: "1" },
          { at: "2026-03-08T07:00:00.000Z", clicks: "2", impressions: "1", latency: "1" },
          { at: "2026-03-09T03:59:59.000Z", clicks: "3", impressions: "1", latency: "1" },
          { at: "2026-03-09T04:00:00.000Z", clicks: "4", impressions: "1", latency: "1" },
        ],
        window,
      ),
    ).toEqual([
      { group: {}, bucket: "2026-03-08", value: "6" },
      { group: {}, bucket: "2026-03-09", value: "4" },
    ]);
    expect(() => dateBucket("day", "UTC+9")).toThrowError("METRIC_INVALID_ZONE");
  });

  it("filters rows, computes extrema, and uses date keys without UTC conversion", () => {
    const usdMin = defineMetric("smallest_usd_capture", {
      version: 1,
      from: captures,
      measure: min(project(captures, "amountMinor")),
      filter: eq(project(captures, "currency"), "USD"),
      time: project(captures, "capturedAt"),
      unit: "minor",
      population: "USD captures",
    });
    expect(
      evaluateMetric(
        usdMin,
        [
          { capturedAt: window.from, amountMinor: "7", currency: "USD", customer: "a" },
          { capturedAt: window.from, amountMinor: "3", currency: "USD", customer: "b" },
          { capturedAt: window.from, amountMinor: "1", currency: "EUR", customer: "c" },
        ],
        window,
      ),
    ).toEqual([{ group: {}, value: "3" }]);

    const daily = {
      name: "daily",
      kind: "transaction",
      columns: { date: { type: "date", zone: "America/New_York" }, value: { type: "int64" } },
    } as const;
    const dailyMax = defineMetric("daily_max", {
      version: 1,
      from: daily,
      measure: max(project(daily, "value")),
      time: project(daily, "date"),
      unit: "events",
      population: "daily rows",
      bucket: dateBucket("month", "America/New_York"),
    });
    expect(
      evaluateMetric(
        dailyMax,
        [
          { date: "2026-03-08", value: "5" },
          { date: "2026-03-09", value: "7" },
          { date: "2026-04-01", value: "10" },
        ],
        { from: "2026-03-01", to: "2026-04-01" },
      ),
    ).toEqual([{ group: {}, bucket: "2026-03", value: "7" }]);
    expect(() =>
      defineMetric("wrong_zone", {
        version: 1,
        from: daily,
        measure: count(),
        time: project(daily, "date"),
        unit: "rows",
        population: "daily rows",
        bucket: dateBucket("day", "UTC"),
      }),
    ).toThrowError("METRIC_ZONE_MISMATCH");
  });

  it("rejects unsupported joins, quantiles, invalid reaggregation and nullable sums", () => {
    for (const kind of ["join", "quantile"] as const) {
      expect(() =>
        defineMetric("unsupported", {
          version: 1,
          from: events,
          measure: { kind } as unknown as MetricExpression,
          time: project(events, "at"),
          unit: "count",
          population: "events",
        }),
      ).toThrowError("METRIC_UNSUPPORTED_OPERATION");
    }
    const aggregate = {
      ...events,
      kind: "aggregate",
      aggregate: { measures: { clicks: { unit: "clicks", reaggregate: "none" } } },
    } as const;
    expect(() =>
      defineMetric("clicks", {
        version: 1,
        from: aggregate,
        measure: sum(project(aggregate, "clicks")),
        time: project(aggregate, "at"),
        unit: "clicks",
        population: "events",
      }),
    ).toThrowError("METRIC_REAGGREGATION_UNSUPPORTED");
    const nullable = {
      ...events,
      columns: { ...events.columns, clicks: { type: "int64", nullable: true } },
    } as const;
    expect(() => sum(project(nullable, "clicks"))).toThrowError("METRIC_NULL_POLICY_REQUIRED");
    expect(() =>
      defineMetric("bad", {
        version: 1,
        from: captures,
        measure: count(),
        filter: eq(project(captures, "currency"), "USD"),
        time: project(captures, "capturedAt"),
        unit: "count",
        population: "x",
      }),
    ).not.toThrow();
  });

  it("creates stable semantic hashes without source revision references", async () => {
    const metric = defineMetric("ctr", {
      version: 1,
      from: events,
      measure: sum(project(events, "clicks")),
      time: project(events, "at"),
      unit: "clicks",
      population: "events",
    });
    const compiled = await compileMetric(metric);
    expect(compiled).toMatchObject({
      id: "ctr",
      version: 1,
      unit: "clicks",
      population: "events",
      sourceRefs: [],
    });
    expect(compiled.hash).toMatch(/^[a-f0-9]{64}$/);
    expect((await compileMetric(metric)).hash).toBe(compiled.hash);
  });
});
