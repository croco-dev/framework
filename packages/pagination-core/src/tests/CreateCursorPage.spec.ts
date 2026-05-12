import { describe, expect, it } from "vitest";
import { createCursorPage } from "../libs/createCursorPage";

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
});
