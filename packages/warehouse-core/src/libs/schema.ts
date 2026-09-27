import { integer, isRecord } from "./primitives";
import { assertContract, WarehouseContractError } from "./diagnostics";
import type { FactDeclaration } from "./types";

function keys(
  value: unknown,
  allowed: readonly string[],
  path: string,
): asserts value is Record<string, unknown> {
  assertContract(
    isRecord(value) && Object.keys(value).every((key) => allowed.includes(key)),
    "WAREHOUSE_INVALID_DECLARATION",
    path,
  );
}

function text(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function name(value: string): boolean {
  return (
    /^[A-Za-z][A-Za-z0-9_]*$/.test(value) &&
    ![
      "tenant",
      "tenantId",
      "application",
      "environment",
      "runId",
      "executionId",
      "attemptId",
      "batchId",
      "sourceId",
      "sourceRecordId",
      "sourceRevision",
      "materializationId",
      "snapshotId",
      "provenance",
      "constructor",
      "prototype",
    ].includes(value)
  );
}

export function assertFact(value: unknown): asserts value is FactDeclaration {
  keys(
    value,
    [
      "name",
      "version",
      "kind",
      "scope",
      "grain",
      "columns",
      "time",
      "write",
      "aggregate",
      "policyRefs",
      "sourceRefs",
      "description",
      "irVersion",
      "compilerVersion",
      "semanticHash",
    ],
    "fact",
  );
  assertContract(typeof value.name === "string" && name(value.name), "WAREHOUSE_INVALID_NAME");
  assertContract(
    Number.isSafeInteger(value.version) && Number(value.version) > 0,
    "WAREHOUSE_INVALID_VERSION",
  );
  assertContract(
    value.kind === "transaction" || value.kind === "aggregate",
    "WAREHOUSE_UNSUPPORTED_KIND",
  );
  assertContract(
    value.scope === "tenant" || value.scope === "application",
    "WAREHOUSE_INVALID_SCOPE",
  );
  assertContract(
    value.description === undefined || typeof value.description === "string",
    "WAREHOUSE_INVALID_DESCRIPTION",
  );
  for (const key of ["policyRefs", "sourceRefs"]) {
    const refs = value[key];
    assertContract(
      refs === undefined ||
        (Array.isArray(refs) && refs.every(text) && new Set(refs).size === refs.length),
      "WAREHOUSE_INVALID_REFERENCES",
    );
  }
  assertContract(
    isRecord(value.columns) && Object.keys(value.columns).length > 0,
    "WAREHOUSE_INVALID_COLUMNS",
  );
  const columns = value.columns;
  for (const [key, column] of Object.entries(columns)) {
    assertContract(name(key), "WAREHOUSE_RESERVED_COLUMN");
    assertContract(isRecord(column), "WAREHOUSE_INVALID_COLUMN", key);
    const extras: Record<string, readonly string[]> = {
      id: [],
      string: [],
      boolean: [],
      currency: [],
      subject: ["subject"],
      int64: ["min", "max"],
      money: ["currency", "min", "max"],
      decimal: ["precision", "scale"],
      instant: ["precision"],
      date: ["zone"],
    };
    assertContract(
      typeof column.type === "string" && Object.hasOwn(extras, column.type),
      "WAREHOUSE_UNSUPPORTED_COLUMN",
      key,
    );
    keys(column, ["type", "nullable", "description", "sensitivity", ...extras[column.type]], key);
    assertContract(
      column.nullable === undefined || column.nullable === true,
      "WAREHOUSE_INVALID_NULLABILITY",
      key,
    );
    assertContract(
      column.description === undefined || typeof column.description === "string",
      "WAREHOUSE_INVALID_DESCRIPTION",
      key,
    );
    assertContract(
      column.sensitivity === undefined ||
        (typeof column.sensitivity === "string" &&
          ["public", "internal", "sensitive"].includes(column.sensitivity)),
      "WAREHOUSE_INVALID_SENSITIVITY",
      key,
    );
    if (column.type === "subject")
      assertContract(text(column.subject), "WAREHOUSE_INVALID_SUBJECT", key);
    if (column.type === "instant")
      assertContract(
        typeof column.precision === "string" &&
          ["second", "millisecond", "microsecond"].includes(column.precision),
        "WAREHOUSE_UNSUPPORTED_PRECISION",
        key,
      );
    if (column.type === "decimal") {
      assertContract(
        Number.isSafeInteger(column.precision) &&
          Number(column.precision) >= 1 &&
          Number(column.precision) <= 38 &&
          Number.isSafeInteger(column.scale) &&
          Number(column.scale) >= 0 &&
          Number(column.scale) <= Number(column.precision),
        "WAREHOUSE_UNSUPPORTED_PRECISION",
        key,
      );
    }
    if (column.type === "date") {
      assertContract(text(column.zone), "WAREHOUSE_INVALID_ZONE", key);
      assertContract(
        !/^(?:[+-]|(?:GMT|UTC)[+-])/i.test(column.zone),
        "WAREHOUSE_INVALID_ZONE",
        key,
      );
      try {
        new Intl.DateTimeFormat("en", { timeZone: column.zone });
      } catch {
        throw new WarehouseContractError("WAREHOUSE_INVALID_ZONE", key);
      }
    }
    if (column.type === "int64" || column.type === "money") {
      if (column.min !== undefined)
        assertContract(
          typeof column.min === "string" && integer(column.min, key) === column.min,
          "WAREHOUSE_INVALID_BOUNDS",
          key,
        );
      if (column.max !== undefined)
        assertContract(
          typeof column.max === "string" && integer(column.max, key) === column.max,
          "WAREHOUSE_INVALID_BOUNDS",
          key,
        );
      if (typeof column.min === "string" && typeof column.max === "string")
        assertContract(BigInt(column.min) <= BigInt(column.max), "WAREHOUSE_INVALID_BOUNDS", key);
    }
    if (column.type === "money") {
      const currency =
        typeof column.currency === "string" && Object.hasOwn(columns, column.currency)
          ? columns[column.currency]
          : undefined;
      assertContract(
        isRecord(currency) && currency.type === "currency" && currency.nullable === undefined,
        "WAREHOUSE_INVALID_CURRENCY_REFERENCE",
        key,
      );
    }
  }
  const reference = (key: unknown, type?: string): key is string => {
    if (typeof key !== "string" || !Object.hasOwn(columns, key)) return false;
    const column = columns[key];
    return (
      isRecord(column) &&
      column.nullable === undefined &&
      (type === undefined || column.type === type)
    );
  };
  keys(value.grain, ["description", "key"], "grain");
  assertContract(
    text(value.grain.description) &&
      Array.isArray(value.grain.key) &&
      value.grain.key.length > 0 &&
      value.grain.key.every((key) => reference(key)) &&
      new Set(value.grain.key).size === value.grain.key.length,
    "WAREHOUSE_INVALID_GRAIN",
  );
  keys(value.time, ["event"], "time");
  assertContract(
    reference(value.time.event, value.kind === "transaction" ? "instant" : "date"),
    "WAREHOUSE_INVALID_TIME_REFERENCE",
  );
  keys(value.write, ["mode", "duplicate", "conflict"], "write");
  assertContract(
    value.write.mode === (value.kind === "transaction" ? "append" : "replace-range") &&
      value.write.duplicate === "ignore-identical" &&
      value.write.conflict === "reject",
    "WAREHOUSE_INVALID_WRITE_POLICY",
  );
  if (value.kind === "transaction") {
    assertContract(value.aggregate === undefined, "WAREHOUSE_INVALID_AGGREGATE");
    return;
  }
  keys(value.aggregate, ["date", "series", "dimensions", "measures"], "aggregate");
  const aggregate = value.aggregate;
  assertContract(
    reference(aggregate.date, "date") &&
      aggregate.date === value.time.event &&
      Array.isArray(aggregate.series) &&
      aggregate.series.length > 0 &&
      aggregate.series.every((key) => reference(key)) &&
      Array.isArray(aggregate.dimensions) &&
      aggregate.dimensions.every((key) => reference(key)),
    "WAREHOUSE_INVALID_AGGREGATE",
  );
  const tuple = [aggregate.date, ...aggregate.series, ...aggregate.dimensions];
  assertContract(
    new Set(tuple).size === tuple.length &&
      tuple.length === value.grain.key.length &&
      tuple.every((key, index) => key === (value.grain as { key: unknown[] }).key[index]),
    "WAREHOUSE_INVALID_AGGREGATE_GRAIN",
  );
  assertContract(
    isRecord(aggregate.measures) && Object.keys(aggregate.measures).length > 0,
    "WAREHOUSE_INVALID_MEASURES",
  );
  for (const [key, measure] of Object.entries(aggregate.measures)) {
    assertContract(
      Object.hasOwn(columns, key) &&
        isRecord(columns[key]) &&
        ["int64", "money", "decimal"].includes(String(columns[key].type)) &&
        !tuple.includes(key),
      "WAREHOUSE_INVALID_MEASURE",
    );
    keys(measure, ["unit", "reaggregate"], "measure");
    assertContract(
      text(measure.unit) && (measure.reaggregate === "sum" || measure.reaggregate === "none"),
      "WAREHOUSE_INVALID_MEASURE",
    );
  }
  assertContract(
    Object.keys(columns).every(
      (key) => tuple.includes(key) || Object.hasOwn(aggregate.measures as object, key),
    ),
    "WAREHOUSE_UNCLASSIFIED_AGGREGATE_COLUMN",
  );
}
