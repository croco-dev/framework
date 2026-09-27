import { SourceDecodeProblem } from "./SourceDecodeProblem";
import type { SourceField, SourcePosition, SourceValue } from "./types";

const NUMBER_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/;

export function normalizeValue(
  raw: unknown,
  field: SourceField,
  position: SourcePosition,
  numericLexeme?: string,
): SourceValue {
  if (raw === null || (typeof raw === "string" && field.nullValues?.includes(raw))) {
    if (field.nullable) return null;
    throw invalid(field, position, "Null is not allowed");
  }
  if (field.type === "string") {
    if (typeof raw === "string") return raw;
    throw invalid(field, position, "Expected a string");
  }
  if (field.type === "number") {
    if (typeof raw !== "number" && (typeof raw !== "string" || !NUMBER_PATTERN.test(raw))) {
      throw invalid(field, position, "Expected a decimal number");
    }
    const value = typeof raw === "number" ? raw : Number(raw);
    if (
      !Number.isFinite(value) ||
      (Number.isInteger(value) && !Number.isSafeInteger(value)) ||
      ((numericLexeme !== undefined || typeof raw === "string") &&
        decimalFingerprint(numericLexeme ?? String(raw)) !== decimalFingerprint(value.toString()))
    ) {
      throw invalid(field, position, "Number is not finite or loses precision");
    }
    return value;
  }
  if (typeof raw !== "string") throw invalid(field, position, "Expected an ISO date or timestamp");
  const date = DATE_PATTERN.exec(raw);
  if (date) {
    const year = Number(date[1]);
    const month = Number(date[2]);
    const day = Number(date[3]);
    if (!validCalendarDate(year, month, day))
      throw invalid(field, position, "Invalid calendar date");
    return utcCalendarDate(year, month, day);
  }
  const timestamp = TIMESTAMP_PATTERN.exec(raw);
  if (!timestamp)
    throw invalid(
      field,
      position,
      "Expected YYYY-MM-DD or a timestamp with up to three fractional-second digits and an explicit UTC offset",
    );
  const year = Number(timestamp[1]);
  const month = Number(timestamp[2]);
  const day = Number(timestamp[3]);
  const hour = Number(timestamp[4]);
  const minute = Number(timestamp[5]);
  const second = Number(timestamp[6]);
  const zone = timestamp[8];
  if (
    !validCalendarDate(year, month, day) ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    (zone !== "Z" && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4, 6)) > 59))
  ) {
    throw invalid(field, position, "Invalid timestamp");
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) throw invalid(field, position, "Invalid timestamp");
  return parsed;
}

function validCalendarDate(year: number, month: number, day: number): boolean {
  const date = utcCalendarDate(year, month, day);
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function utcCalendarDate(year: number, month: number, day: number): Date {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function decimalFingerprint(value: string): string {
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(value);
  if (!match) return value;
  let digits = `${match[2]}${match[3] ?? ""}`.replace(/^0+/, "");
  if (digits.length === 0) return "0:0";
  const trailingZeros = /0+$/.exec(digits)?.[0].length ?? 0;
  if (trailingZeros > 0) digits = digits.slice(0, -trailingZeros);
  const exponent = Number(match[4] ?? 0) - (match[3] ?? "").length + trailingZeros;
  return `${match[1]}${digits}:${exponent}`;
}

function invalid(
  field: SourceField,
  position: SourcePosition,
  reason: string,
): SourceDecodeProblem {
  return new SourceDecodeProblem(
    "invalid-field",
    position,
    `${reason} for field '${field.name}'`,
    field.name,
  );
}
