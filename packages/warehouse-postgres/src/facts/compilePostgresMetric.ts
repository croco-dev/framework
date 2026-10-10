import { defineMetric, eq, MetricExpressionError } from "@croco/metrics-core";
import type {
  AggregateExpression,
  MetricColumnRef,
  MetricDefinition,
  MetricEvaluation,
  MetricFilter,
  MetricWindow,
} from "@croco/metrics-core";
import type { FactDescriptor } from "@croco/warehouse-core";
import { factColumnName, factTableName, quoteIdentifier } from "./schema";

function requireMetric(condition: unknown, code: string): asserts condition {
  if (!condition) throw new MetricExpressionError(code);
}

/** Compiles one bounded aggregate envelope, never fact rows. */
export function compilePostgresMetric(
  descriptor: FactDescriptor,
  definition: MetricDefinition,
  window: MetricWindow,
  scope: string,
  revision: number,
  maxRows: number,
  maxBytes: number,
): { sql: string; params: unknown[]; requiredColumns: readonly string[] } {
  defineMetric(definition.id, definition);
  requireMetric(
    definition.from.name === descriptor.name && definition.from.kind === descriptor.kind,
    "METRIC_DESCRIPTOR_MISMATCH",
  );
  requireMetric(
    Number.isSafeInteger(revision) &&
      revision >= 0 &&
      Number.isSafeInteger(maxRows) &&
      maxRows > 0 &&
      maxRows < Number.MAX_SAFE_INTEGER &&
      Number.isSafeInteger(maxBytes) &&
      maxBytes > 0,
    "METRIC_INVALID_BOUNDS",
  );
  for (const [key, column] of Object.entries(definition.from.columns)) {
    const bound = descriptor.columns[key];
    requireMetric(
      bound &&
        Object.entries(column).every(
          ([field, value]) => (bound as unknown as Record<string, unknown>)[field] === value,
        ) &&
        Boolean(bound.nullable) === Boolean(column.nullable),
      "METRIC_DESCRIPTOR_MISMATCH",
    );
  }
  if (definition.from.kind === "aggregate") {
    for (const [key, measure] of Object.entries(definition.from.aggregate?.measures ?? {})) {
      const actual = descriptor.aggregate?.measures[key];
      requireMetric(
        measure &&
          actual &&
          measure.unit === actual.unit &&
          measure.reaggregate === actual.reaggregate,
        "METRIC_DESCRIPTOR_MISMATCH",
      );
    }
  }
  requireMetric(!definition.time.column.nullable, "METRIC_INVALID_TIME");
  const isDate = definition.time.column.type === "date";
  const validDate = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().startsWith(value);
  const instant = (value: string): bigint => {
    const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/.exec(
      value,
    );
    requireMetric(match && Number.isFinite(Date.parse(value)), "METRIC_INVALID_WINDOW");
    return (
      BigInt(Date.parse(`${match[1]}${match[3]}`)) * BigInt(1000000) +
      BigInt((match[2] ?? "").padEnd(9, "0"))
    );
  };
  requireMetric(
    isDate
      ? validDate(window.from) && validDate(window.to) && window.from < window.to
      : instant(window.from) < instant(window.to),
    "METRIC_INVALID_WINDOW",
  );
  const params: unknown[] = [];
  const parameter = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };
  const required = new Set<string>();
  const columnSql = (ref: MetricColumnRef): string => {
    requireMetric(
      ref.source === descriptor.name && Object.hasOwn(descriptor.columns, ref.key),
      "METRIC_FOREIGN_COLUMN",
    );
    required.add(ref.key);
    if (ref.column.type === "money") required.add(ref.column.currency);
    return `f.${quoteIdentifier(factColumnName(descriptor, ref.key))}`;
  };
  const aggregate = (expression: AggregateExpression): string => {
    requireMetric(expression.kind === "count" || expression.column, "METRIC_INVALID_DECLARATION");
    const column = expression.column ? columnSql(expression.column) : "*";
    switch (expression.kind) {
      case "count":
        return `count(${column})::text`;
      case "exact-distinct":
        return `count(DISTINCT ${column})::text`;
      case "sum":
        return `COALESCE(sum(${column}), 0)::text`;
      case "min":
        return `min(${column})::text`;
      case "max":
        return `max(${column})::text`;
      default:
        throw new MetricExpressionError("METRIC_UNSUPPORTED_OPERATION");
    }
  };
  const isoDate = (column: string) => `to_char(${column}, 'YYYY-MM-DD')`;
  const filter = (value: MetricFilter): string => {
    if (value.kind === "eq") {
      eq(value.column, value.value);
      const column = columnSql(value.column);
      const bound = parameter(value.value);
      return value.column.column.type === "date"
        ? `${isoDate(column)} = ${bound}::text`
        : `${column} = ${bound}`;
    }
    requireMetric(value.kind === "and" && value.filters.length > 0, "METRIC_INVALID_FILTER");
    return `(${value.filters.map(filter).join(" AND ")})`;
  };
  const grouping: string[] = [];
  const groupFields = definition.groupByRequired.flatMap((ref) => {
    requireMetric(
      !ref.column.nullable &&
        [
          "id",
          "string",
          "boolean",
          "currency",
          "subject",
          "int64",
          "decimal",
          "money",
          "date",
        ].includes(ref.column.type),
      "METRIC_INVALID_GROUP",
    );
    const column = columnSql(ref);
    grouping.push(column);
    return [
      parameter(ref.key) + "::text",
      ref.column.type === "boolean"
        ? column
        : ref.column.type === "date"
          ? isoDate(column)
          : `${column}::text`,
    ];
  });
  let bucket = "";
  if (definition.bucket) {
    requireMetric(
      ["day", "month"].includes(definition.bucket.granularity),
      "METRIC_UNSUPPORTED_OPERATION",
    );
    const time = columnSql(definition.time);
    const localTime = isDate ? time : `${time} AT TIME ZONE ${parameter(definition.bucket.zone)}`;
    const expression = `to_char(${localTime}, ${parameter(definition.bucket.granularity === "day" ? "YYYY-MM-DD" : "YYYY-MM")})`;
    grouping.push(expression);
    bucket = `, 'bucket', ${expression}`;
  }
  const measure = definition.measure;
  const values =
    measure.kind === "average" || measure.kind === "ratio"
      ? `'numerator', ${aggregate(measure.numerator)}, 'denominator', ${aggregate(measure.denominator)}`
      : `'value', ${aggregate(measure)}`;
  const scopeParam = parameter(scope);
  const revisionParam = parameter(revision);
  const modelParam = parameter(descriptor.semanticHash);
  const time = columnSql(definition.time);
  const timeType = isDate ? "date" : "timestamptz";
  const predicates = [
    `f._scope = ${scopeParam}`,
    `f._visible_from <= ${revisionParam} AND (f._visible_to IS NULL OR f._visible_to > ${revisionParam})`,
    `NOT EXISTS (SELECT 1 FROM warehouse_suppressions s WHERE s.scope_key = ${scopeParam} AND s.model_version = ${modelParam} AND s.identity = f._identity)`,
    `${time} >= ${parameter(window.from)}::${timeType} AND ${time} < ${parameter(window.to)}::${timeType}`,
    ...(definition.filter ? [filter(definition.filter)] : []),
  ];
  const rowsParam = parameter(maxRows);
  const bytesParam = parameter(maxBytes);
  return {
    sql: `WITH bounded AS MATERIALIZED (
      SELECT jsonb_build_object('group', jsonb_build_object(${groupFields.join(", ")})${bucket}, ${values}) AS result
      FROM ${quoteIdentifier(factTableName(descriptor))} f
      WHERE ${predicates.join(" AND ")}
      ${grouping.length ? `GROUP BY ${grouping.join(", ")}` : ""}
      LIMIT (${rowsParam}::bigint + 1)
    ), bounds AS (
      SELECT count(*) > ${rowsParam} OR COALESCE(sum(octet_length(result::text) + 2), 0) + 2 > ${bytesParam} AS exceeded FROM bounded
    ) SELECT exceeded, CASE WHEN exceeded THEN NULL ELSE (SELECT COALESCE(jsonb_agg(result), '[]'::jsonb) FROM bounded) END AS results FROM bounds`,
    params,
    requiredColumns: [...required].sort(),
  };
}

function decimal(value: unknown): { coefficient: bigint; scale: number; text: string } {
  requireMetric(
    typeof value === "string" && /^-?\d+(?:\.\d+)?$/.test(value),
    value === null ? "METRIC_EMPTY_EXTREMA" : "METRIC_INVALID_RESULT",
  );
  const [whole, fraction = ""] = value.split(".");
  const coefficient = BigInt(whole + fraction);
  return { coefficient, scale: fraction.length, text: format(coefficient, fraction.length) };
}

function format(coefficient: bigint, scale: number): string {
  const digits = (coefficient < BigInt(0) ? -coefficient : coefficient)
    .toString()
    .padStart(scale + 1, "0");
  const fraction = scale ? digits.slice(-scale).replace(/0+$/, "") : "";
  return `${coefficient < BigInt(0) ? "-" : ""}${scale ? digits.slice(0, -scale) : digits}${fraction ? `.${fraction}` : ""}`;
}

function quotient(
  numerator: ReturnType<typeof decimal>,
  denominator: ReturnType<typeof decimal>,
): string | null {
  if (denominator.coefficient === BigInt(0)) return null;
  const n = numerator.coefficient * BigInt(10) ** BigInt(denominator.scale + 12);
  const d = denominator.coefficient * BigInt(10) ** BigInt(numerator.scale);
  const negative = n < BigInt(0) !== d < BigInt(0);
  const a = n < BigInt(0) ? -n : n;
  const b = d < BigInt(0) ? -d : d;
  let result = a / b;
  const remainder = (a % b) * BigInt(2);
  if (remainder > b || (remainder === b && result % BigInt(2) !== BigInt(0))) result += BigInt(1);
  return format(negative ? -result : result, 12);
}

/** The query returns { exceeded: boolean, results: JSON aggregate records[] | null }. */
export function decodePostgresMetricResult(
  definition: MetricDefinition,
  input: unknown,
): readonly MetricEvaluation[] {
  requireMetric(
    input !== null && typeof input === "object" && !Array.isArray(input),
    "METRIC_INVALID_RESULT",
  );
  const row = input as Readonly<Record<string, unknown>>;
  requireMetric(
    row.exceeded === false,
    row.exceeded === true ? "METRIC_RESULT_LIMIT" : "METRIC_INVALID_RESULT",
  );
  requireMetric(Array.isArray(row.results), "METRIC_INVALID_RESULT");
  return row.results
    .map((raw: unknown): MetricEvaluation => {
      requireMetric(raw !== null && typeof raw === "object", "METRIC_INVALID_RESULT");
      const result = raw as Record<string, unknown>;
      requireMetric(
        result.group !== null && typeof result.group === "object" && !Array.isArray(result.group),
        "METRIC_INVALID_RESULT",
      );
      const group = result.group as Record<string, string | boolean>;
      requireMetric(
        Object.values(group).every(
          (value) => typeof value === "string" || typeof value === "boolean",
        ),
        "METRIC_INVALID_GROUP",
      );
      requireMetric(
        result.bucket === undefined || typeof result.bucket === "string",
        "METRIC_INVALID_RESULT",
      );
      const base = {
        group,
        ...(typeof result.bucket === "string" ? { bucket: result.bucket } : {}),
      };
      if (definition.measure.kind === "average" || definition.measure.kind === "ratio") {
        const numerator = decimal(result.numerator);
        const denominator = decimal(result.denominator);
        return {
          ...base,
          value: quotient(numerator, denominator),
          numerator: numerator.text,
          denominator: denominator.text,
          valueScale: 12,
          valueRounding: "half-even",
        };
      }
      return { ...base, value: decimal(result.value).text };
    })
    .sort((left, right) => {
      const key = (result: MetricEvaluation) =>
        JSON.stringify({
          ...(result.bucket ? { bucket: result.bucket } : {}),
          group: Object.fromEntries(
            Object.entries(result.group).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
          ),
        });
      return key(left) < key(right) ? -1 : key(left) > key(right) ? 1 : 0;
    });
}
