import { normalizePaginationLimit, normalizePaginationOffset } from "./normalizePaginationNumber";
import {
  AmbiguousPaginationParameterProblem,
  ConflictingPaginationProblem,
  InvalidPaginationDirectionProblem,
} from "./problems";
import { CursorParamsSchema } from "./schemas";
import type { PaginationParams } from "./types";

export type PaginationQueryInput =
  | Pick<URLSearchParams, "getAll">
  | Readonly<Record<string, string | readonly string[] | undefined>>;

type PaginationParameter = "cursor" | "direction" | "limit" | "offset";

export function parsePaginationParams(query: PaginationQueryInput): PaginationParams {
  const cursor = getScalarQueryValue(query, "cursor");
  const offsetValue = getScalarQueryValue(query, "offset");
  const limitValue = getScalarQueryValue(query, "limit");
  const direction = getScalarQueryValue(query, "direction");

  if (cursor !== undefined && offsetValue !== undefined) {
    throw new ConflictingPaginationProblem();
  }

  const limit = normalizePaginationLimit(limitValue);
  const offset = normalizePaginationOffset(offsetValue);

  if (offsetValue !== undefined) {
    if (direction !== undefined) {
      throw new InvalidPaginationDirectionProblem({
        mode: "offset",
        reason: "offset-mode",
      });
    }

    return {
      mode: "offset",
      offset,
      limit,
    };
  }

  const parsedDirection = CursorParamsSchema.shape.direction.safeParse(direction);
  if (!parsedDirection.success) {
    throw new InvalidPaginationDirectionProblem({
      mode: "cursor",
      reason: "unsupported-value",
    });
  }

  return {
    mode: "cursor",
    cursor: cursor,
    limit,
    ...(parsedDirection.data !== undefined ? { direction: parsedDirection.data } : {}),
  };
}

function getScalarQueryValue(
  query: PaginationQueryInput,
  field: PaginationParameter,
): string | undefined {
  const values = isSearchParams(query) ? query.getAll(field) : normalizeRecordValue(query[field]);

  if (values.length > 1) {
    throw new AmbiguousPaginationParameterProblem(field, values.length);
  }

  return values[0];
}

function isSearchParams(query: PaginationQueryInput): query is Pick<URLSearchParams, "getAll"> {
  return "getAll" in query && typeof query.getAll === "function";
}

function normalizeRecordValue(value: string | readonly string[] | undefined): readonly string[] {
  if (value === undefined) return [];
  return typeof value === "string" ? [value] : value;
}
