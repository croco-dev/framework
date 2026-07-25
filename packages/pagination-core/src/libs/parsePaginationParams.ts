import { normalizePaginationLimit, normalizePaginationOffset } from "./normalizePaginationNumber";
import { ConflictingPaginationProblem, InvalidPaginationDirectionProblem } from "./problems";
import { CursorParamsSchema } from "./schemas";
import type { PaginationParams } from "./types";

export function parsePaginationParams(
  query: Record<string, string | string[] | undefined>,
): PaginationParams {
  const cursor = getStringValue(query.cursor);
  const offsetValue = query.offset;
  const limitValue = query.limit;
  const direction = query.direction;

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

function getStringValue(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return value[0];
  return value;
}
