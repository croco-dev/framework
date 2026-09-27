import { Problem, ProblemCategory } from "@croco/problems-core";

export type MetricColumn =
  | {
      readonly type: "id" | "string" | "boolean" | "currency" | "subject";
      readonly nullable?: true;
    }
  | { readonly type: "int64"; readonly nullable?: true }
  | { readonly type: "decimal"; readonly scale: number; readonly nullable?: true }
  | { readonly type: "money"; readonly currency: string; readonly nullable?: true }
  | { readonly type: "instant"; readonly nullable?: true }
  | { readonly type: "date"; readonly zone: string; readonly nullable?: true };

export type MetricFact<
  C extends Readonly<Record<string, MetricColumn>> = Readonly<Record<string, MetricColumn>>,
> = {
  readonly name: string;
  readonly kind: "transaction" | "aggregate";
  readonly columns: C;
  readonly sourceRefs?: readonly string[];
  readonly aggregate?: {
    readonly measures: Readonly<
      Partial<Record<string, { readonly unit: string; readonly reaggregate: "sum" | "none" }>>
    >;
  };
};

export type MetricColumnRef<C extends MetricColumn = MetricColumn> = {
  readonly kind: "column";
  readonly source: string;
  readonly key: string;
  readonly column: C;
};

export type MetricFilter =
  | { readonly kind: "eq"; readonly column: MetricColumnRef; readonly value: string | boolean }
  | { readonly kind: "and"; readonly filters: readonly MetricFilter[] };

export type AggregateExpression =
  | { readonly kind: "count"; readonly column?: MetricColumnRef }
  | {
      readonly kind: "sum" | "min" | "max";
      readonly column: MetricColumnRef;
      readonly nulls?: "ignore";
    }
  | { readonly kind: "exact-distinct"; readonly column: MetricColumnRef };

export type MetricExpression =
  | AggregateExpression
  | {
      readonly kind: "average";
      readonly numerator: Extract<AggregateExpression, { readonly kind: "sum" | "min" | "max" }>;
      readonly denominator: Extract<AggregateExpression, { readonly kind: "count" }>;
    }
  | {
      readonly kind: "ratio";
      readonly numerator: AggregateExpression;
      readonly denominator: AggregateExpression;
      readonly zeroDenominator: "null";
    };

export type MetricDefinitionIdentity = {
  readonly id: string;
  readonly version: number;
  readonly hash: string;
  readonly unit: string;
  readonly population: string;
  readonly sourceRefs: readonly string[];
};

export type MetricDefinition<
  C extends Readonly<Record<string, MetricColumn>> = Readonly<Record<string, MetricColumn>>,
> = {
  readonly id: string;
  readonly version: number;
  readonly from: MetricFact<C>;
  readonly measure: MetricExpression;
  readonly filter?: MetricFilter;
  readonly groupByRequired: readonly MetricColumnRef[];
  readonly time: MetricColumnRef;
  readonly population: string;
  readonly unit: string;
  readonly sourceRefs: readonly string[];
  readonly bucket?: { readonly granularity: "day" | "month"; readonly zone: string };
};

export type MetricWindow = { readonly from: string; readonly to: string };
export type MetricEvaluation = {
  readonly group: Readonly<Record<string, string | boolean>>;
  readonly bucket?: string;
  readonly value: string | null;
  readonly numerator?: string;
  readonly denominator?: string;
  /** Ratio and average values are rounded to 12 fractional digits using half-even rounding. */
  readonly valueScale?: 12;
  readonly valueRounding?: "half-even";
};

export class MetricExpressionError extends Problem {
  constructor(
    readonly code: string,
    detail?: string,
  ) {
    super(code, ProblemCategory.ValidationError, detail ? `${code}: ${detail}` : code);
    this.name = "MetricExpressionError";
  }
}

function requireCondition(condition: unknown, code: string, detail?: string): asserts condition {
  if (!condition) throw new MetricExpressionError(code, detail);
}

export function project<
  const C extends Readonly<Record<string, MetricColumn>>,
  const K extends keyof C & string,
>(fact: MetricFact<C>, key: K): MetricColumnRef<C[K]> {
  requireCondition(Object.hasOwn(fact.columns, key), "METRIC_UNKNOWN_COLUMN", key);
  return { kind: "column", source: fact.name, key, column: fact.columns[key] };
}

export function eq(column: MetricColumnRef, value: string | boolean): MetricFilter {
  requireCondition(
    ["id", "string", "boolean", "currency", "subject", "date"].includes(column.column.type),
    "METRIC_INVALID_FILTER",
  );
  requireCondition(
    column.column.type === "boolean" ? typeof value === "boolean" : typeof value === "string",
    "METRIC_FILTER_TYPE",
  );
  return { kind: "eq", column, value };
}

export function and(...filters: readonly MetricFilter[]): MetricFilter {
  requireCondition(filters.length > 0, "METRIC_EMPTY_FILTER");
  return { kind: "and", filters };
}

export function count(column?: MetricColumnRef): AggregateExpression & { readonly kind: "count" } {
  return column ? { kind: "count", column } : { kind: "count" };
}

function numeric(column: MetricColumnRef, nulls?: "ignore"): void {
  requireCondition(
    ["int64", "decimal", "money"].includes(column.column.type),
    "METRIC_NUMERIC_COLUMN_REQUIRED",
  );
  requireCondition(!column.column.nullable || nulls === "ignore", "METRIC_NULL_POLICY_REQUIRED");
}

export function sum(
  column: MetricColumnRef,
  options?: { readonly nulls: "ignore" },
): AggregateExpression & { readonly kind: "sum" } {
  numeric(column, options?.nulls);
  return { kind: "sum", column, ...(options?.nulls ? { nulls: options.nulls } : {}) };
}

export function min(
  column: MetricColumnRef,
  options?: { readonly nulls: "ignore" },
): AggregateExpression & { readonly kind: "min" } {
  numeric(column, options?.nulls);
  return { kind: "min", column, ...(options?.nulls ? { nulls: options.nulls } : {}) };
}

export function max(
  column: MetricColumnRef,
  options?: { readonly nulls: "ignore" },
): AggregateExpression & { readonly kind: "max" } {
  numeric(column, options?.nulls);
  return { kind: "max", column, ...(options?.nulls ? { nulls: options.nulls } : {}) };
}

export function exactDistinct(column: MetricColumnRef): AggregateExpression {
  return { kind: "exact-distinct", column };
}

export function average(
  numerator: AggregateExpression & { readonly kind: "sum" },
  denominator: AggregateExpression & { readonly kind: "count" },
): MetricExpression {
  requireCondition(
    denominator.column?.source === numerator.column.source &&
      denominator.column.key === numerator.column.key,
    "METRIC_AVERAGE_POPULATION",
  );
  return { kind: "average", numerator, denominator };
}

export function ratio(options: {
  readonly numerator: AggregateExpression;
  readonly denominator: AggregateExpression;
  readonly zeroDenominator: "null";
}): MetricExpression {
  requireCondition(options.zeroDenominator === "null", "METRIC_ZERO_DENOMINATOR_POLICY");
  return { kind: "ratio", ...options };
}

export function dateBucket(
  granularity: "day" | "month",
  zone: string,
): { readonly granularity: "day" | "month"; readonly zone: string } {
  try {
    const resolved = new Intl.DateTimeFormat("en-US", { timeZone: zone }).resolvedOptions()
      .timeZone;
    requireCondition(resolved === zone && !zone.startsWith("Etc/GMT"), "METRIC_INVALID_ZONE", zone);
  } catch {
    throw new MetricExpressionError("METRIC_INVALID_ZONE", zone);
  }
  return { granularity, zone };
}

function allColumns(expression: MetricExpression): MetricColumnRef[] {
  if (expression.kind === "average" || expression.kind === "ratio") {
    return [...allColumns(expression.numerator), ...allColumns(expression.denominator)];
  }
  return expression.column ? [expression.column] : [];
}

function filterColumns(filter: MetricFilter): MetricColumnRef[] {
  return filter.kind === "eq" ? [filter.column] : filter.filters.flatMap(filterColumns);
}

function hasCurrencyFilter(filter: MetricFilter | undefined, key: string): boolean {
  if (!filter) return false;
  return filter.kind === "eq"
    ? filter.column.key === key && filter.column.column.type === "currency"
    : filter.filters.some((part) => hasCurrencyFilter(part, key));
}

function validateAggregate(expression: AggregateExpression, fact: MetricFact): void {
  if (!["count", "sum", "min", "max", "exact-distinct"].includes(expression.kind)) {
    throw new MetricExpressionError("METRIC_UNSUPPORTED_OPERATION", expression.kind);
  }
  requireCondition(
    fact.kind !== "aggregate" || expression.kind === "sum",
    "METRIC_REAGGREGATION_UNSUPPORTED",
    expression.kind,
  );
  if (!("column" in expression) || !expression.column) return;
  const column = expression.column;
  requireCondition(
    column.source === fact.name && canonical(fact.columns[column.key]) === canonical(column.column),
    "METRIC_FOREIGN_COLUMN",
    column.key,
  );
  if (expression.kind === "sum" || expression.kind === "min" || expression.kind === "max") {
    numeric(column, expression.nulls);
  }
  if (fact.kind === "aggregate") {
    const measure = fact.aggregate?.measures[column.key];
    requireCondition(
      expression.kind === "sum" && measure?.reaggregate === "sum",
      "METRIC_REAGGREGATION_UNSUPPORTED",
      column.key,
    );
  }
}

function aggregateScale(expression: AggregateExpression): number {
  if (expression.kind === "count" || expression.kind === "exact-distinct") return 0;
  return expression.column.column.type === "decimal" ? expression.column.column.scale : 0;
}

function validateExpression(expression: MetricExpression, fact: MetricFact): void {
  if (expression.kind === "average" || expression.kind === "ratio") {
    if (expression.kind === "ratio") {
      requireCondition(expression.zeroDenominator === "null", "METRIC_ZERO_DENOMINATOR_POLICY");
    } else {
      requireCondition(
        expression.numerator.kind === "sum" &&
          expression.denominator.kind === "count" &&
          expression.denominator.column?.source === expression.numerator.column.source &&
          expression.denominator.column.key === expression.numerator.column.key,
        "METRIC_AVERAGE_POPULATION",
      );
    }
    validateAggregate(expression.numerator, fact);
    validateAggregate(expression.denominator, fact);
    const numerator = expression.numerator.column;
    const denominator = expression.denominator.column;
    if (expression.kind === "ratio") {
      requireCondition(
        aggregateScale(expression.numerator) === aggregateScale(expression.denominator),
        "METRIC_RATIO_UNIT_MISMATCH",
      );
    }
    if (expression.kind === "ratio" && numerator && denominator) {
      requireCondition(
        numerator.column.type === denominator.column.type,
        "METRIC_RATIO_UNIT_MISMATCH",
      );
      if (numerator.column.type === "money" && denominator.column.type === "money") {
        requireCondition(
          numerator.column.currency === denominator.column.currency,
          "METRIC_RATIO_UNIT_MISMATCH",
        );
      }
    }
  } else validateAggregate(expression, fact);
}

export function defineMetric<const C extends Readonly<Record<string, MetricColumn>>>(
  id: string,
  options: {
    readonly version: number;
    readonly from: MetricFact<C>;
    readonly measure: MetricExpression;
    readonly filter?: MetricFilter;
    readonly groupByRequired?: readonly MetricColumnRef[];
    readonly time: MetricColumnRef;
    readonly population: string;
    readonly unit: string;
    readonly bucket?: { readonly granularity: "day" | "month"; readonly zone: string };
  },
): MetricDefinition<C> {
  requireCondition(
    id.length > 0 && Number.isSafeInteger(options.version) && options.version > 0,
    "METRIC_INVALID_IDENTITY",
  );
  requireCondition(
    options.unit.length > 0 && options.population.length > 0,
    "METRIC_INVALID_SEMANTICS",
  );
  const fact = options.from;
  const groups = options.groupByRequired ?? [];
  requireCondition(
    options.time.source === fact.name && ["instant", "date"].includes(options.time.column.type),
    "METRIC_INVALID_TIME",
  );
  for (const column of [
    ...allColumns(options.measure),
    options.time,
    ...groups,
    ...(options.filter ? filterColumns(options.filter) : []),
  ]) {
    requireCondition(
      column.source === fact.name &&
        Object.hasOwn(fact.columns, column.key) &&
        canonical(fact.columns[column.key]) === canonical(column.column),
      "METRIC_FOREIGN_COLUMN",
      column.key,
    );
  }
  validateExpression(options.measure, fact);
  for (const column of allColumns(options.measure)) {
    if (column.column.type !== "money") continue;
    const currency = column.column.currency;
    requireCondition(
      fact.columns[currency]?.type === "currency",
      "METRIC_CURRENCY_COLUMN_REQUIRED",
      currency,
    );
    requireCondition(
      groups.some((group) => group.key === currency) || hasCurrencyFilter(options.filter, currency),
      "METRIC_MIXED_CURRENCY",
      currency,
    );
  }
  if (options.bucket) dateBucket(options.bucket.granularity, options.bucket.zone);
  if (options.bucket && options.time.column.type === "date") {
    requireCondition(options.bucket.zone === options.time.column.zone, "METRIC_ZONE_MISMATCH");
  }
  const declaration = {
    id,
    version: options.version,
    from: fact,
    measure: options.measure,
    ...(options.filter ? { filter: options.filter } : {}),
    groupByRequired: groups,
    time: options.time,
    population: options.population,
    unit: options.unit,
    sourceRefs: [...(fact.sourceRefs ?? [])],
    ...(options.bucket ? { bucket: options.bucket } : {}),
  };
  return freeze(JSON.parse(canonical(declaration)) as MetricDefinition<C>);
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
      .join(",")}}`;
  }
  requireCondition(
    value === null ||
      typeof value === "string" ||
      typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value)),
    "METRIC_INVALID_DECLARATION",
  );
  return JSON.stringify(value);
}

function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

export async function compileMetric(
  definition: MetricDefinition,
): Promise<MetricDefinitionIdentity> {
  requireCondition(globalThis.crypto?.subtle, "METRIC_CRYPTO_UNAVAILABLE");
  const { sourceRefs: _sourceRefs, ...rest } = definition;
  const { sourceRefs: _factSources, ...fact } = rest.from;
  const semantic = { ...rest, from: fact };
  const bytes = new TextEncoder().encode(canonical(semantic));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  const hash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return {
    id: definition.id,
    version: definition.version,
    hash,
    unit: definition.unit,
    population: definition.population,
    sourceRefs: definition.sourceRefs,
  };
}

function integer(value: unknown): bigint {
  requireCondition(
    typeof value === "string" && /^-?(0|[1-9]\d*)$/.test(value),
    "METRIC_INVALID_INTEGER",
  );
  const result = BigInt(value);
  requireCondition(
    result >= -(BigInt(2) ** BigInt(63)) && result < BigInt(2) ** BigInt(63),
    "METRIC_INTEGER_OVERFLOW",
  );
  return result;
}

function decimal(value: unknown, scale: number): bigint {
  requireCondition(
    typeof value === "string" && /^-?(0|[1-9]\d*)(?:\.\d+)?$/.test(value),
    "METRIC_INVALID_DECIMAL",
  );
  const [whole, fraction = ""] = value.replace("-", "").split(".");
  requireCondition(fraction.length <= scale, "METRIC_DECIMAL_SCALE");
  const coefficient = BigInt(whole + fraction.padEnd(scale, "0"));
  return value.startsWith("-") ? -coefficient : coefficient;
}

function formatDecimal(value: bigint, scale: number): string {
  const sign = value < BigInt(0) ? "-" : "";
  const digits = (value < BigInt(0) ? -value : value).toString().padStart(scale + 1, "0");
  if (scale === 0) return sign + digits;
  const fraction = digits.slice(-scale).replace(/0+$/, "");
  return sign + digits.slice(0, -scale) + (fraction ? `.${fraction}` : "");
}

function quotient(numerator: bigint, denominator: bigint): string | null {
  if (denominator === BigInt(0)) return null;
  const negative = numerator < BigInt(0) !== denominator < BigInt(0);
  const absoluteNumerator = numerator < BigInt(0) ? -numerator : numerator;
  const absoluteDenominator = denominator < BigInt(0) ? -denominator : denominator;
  const scaled = absoluteNumerator * BigInt(10) ** BigInt(12);
  const quotientValue = scaled / absoluteDenominator;
  const remainder = scaled % absoluteDenominator;
  const doubled = remainder * BigInt(2);
  const rounded =
    quotientValue +
    (doubled > absoluteDenominator ||
    (doubled === absoluteDenominator && quotientValue % BigInt(2) !== BigInt(0))
      ? BigInt(1)
      : BigInt(0));
  return formatDecimal(negative ? -rounded : rounded, 12);
}

function valueAt(row: Readonly<Record<string, unknown>>, column: MetricColumnRef): unknown {
  requireCondition(Object.hasOwn(row, column.key), "METRIC_MISSING_COLUMN", column.key);
  return row[column.key];
}

function numericValue(
  row: Readonly<Record<string, unknown>>,
  column: MetricColumnRef,
): bigint | null {
  const value = valueAt(row, column);
  if (value === null) return null;
  if (column.column.type === "decimal") return decimal(value, column.column.scale);
  return integer(value);
}

function distinctKey(
  row: Readonly<Record<string, unknown>>,
  column: MetricColumnRef,
): string | null {
  const value = valueAt(row, column);
  if (value === null) return null;
  switch (column.column.type) {
    case "int64":
      return integer(value).toString();
    case "decimal":
      return decimal(value, column.column.scale).toString();
    case "money": {
      const currency = valueAt(row, { ...column, key: column.column.currency });
      requireCondition(typeof currency === "string", "METRIC_INVALID_CURRENCY");
      return `${currency}:${integer(value)}`;
    }
    case "instant":
      requireCondition(typeof value === "string", "METRIC_INVALID_INSTANT");
      return instantNanoseconds(value, "METRIC_INVALID_INSTANT").toString();
    case "date":
      requireCondition(
        typeof value === "string" && validCalendarDate(value),
        "METRIC_INVALID_DATE",
      );
      return value;
    case "boolean":
      requireCondition(typeof value === "boolean", "METRIC_INVALID_BOOLEAN");
      return String(value);
    case "id":
    case "string":
    case "currency":
    case "subject":
      requireCondition(typeof value === "string", "METRIC_INVALID_STRING");
      return value;
  }
}

function aggregate(
  expression: AggregateExpression,
  rows: readonly Readonly<Record<string, unknown>>[],
): { value: bigint; scale: number } {
  if (expression.kind === "count") {
    const column = expression.column;
    return {
      value: BigInt(
        column ? rows.filter((row) => valueAt(row, column) !== null).length : rows.length,
      ),
      scale: 0,
    };
  }
  if (expression.kind === "exact-distinct") {
    return {
      value: BigInt(
        new Set(
          rows.map((row) => distinctKey(row, expression.column)).filter((value) => value !== null),
        ).size,
      ),
      scale: 0,
    };
  }
  const scale = aggregateScale(expression);
  let result: bigint | undefined;
  for (const row of rows) {
    const value = numericValue(row, expression.column);
    if (value === null) {
      requireCondition(expression.nulls === "ignore", "METRIC_NULL_POLICY_REQUIRED");
      continue;
    }
    if (expression.column.column.type === "money") {
      const currency = valueAt(row, {
        ...expression.column,
        key: expression.column.column.currency,
      });
      requireCondition(typeof currency === "string", "METRIC_INVALID_CURRENCY");
    }
    result =
      result === undefined
        ? value
        : expression.kind === "sum"
          ? result + value
          : expression.kind === "min"
            ? value < result
              ? value
              : result
            : value > result
              ? value
              : result;
  }
  requireCondition(result !== undefined || expression.kind === "sum", "METRIC_EMPTY_EXTREMA");
  return { value: result ?? BigInt(0), scale };
}

function compareFilter(filter: MetricFilter, row: Readonly<Record<string, unknown>>): boolean {
  return filter.kind === "eq"
    ? valueAt(row, filter.column) === filter.value
    : filter.filters.every((part) => compareFilter(part, row));
}

function bucketValue(value: string, bucket: NonNullable<MetricDefinition["bucket"]>): string {
  const date = new Date(value);
  requireCondition(Number.isFinite(date.getTime()), "METRIC_INVALID_INSTANT");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: bucket.zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  const day = `${part("year")}-${part("month")}-${part("day")}`;
  return bucket.granularity === "month" ? day.slice(0, 7) : day;
}

function validCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(time.getTime()) && time.toISOString().startsWith(value);
}

function validInstant(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(new Date(value).getTime())
  );
}

function instantNanoseconds(value: string, code: string): bigint {
  requireCondition(validInstant(value), code);
  const match = /^(.*T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  requireCondition(match, "METRIC_INVALID_INSTANT_PRECISION");
  const seconds = Date.parse(`${match[1]}${match[3]}`);
  requireCondition(Number.isFinite(seconds), code);
  return BigInt(seconds) * BigInt(1_000_000) + BigInt((match[2] ?? "").padEnd(9, "0"));
}

export function evaluateMetric(
  definition: MetricDefinition,
  rows: readonly Readonly<Record<string, unknown>>[],
  window: MetricWindow,
): readonly MetricEvaluation[] {
  const isDate = definition.time.column.type === "date";
  const from = isDate ? window.from : instantNanoseconds(window.from, "METRIC_INVALID_WINDOW");
  const to = isDate ? window.to : instantNanoseconds(window.to, "METRIC_INVALID_WINDOW");
  requireCondition(
    isDate
      ? validCalendarDate(window.from) && validCalendarDate(window.to) && window.from < window.to
      : from < to,
    "METRIC_INVALID_WINDOW",
  );
  const groups = new Map<
    string,
    {
      group: Record<string, string | boolean>;
      bucket?: string;
      rows: Readonly<Record<string, unknown>>[];
    }
  >();
  for (const row of rows) {
    const time = valueAt(row, definition.time);
    requireCondition(typeof time === "string", "METRIC_INVALID_TIME");
    const timestamp = isDate ? time : instantNanoseconds(time, "METRIC_INVALID_TIME");
    if (isDate) requireCondition(validCalendarDate(time), "METRIC_INVALID_TIME");
    if (
      timestamp < from ||
      timestamp >= to ||
      (definition.filter && !compareFilter(definition.filter, row))
    )
      continue;
    const group: Record<string, string | boolean> = {};
    for (const column of definition.groupByRequired) {
      const value = valueAt(row, column);
      requireCondition(
        typeof value === "string" || typeof value === "boolean",
        "METRIC_INVALID_GROUP",
      );
      group[column.key] = value;
    }
    const bucket = definition.bucket
      ? isDate
        ? definition.bucket.granularity === "month"
          ? time.slice(0, 7)
          : time
        : bucketValue(time, definition.bucket)
      : undefined;
    const key = canonical({ group, bucket });
    const entry = groups.get(key) ?? { group, ...(bucket ? { bucket } : {}), rows: [] };
    entry.rows.push(row);
    groups.set(key, entry);
  }
  if (groups.size === 0 && definition.groupByRequired.length === 0 && !definition.bucket) {
    groups.set("{}", { group: {}, rows: [] });
  }
  return [...groups.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([, entry]) => {
      const expression = definition.measure;
      if (expression.kind === "average" || expression.kind === "ratio") {
        const numerator = aggregate(expression.numerator, entry.rows);
        const denominator = aggregate(expression.denominator, entry.rows);
        requireCondition(
          numerator.scale === denominator.scale ||
            (expression.kind === "average" && denominator.scale === 0),
          "METRIC_RATIO_UNIT_MISMATCH",
        );
        const adjustedDenominator =
          expression.kind === "average"
            ? denominator.value * BigInt(10) ** BigInt(numerator.scale)
            : denominator.value;
        return {
          group: entry.group,
          ...(entry.bucket ? { bucket: entry.bucket } : {}),
          value: quotient(numerator.value, adjustedDenominator),
          numerator: formatDecimal(numerator.value, numerator.scale),
          denominator: formatDecimal(denominator.value, denominator.scale),
          valueScale: 12,
          valueRounding: "half-even",
        };
      }
      const result = aggregate(expression, entry.rows);
      return {
        group: entry.group,
        ...(entry.bucket ? { bucket: entry.bucket } : {}),
        value: formatDecimal(result.value, result.scale),
      };
    });
}
