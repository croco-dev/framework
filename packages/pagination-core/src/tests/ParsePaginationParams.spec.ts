import { describe, expect, it } from "vitest";
import { z } from "zod";
import { DEFAULT_LIMIT, MAX_LIMIT, MIN_OFFSET } from "../libs/constants";
import { parsePaginationParams } from "../libs/parsePaginationParams";
import {
  AmbiguousPaginationParameterProblem,
  ConflictingPaginationProblem,
  InvalidPaginationDirectionProblem,
} from "../libs/problems";
import { CursorParamsSchema, OffsetParamsSchema, PaginationParamsSchema } from "../libs/schemas";

describe("parsePaginationParams", () => {
  it.each([
    { field: "cursor", values: ["abc123", "def456"] },
    { field: "offset", values: ["10", "20"] },
    { field: "limit", values: ["10", "20"] },
    { field: "direction", values: ["forward", "backward"] },
  ] as const)(
    "should reject repeated $field values across query representations",
    ({ field, values }) => {
      const recordQuery = { [field]: [...values] };
      const searchParamsQuery = new URLSearchParams();
      for (const value of values) searchParamsQuery.append(field, value);

      for (const query of [recordQuery, searchParamsQuery]) {
        expect(() => parsePaginationParams(query)).toThrow(AmbiguousPaginationParameterProblem);
        expect(() => parsePaginationParams(query)).toThrowError(
          expect.objectContaining({
            code: "AMBIGUOUS_PAGINATION_PARAMETER",
            category: "BadRequest",
            detail: `Pagination parameter '${field}' must be provided at most once`,
            field,
            valueCount: 2,
            extensions: {
              field,
              reason: "repeated-value",
              valueCount: 2,
            },
          }),
        );
      }
    },
  );

  it.each([
    { field: "cursor", value: "abc123" },
    { field: "offset", value: "10" },
    { field: "limit", value: "20" },
    { field: "direction", value: "backward" },
  ] as const)(
    "should normalize one $field value across query representations",
    ({ field, value }) => {
      const expected = parsePaginationParams({ [field]: value });
      const searchParamsQuery = new URLSearchParams({ [field]: value });

      expect(parsePaginationParams({ [field]: [value] })).toEqual(expected);
      expect(parsePaginationParams(searchParamsQuery)).toEqual(expected);
    },
  );

  it("should preserve default pagination for empty record arrays and empty URLSearchParams", () => {
    const expected = parsePaginationParams({});

    expect(parsePaginationParams({ cursor: [], offset: [], limit: [], direction: [] })).toEqual(
      expected,
    );
    expect(parsePaginationParams(new URLSearchParams())).toEqual(expected);
  });

  it("should parse cursor mode params", () => {
    const result = parsePaginationParams({ cursor: "abc123", limit: "10" });
    expect(result.mode).toBe("cursor");
    if (result.mode === "cursor") {
      expect(result.cursor).toBe("abc123");
      expect(result.limit).toBe(10);
    }
  });

  it.each(["forward", "backward"] as const)(
    "should preserve %s direction in cursor mode",
    (direction) => {
      const result = parsePaginationParams({
        cursor: "abc123",
        limit: "10",
        direction,
      });

      expect(result).toEqual({
        mode: "cursor",
        cursor: "abc123",
        limit: 10,
        direction,
      });
    },
  );

  it.each([
    { direction: undefined, accepted: true },
    { direction: "forward", accepted: true },
    { direction: "backward", accepted: true },
    { direction: "sideways", accepted: false },
    { direction: "", accepted: false },
    { direction: "FORWARD", accepted: false },
  ])("should match CursorParamsSchema for direction $direction", ({ direction, accepted }) => {
    const schemaResult = CursorParamsSchema.safeParse({
      cursor: "abc123",
      limit: "10",
      direction,
    });

    expect(schemaResult.success).toBe(accepted);

    if (accepted) {
      expect(() =>
        parsePaginationParams({ cursor: "abc123", limit: "10", direction }),
      ).not.toThrow();
    } else {
      expect(() => parsePaginationParams({ cursor: "abc123", limit: "10", direction })).toThrow(
        InvalidPaginationDirectionProblem,
      );
    }
  });

  it("should expose stable evidence for an invalid cursor direction", () => {
    expect.assertions(5);

    try {
      parsePaginationParams({ cursor: "abc123", direction: "sideways" });
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidPaginationDirectionProblem);
      expect(error).toMatchObject({
        code: "INVALID_PAGINATION_DIRECTION",
        mode: "cursor",
        reason: "unsupported-value",
        extensions: {
          field: "direction",
          mode: "cursor",
          reason: "unsupported-value",
          allowedValues: ["forward", "backward"],
        },
      });
      expect((error as InvalidPaginationDirectionProblem).detail).toBe(
        "Pagination direction must be either 'forward' or 'backward'",
      );
      expect((error as InvalidPaginationDirectionProblem).extensions).not.toHaveProperty(
        "receivedValue",
      );
      expect((error as InvalidPaginationDirectionProblem).category).toBe("BadRequest");
    }
  });

  it("should parse offset mode params", () => {
    const result = parsePaginationParams({ offset: "20", limit: "10" });
    expect(result.mode).toBe("offset");
    if (result.mode === "offset") {
      expect(result.offset).toBe(20);
      expect(result.limit).toBe(10);
    }
  });

  it.each(["forward", "backward", "sideways", ["forward"], ["backward"], ["sideways"]])(
    "should reject direction %s in offset mode in both parser and schema",
    (direction) => {
      const schemaResult = PaginationParamsSchema.safeParse({
        mode: "offset",
        offset: "20",
        limit: "10",
        direction,
      });

      expect(schemaResult.success).toBe(false);
      expect(() => parsePaginationParams({ offset: "20", limit: "10", direction })).toThrow(
        InvalidPaginationDirectionProblem,
      );
    },
  );

  it("should expose stable evidence when direction is used in offset mode", () => {
    expect(() => parsePaginationParams({ offset: "20", direction: "backward" })).toThrowError(
      expect.objectContaining({
        code: "INVALID_PAGINATION_DIRECTION",
        mode: "offset",
        reason: "offset-mode",
        extensions: expect.objectContaining({
          field: "direction",
          mode: "offset",
          reason: "offset-mode",
          validMode: "cursor",
        }),
      }),
    );

    try {
      parsePaginationParams({ offset: "20", direction: "backward" });
    } catch (error) {
      expect((error as InvalidPaginationDirectionProblem).extensions).not.toHaveProperty(
        "allowedValues",
      );
    }
  });

  it("should default to cursor mode with default limit when empty", () => {
    const result = parsePaginationParams({});
    expect(result.mode).toBe("cursor");
    if (result.mode === "cursor") {
      expect(result.cursor).toBeUndefined();
      expect(result.limit).toBe(DEFAULT_LIMIT);
    }
  });

  it("should clamp limit to MAX_LIMIT", () => {
    const result = parsePaginationParams({ limit: "200" });
    expect(result.limit).toBe(MAX_LIMIT);
  });

  it("should use DEFAULT_LIMIT when limit is 0", () => {
    const result = parsePaginationParams({ limit: "0" });
    expect(result.limit).toBe(DEFAULT_LIMIT);
  });

  it("should use DEFAULT_LIMIT when limit is negative", () => {
    const result = parsePaginationParams({ limit: "-5" });
    expect(result.limit).toBe(DEFAULT_LIMIT);
  });

  it("should use DEFAULT_LIMIT when limit is NaN", () => {
    const result = parsePaginationParams({ limit: "abc" });
    expect(result.limit).toBe(DEFAULT_LIMIT);
  });

  it("should floor limit when decimal", () => {
    const result = parsePaginationParams({ limit: "10.7" });
    expect(result.limit).toBe(10);
  });

  it("should clamp offset to MIN_OFFSET (0) when negative", () => {
    const result = parsePaginationParams({ offset: "-3" });
    if (result.mode === "offset") {
      expect(result.offset).toBe(0);
    }
  });

  it("should use MIN_OFFSET when offset is NaN", () => {
    const result = parsePaginationParams({ offset: "xyz" });
    if (result.mode === "offset") {
      expect(result.offset).toBe(0);
    }
  });

  it("should throw ConflictingPaginationProblem when both cursor and offset provided", () => {
    expect(() => parsePaginationParams({ cursor: "abc", offset: "10" })).toThrow(
      ConflictingPaginationProblem,
    );
  });

  it("should throw ConflictingPaginationProblem even with limit provided", () => {
    expect(() => parsePaginationParams({ cursor: "abc", offset: "10", limit: "5" })).toThrow(
      ConflictingPaginationProblem,
    );
  });

  it.each([
    { input: undefined, limit: DEFAULT_LIMIT, offset: MIN_OFFSET },
    { input: "", limit: DEFAULT_LIMIT, offset: MIN_OFFSET },
    { input: "10", limit: 10, offset: 10 },
    { input: "10garbage", limit: DEFAULT_LIMIT, offset: MIN_OFFSET },
    { input: "10.7", limit: 10, offset: 10 },
    { input: "+10", limit: 10, offset: 10 },
    { input: "-5", limit: DEFAULT_LIMIT, offset: MIN_OFFSET },
    { input: " 10 ", limit: 10, offset: 10 },
    { input: "200", limit: MAX_LIMIT, offset: 200 },
    { input: "1e309", limit: DEFAULT_LIMIT, offset: MIN_OFFSET },
    { input: "9007199254740992", limit: MAX_LIMIT, offset: MIN_OFFSET },
    { input: "invalid", limit: DEFAULT_LIMIT, offset: MIN_OFFSET },
  ])(
    "should normalize '$input' consistently across the parser and schemas",
    ({ input, limit, offset }) => {
      const cursorQuery = input === undefined ? {} : { limit: input };
      const offsetQuery = input === undefined ? { offset: undefined } : { offset: input };

      expect(parsePaginationParams(cursorQuery).limit).toBe(limit);
      expect(CursorParamsSchema.parse(cursorQuery).limit).toBe(limit);
      expect(PaginationParamsSchema.parse({ mode: "cursor", ...cursorQuery }).limit).toBe(limit);

      if (input !== undefined) {
        const parsedOffset = parsePaginationParams(offsetQuery);
        expect(parsedOffset.mode).toBe("offset");
        if (parsedOffset.mode === "offset") {
          expect(parsedOffset.offset).toBe(offset);
        }
      }
      expect(OffsetParamsSchema.parse(offsetQuery).offset).toBe(offset);
      const schemaOffset = PaginationParamsSchema.parse({
        mode: "offset",
        ...offsetQuery,
      });
      expect(schemaOffset.mode).toBe("offset");
      if (schemaOffset.mode === "offset") {
        expect(schemaOffset.offset).toBe(offset);
      }
    },
  );

  it("should preserve numeric constraints in exported schema metadata", () => {
    const cursorSchema = z.toJSONSchema(CursorParamsSchema);
    const offsetSchema = z.toJSONSchema(OffsetParamsSchema);

    expect(cursorSchema.properties?.limit).toMatchObject({
      default: DEFAULT_LIMIT,
      type: "integer",
      minimum: 1,
      maximum: MAX_LIMIT,
    });
    expect(offsetSchema.properties?.offset).toMatchObject({
      default: MIN_OFFSET,
      type: "integer",
      minimum: MIN_OFFSET,
    });
  });
});
