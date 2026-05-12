import type { OffsetPage } from "./types";

/**
 * Create an offset-based page result
 */
export function createOffsetPage<T>(
  items: T[],
  options: { total: number; limit: number; offset: number },
): OffsetPage<T> {
  const { total, limit, offset } = options;

  return {
    data: items,
    total,
    limit,
    offset,
  };
}
