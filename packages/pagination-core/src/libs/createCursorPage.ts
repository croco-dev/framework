import { CURSOR_VERSION } from './constants';
import { encodeCursor } from './cursor';
import type { CreateCursorPageOptions, CursorPage, CursorPageFull } from './types';

/**
 * Create a cursor-based page result
 *
 * Algorithm:
 * 1. If items.length > limit: slice to limit, hasMore=true, nextCursor=encode(lastItem.id)
 * 2. If items.length <= limit: keep all, hasMore=false, nextCursor=null
 * 3. If hasPrevious/prevCursor provided, return CursorPageFull
 */
export function createCursorPage<T>(
  items: T[],
  options: CreateCursorPageOptions<T>
): CursorPage<T> | CursorPageFull<T> {
  const { limit, getId, hasPrevious, prevCursor } = options;

  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, limit) : items;

  let nextCursor: string | null = null;
  if (hasMore && data.length > 0) {
    const lastItem = data[data.length - 1];
    nextCursor = encodeCursor({
      v: CURSOR_VERSION,
      id: getId(lastItem),
    });
  }

  const page: CursorPage<T> = {
    data,
    hasMore,
    nextCursor,
  };

  // Return full page if bidirectional info provided
  if (hasPrevious !== undefined || prevCursor !== undefined) {
    return {
      ...page,
      hasPrevious: hasPrevious ?? false,
      prevCursor: prevCursor ?? null,
    };
  }

  return page;
}
