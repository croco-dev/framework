import { DEFAULT_LIMIT, MAX_LIMIT, MIN_LIMIT, MIN_OFFSET } from './constants';
import { ConflictingPaginationProblem } from './problems';
import type { PaginationParams } from './types';

export function parsePaginationParams(query: Record<string, string | string[] | undefined>): PaginationParams {
  const cursor = getStringValue(query.cursor);
  const offsetStr = getStringValue(query.offset);
  const limitStr = getStringValue(query.limit);

  if (cursor !== undefined && offsetStr !== undefined) {
    throw new ConflictingPaginationProblem();
  }

  const limit = normalizeLimit(limitStr);
  const offset = normalizeOffset(offsetStr);

  if (offsetStr !== undefined) {
    return {
      mode: 'offset',
      offset,
      limit,
    };
  }

  return {
    mode: 'cursor',
    cursor: cursor,
    limit,
  };
}

function getStringValue(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return value[0];
  return value;
}

function normalizeLimit(value: string | undefined): number {
  if (value === undefined) return DEFAULT_LIMIT;

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return DEFAULT_LIMIT;

  const floored = Math.floor(parsed);

  if (floored < MIN_LIMIT) return DEFAULT_LIMIT;
  if (floored > MAX_LIMIT) return MAX_LIMIT;

  return floored;
}

function normalizeOffset(value: string | undefined): number {
  if (value === undefined) return MIN_OFFSET;

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return MIN_OFFSET;

  const floored = Math.floor(parsed);
  return Math.max(MIN_OFFSET, floored);
}
