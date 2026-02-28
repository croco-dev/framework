/**
 * @packageDocumentation
 * Public API for cursor and offset pagination helpers.
 */

/** Shared pagination defaults and boundary constants. */
export {
  CURSOR_VERSION,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  MIN_LIMIT,
  MIN_OFFSET,
} from './libs/constants';

/** Creates a cursor-based page response. */
export { createCursorPage } from './libs/createCursorPage';

/** Creates an offset-based page response. */
export { createOffsetPage } from './libs/createOffsetPage';

/** Encodes and decodes cursor values. */
export { decodeCursor, encodeCursor } from './libs/cursor';

/** Parses raw pagination input into normalized pagination params. */
export { parsePaginationParams } from './libs/parsePaginationParams';

/** Problem types for invalid pagination input. */
export { ConflictingPaginationProblem, InvalidCursorProblem } from './libs/problems';

/** Pagination request and response model types. */
export type {
  CreateCursorPageOptions,
  CursorPage,
  CursorPageFull,
  CursorParams,
  CursorPayload,
  OffsetPage,
  OffsetParams,
  PaginationParams,
} from './libs/types';
