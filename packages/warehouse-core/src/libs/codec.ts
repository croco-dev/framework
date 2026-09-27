import { assertContract, WarehouseContractError } from "./diagnostics";
import { canonicalJson, integer, isRecord } from "./primitives";
import { assertFact } from "./schema";
export { canonicalJson, isRecord } from "./primitives";
import type { CanonicalRow, Column, FactDeclaration, TrustedScope } from "./types";

function calendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function canonicalizeColumn(
  column: Column,
  value: unknown,
  path: string,
): string | boolean | null {
  if (value === null) {
    assertContract(column.nullable === true, "WAREHOUSE_NULL_NOT_ALLOWED", path);
    return null;
  }
  switch (column.type) {
    case "boolean":
      assertContract(typeof value === "boolean", "WAREHOUSE_INVALID_BOOLEAN", path);
      return value;
    case "int64":
    case "money": {
      const encoded = integer(value, path);
      assertContract(
        (column.min === undefined || BigInt(encoded) >= BigInt(column.min)) &&
          (column.max === undefined || BigInt(encoded) <= BigInt(column.max)),
        "WAREHOUSE_INTEGER_BOUNDS",
        path,
      );
      return encoded;
    }
    case "decimal": {
      assertContract(
        typeof value === "string" && /^-?(0|[1-9]\d*)(\.\d+)?$/.test(value),
        "WAREHOUSE_INVALID_DECIMAL",
        path,
      );
      const negative = value.startsWith("-");
      const [whole, fraction = ""] = value.replace(/^-/, "").split(".");
      assertContract(
        fraction.length <= column.scale &&
          (whole === "0" ? 0 : whole.length) <= column.precision - column.scale,
        "WAREHOUSE_DECIMAL_PRECISION",
        path,
      );
      const digits = whole + fraction;
      return `${negative && /[1-9]/.test(digits) ? "-" : ""}${whole}${column.scale ? `.${fraction.padEnd(column.scale, "0")}` : ""}`;
    }
    case "instant": {
      const precision = { second: 0, millisecond: 3, microsecond: 6 }[column.precision];
      assertContract(typeof value === "string", "WAREHOUSE_INVALID_INSTANT", path);
      const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?Z$/.exec(value);
      assertContract(
        match &&
          calendarDate(match[1]) &&
          Number(match[2]) < 24 &&
          Number(match[3]) < 60 &&
          Number(match[4]) < 60 &&
          (match[5]?.length ?? 0) === precision,
        "WAREHOUSE_INVALID_INSTANT",
        path,
      );
      return value;
    }
    case "date":
      assertContract(
        typeof value === "string" && calendarDate(value),
        "WAREHOUSE_INVALID_DATE",
        path,
      );
      return value;
    case "currency":
      assertContract(
        typeof value === "string" && /^[A-Z]{3}$/.test(value),
        "WAREHOUSE_INVALID_CURRENCY",
        path,
      );
      return value;
    case "id":
    case "subject":
      assertContract(typeof value === "string" && value.length > 0, "WAREHOUSE_INVALID_ID", path);
      return value;
    case "string":
      assertContract(typeof value === "string", "WAREHOUSE_INVALID_STRING", path);
      return value;
    default:
      throw new WarehouseContractError("WAREHOUSE_UNSUPPORTED_COLUMN", path);
  }
}

export function validateRow(fact: FactDeclaration, row: unknown): CanonicalRow {
  assertFact(fact);
  assertContract(isRecord(row), "WAREHOUSE_INVALID_ROW");
  assertContract(
    Object.keys(row).every((key) => Object.hasOwn(fact.columns, key)),
    "WAREHOUSE_UNKNOWN_FIELD",
  );
  const result: Record<string, string | boolean | null> = {};
  for (const key of Object.keys(fact.columns).sort()) {
    assertContract(Object.hasOwn(row, key), "WAREHOUSE_MISSING_FIELD", key);
    result[key] = canonicalizeColumn(fact.columns[key], row[key], key);
  }
  return Object.freeze(result);
}

function typedTuple(fact: FactDeclaration, row: CanonicalRow, keys: readonly string[]): unknown[] {
  return keys.map((key) => [key, fact.columns[key].type, row[key]]);
}

export function canonicalPayload(fact: FactDeclaration, row: unknown): string {
  return canonicalJson([
    "warehouse-payload",
    1,
    typedTuple(fact, validateRow(fact, row), Object.keys(fact.columns).sort()),
  ]);
}

export function encodeIdentity(fact: FactDeclaration, row: unknown, scope: TrustedScope): string {
  assertContract(
    isRecord(scope) &&
      Object.keys(scope).every((key) => ["application", "environment", "tenant"].includes(key)) &&
      typeof scope.application === "string" &&
      scope.application.length > 0 &&
      typeof scope.environment === "string" &&
      scope.environment.length > 0 &&
      (fact.scope === "tenant"
        ? typeof scope.tenant === "string" && scope.tenant.length > 0
        : scope.tenant === undefined),
    "WAREHOUSE_INVALID_SCOPE",
  );
  return canonicalJson([
    "warehouse-identity",
    1,
    [scope.application, scope.environment, scope.tenant ?? null],
    fact.name,
    typedTuple(fact, validateRow(fact, row), fact.grain.key),
  ]);
}
