import { assertContract } from "./diagnostics";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  );
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  assertContract(
    value === null ||
      typeof value === "string" ||
      typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value)),
    "WAREHOUSE_INVALID_JSON",
  );
  return JSON.stringify(value);
}

export function integer(value: unknown, path?: string): string {
  assertContract(
    typeof value === "bigint" || (typeof value === "string" && /^-?(0|[1-9]\d*)$/.test(value)),
    "WAREHOUSE_INVALID_INTEGER",
    path,
  );
  const result = BigInt(value);
  assertContract(
    result >= -9223372036854775808n && result <= 9223372036854775807n,
    "WAREHOUSE_INTEGER_OVERFLOW",
    path,
  );
  return result.toString();
}
