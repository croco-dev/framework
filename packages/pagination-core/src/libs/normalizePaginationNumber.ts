import { DEFAULT_LIMIT, MAX_LIMIT, MIN_LIMIT, MIN_OFFSET } from "./constants";

function parseQueryNumber(value: unknown): number | undefined {
  const isStringArray = Array.isArray(value) && value.every((item) => typeof item === "string");
  if (typeof value !== "string" && typeof value !== "number" && !isStringArray) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;

  return parsed;
}

export function normalizePaginationLimit(value: unknown): number {
  const parsed = parseQueryNumber(value);
  if (parsed === undefined) return DEFAULT_LIMIT;

  const floored = Math.floor(parsed);
  if (floored < MIN_LIMIT) return DEFAULT_LIMIT;
  if (floored > MAX_LIMIT) return MAX_LIMIT;

  return floored;
}

export function normalizePaginationOffset(value: unknown): number {
  const parsed = parseQueryNumber(value);
  if (parsed === undefined) return MIN_OFFSET;

  const floored = Math.floor(parsed);
  if (!Number.isSafeInteger(floored)) return MIN_OFFSET;

  return Math.max(MIN_OFFSET, floored);
}
