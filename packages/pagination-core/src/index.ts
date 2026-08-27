/**
 * @packageDocumentation
 * Public API for cursor and offset pagination helpers.
 */

export { CURSOR_VERSION, DEFAULT_LIMIT, MAX_LIMIT, MIN_LIMIT, MIN_OFFSET } from "./libs/constants";

export { createCursorPage } from "./libs/createCursorPage";

export { createOffsetPage } from "./libs/createOffsetPage";

export { createCursorCodec, decodeCursor, encodeCursor } from "./libs/cursor";
export type { CursorCodec } from "./libs/cursor";

export { parsePaginationParams } from "./libs/parsePaginationParams";

export {
  ConflictingPaginationProblem,
  InvalidCursorProblem,
  InvalidPaginationDirectionProblem,
} from "./libs/problems";
export type { InvalidPaginationDirectionProblemOptions } from "./libs/problems";
export type {
  CursorParamsInput,
  CursorParamsOutput,
  CursorPayloadInput,
  CursorPayloadOutput,
  OffsetParamsInput,
  OffsetParamsOutput,
  PaginationParamsInput,
  PaginationParamsOutput,
} from "./libs/schemas";
export {
  CursorParamsSchema,
  CursorPayloadSchema,
  OffsetParamsSchema,
  PaginationParamsSchema,
} from "./libs/schemas";
export type {
  CreateCursorPageOptions,
  CursorPage,
  CursorPageFull,
  CursorParams,
  CursorPayload,
  OffsetPage,
  OffsetParams,
  PaginationParams,
} from "./libs/types";
