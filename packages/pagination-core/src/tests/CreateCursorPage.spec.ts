import { describe, expect, it } from "vitest";
import { createCursorPage } from "../libs/createCursorPage";
import { InvalidPaginationLimitProblem } from "../libs/problems";

describe("createCursorPage", () => {
  it("should return hasMore=false when items length equals limit", () => {
    const items = Array.from({ length: 20 }, (_, i) => ({ id: `item_${i}` }));
    const result = createCursorPage(items, { limit: 20, getId: (item) => item.id });
    expect(result.data).toHaveLength(20);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("should return hasMore=true and nextCursor when items exceed limit", () => {
    const items = Array.from({ length: 21 }, (_, i) => ({ id: `item_${i}` }));
    const result = createCursorPage(items, { limit: 20, getId: (item) => item.id });
    expect(result.data).toHaveLength(20);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).not.toBeNull();
  });

  it("should return empty data for empty array", () => {
    const result = createCursorPage<{ id: string }>([], { limit: 20, getId: (item) => item.id });
    expect(result.data).toEqual([]);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("should return hasMore=false when items less than limit", () => {
    const items = [{ id: "1" }, { id: "2" }, { id: "3" }];
    const result = createCursorPage(items, { limit: 20, getId: (item) => item.id });
    expect(result.data).toHaveLength(3);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("should use custom getId function", () => {
    const items = [{ userId: "usr_123" }, { userId: "usr_456" }];
    const result = createCursorPage(items, { limit: 20, getId: (item) => item.userId });
    expect(result.hasMore).toBe(false);
  });

  it("should handle single item with limit 1", () => {
    const items = [{ id: "single" }];
    const result = createCursorPage(items, { limit: 1, getId: (item) => item.id });
    expect(result.data).toHaveLength(1);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("should return CursorPageFull when hasPrevious/prevCursor provided", () => {
    const items = [{ id: "1" }, { id: "2" }];
    const result = createCursorPage(items, {
      limit: 20,
      getId: (item) => item.id,
      hasPrevious: true,
      prevCursor: "prev_cursor_string",
    });
    expect(result.hasPrevious).toBe(true);
    expect(result.prevCursor).toBe("prev_cursor_string");
  });

  it.each([0, -1, -100])("should reject non-positive limit %i", (limit) => {
    const items = [{ id: "a" }, { id: "b" }];
    expect(() => createCursorPage(items, { limit, getId: (item) => item.id })).toThrow(
      InvalidPaginationLimitProblem,
    );
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 1.5])(
    "should expose stable evidence for invalid limit %s",
    (limit) => {
      const items = [{ id: "a" }, { id: "b" }];
      const expectedLimit = Number.isFinite(limit) ? limit : String(limit);
      try {
        createCursorPage(items, { limit, getId: (item) => item.id });
        expect.unreachable();
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidPaginationLimitProblem);
        expect(error).toMatchObject({
          code: "INVALID_PAGINATION_LIMIT",
          category: "BadRequest",
          limit,
          extensions: {
            field: "limit",
            reason: "below-minimum",
            limit: expectedLimit,
            minimum: 1,
          },
        });
      }
    },
  );

  it("should preserve the hasMore-implies-nextCursor invariant for valid limits", () => {
    const items = Array.from({ length: 5 }, (_, i) => ({ id: `item_${i}` }));
    for (const limit of [1, 2, 4, 5, 6]) {
      const result = createCursorPage(items, { limit, getId: (item) => item.id });
      if (result.hasMore) {
        expect(result.nextCursor).not.toBeNull();
        expect(result.data).toHaveLength(limit);
      } else {
        expect(result.nextCursor).toBeNull();
      }
    }
  });
});
