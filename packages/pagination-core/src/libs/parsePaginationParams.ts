import { normalizePaginationLimit, normalizePaginationOffset } from "./normalizePaginationNumber";
import { ConflictingPaginationProblem } from "./problems";
import type { PaginationParams } from "./types";

export function parsePaginationParams(
  query: Record<string, string | string[] | undefined>,
): PaginationParams {
  const cursor = getStringValue(query.cursor);
  const offsetValue = query.offset;
  const limitValue = query.limit;

  if (cursor !== undefined && offsetValue !== undefined) {
    throw new ConflictingPaginationProblem();
  }

  const limit = normalizePaginationLimit(limitValue);
  const offset = normalizePaginationOffset(offsetValue);

  if (offsetValue !== undefined) {
    return {
      mode: "offset",
      offset,
      limit,
    };
  }

  return {
    mode: "cursor",
    cursor: cursor,
    limit,
  };
}

function getStringValue(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return value[0];
  return value;
}
