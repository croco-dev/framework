// Cursor mode parameters
export type CursorParams = {
  cursor?: string;
  limit: number;
  direction?: 'forward' | 'backward';
};

// Offset mode parameters
export type OffsetParams = {
  offset: number;
  limit: number;
};

// Unified input (parse result)
export type PaginationParams = ({ mode: 'cursor' } & CursorParams) | ({ mode: 'offset' } & OffsetParams);

// Cursor page response (REST: Stripe style)
export type CursorPage<T> = {
  data: T[];
  hasMore: boolean;
  nextCursor: string | null;
};

// Internal bidirectional (can be used for GraphQL conversion)
export type CursorPageFull<T> = CursorPage<T> & {
  hasPrevious: boolean;
  prevCursor: string | null;
};

// Offset page response
export type OffsetPage<T> = {
  data: T[];
  total: number;
  limit: number;
  offset: number;
};

// Cursor payload (Base64 encoding target)
export type CursorPayload = {
  v: number; // version
  id: string; // cursor value (ULID etc.)
  [key: string]: unknown; // compound key extensibility
};

// createCursorPage options
export type CreateCursorPageOptions<T> = {
  limit: number;
  getId: (item: T) => string;
  hasPrevious?: boolean;
  prevCursor?: string | null;
};
