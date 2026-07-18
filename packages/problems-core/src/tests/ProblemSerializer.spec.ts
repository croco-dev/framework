import { describe, expect, it } from "vitest";
import {
  isValidExtensions,
  Problem,
  ProblemCategory,
  ProblemCategoryMapper,
  ProblemSerializer,
  validateExtensions,
} from "../index";

function expectParseProblem(parse: () => unknown, detail: string): void {
  let thrown: unknown;

  try {
    parse();
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toBeInstanceOf(Problem);
  expect(thrown).toMatchObject({
    code: "problems-core/parse-error",
    detail,
    status: 400,
  });
}

describe("ProblemCategoryMapper - exhaustive switch", () => {
  it("should map all ProblemCategory values to HTTP status codes", () => {
    const testCases: Array<{ category: ProblemCategory; expectedStatus: number }> = [
      { category: ProblemCategory.BadRequest, expectedStatus: 400 },
      { category: ProblemCategory.Unauthorized, expectedStatus: 401 },
      { category: ProblemCategory.Forbidden, expectedStatus: 403 },
      { category: ProblemCategory.NotFound, expectedStatus: 404 },
      { category: ProblemCategory.Conflict, expectedStatus: 409 },
      { category: ProblemCategory.Gone, expectedStatus: 410 },
      { category: ProblemCategory.PayloadTooLarge, expectedStatus: 413 },
      { category: ProblemCategory.ValidationError, expectedStatus: 422 },
      { category: ProblemCategory.BusinessRuleViolation, expectedStatus: 422 },
      { category: ProblemCategory.TooManyRequests, expectedStatus: 429 },
      { category: ProblemCategory.InternalServerError, expectedStatus: 500 },
      { category: ProblemCategory.NotImplemented, expectedStatus: 501 },
    ];

    for (const { category, expectedStatus } of testCases) {
      expect(ProblemCategoryMapper.toHttpStatus(category)).toBe(expectedStatus);
    }
  });

  it("should map all ProblemCategory values to titles", () => {
    const testCases: Array<{ category: ProblemCategory; expectedTitle: string }> = [
      { category: ProblemCategory.BadRequest, expectedTitle: "Bad Request" },
      { category: ProblemCategory.Unauthorized, expectedTitle: "Unauthorized" },
      { category: ProblemCategory.Forbidden, expectedTitle: "Forbidden" },
      { category: ProblemCategory.NotFound, expectedTitle: "Not Found" },
      { category: ProblemCategory.Conflict, expectedTitle: "Conflict" },
      { category: ProblemCategory.Gone, expectedTitle: "Gone" },
      { category: ProblemCategory.PayloadTooLarge, expectedTitle: "Payload Too Large" },
      { category: ProblemCategory.ValidationError, expectedTitle: "Validation Error" },
      { category: ProblemCategory.BusinessRuleViolation, expectedTitle: "Business Rule Violation" },
      { category: ProblemCategory.TooManyRequests, expectedTitle: "Too Many Requests" },
      { category: ProblemCategory.InternalServerError, expectedTitle: "Internal Server Error" },
      { category: ProblemCategory.NotImplemented, expectedTitle: "Not Implemented" },
    ];

    for (const { category, expectedTitle } of testCases) {
      expect(ProblemCategoryMapper.toTitle(category)).toBe(expectedTitle);
    }
  });
});

describe("ProblemSerializer", () => {
  describe("serialize", () => {
    it("should serialize basic ProblemDetails", () => {
      const details = {
        type: "about:blank",
        title: "Not Found",
        status: 404,
        code: "USER_NOT_FOUND",
      };

      const serialized = ProblemSerializer.serialize(details);

      expect(serialized).toEqual({
        type: "about:blank",
        title: "Not Found",
        status: 404,
        code: "USER_NOT_FOUND",
      });
    });

    it("should serialize ProblemDetails with optional fields", () => {
      const details = {
        type: "https://example.com/problems/not-found",
        title: "Not Found",
        status: 404,
        detail: "The user could not be found",
        instance: "/users/123",
        code: "USER_NOT_FOUND",
      };

      const serialized = ProblemSerializer.serialize(details);

      expect(serialized).toEqual({
        type: "https://example.com/problems/not-found",
        title: "Not Found",
        status: 404,
        detail: "The user could not be found",
        instance: "/users/123",
        code: "USER_NOT_FOUND",
      });
    });

    it("should serialize ProblemDetails with extensions", () => {
      const details = {
        type: "about:blank",
        title: "Validation Error",
        status: 422,
        code: "VALIDATION_FAILED",
        errors: [{ field: "email", message: "Invalid email" }],
      };

      const serialized = ProblemSerializer.serialize(details);

      expect(serialized.type).toBe("about:blank");
      expect(serialized.title).toBe("Validation Error");
      expect(serialized.status).toBe(422);
      expect(serialized.code).toBe("VALIDATION_FAILED");
      expect(serialized.extensions).toEqual({
        errors: [{ field: "email", message: "Invalid email" }],
      });
    });
  });

  describe("deserialize", () => {
    it("should deserialize basic SerializedProblem", () => {
      const serialized = {
        type: "about:blank",
        title: "Not Found",
        status: 404,
        code: "USER_NOT_FOUND",
      };

      const details = ProblemSerializer.deserialize(serialized);

      expect(details).toEqual({
        type: "about:blank",
        title: "Not Found",
        status: 404,
        code: "USER_NOT_FOUND",
      });
    });

    it("should deserialize SerializedProblem with optional fields", () => {
      const serialized = {
        type: "https://example.com/problems/not-found",
        title: "Not Found",
        status: 404,
        detail: "The user could not be found",
        instance: "/users/123",
        code: "USER_NOT_FOUND",
      };

      const details = ProblemSerializer.deserialize(serialized);

      expect(details).toEqual({
        type: "https://example.com/problems/not-found",
        title: "Not Found",
        status: 404,
        detail: "The user could not be found",
        instance: "/users/123",
        code: "USER_NOT_FOUND",
      });
    });

    it("should deserialize SerializedProblem with extensions", () => {
      const serialized = {
        type: "about:blank",
        title: "Validation Error",
        status: 422,
        code: "VALIDATION_FAILED",
        extensions: {
          errors: [{ field: "email", message: "Invalid email" }],
        },
      };

      const details = ProblemSerializer.deserialize(serialized);

      expect(details.type).toBe("about:blank");
      expect(details.title).toBe("Validation Error");
      expect(details.status).toBe(422);
      expect(details.code).toBe("VALIDATION_FAILED");
      expect(details.errors).toEqual([{ field: "email", message: "Invalid email" }]);
    });
  });

  describe("fromJson", () => {
    it("should parse valid JSON object", () => {
      const json = {
        type: "about:blank",
        title: "Not Found",
        status: 404,
        code: "USER_NOT_FOUND",
      };

      const details = ProblemSerializer.fromJson(json);

      expect(details).toEqual({
        type: "about:blank",
        title: "Not Found",
        status: 404,
        code: "USER_NOT_FOUND",
      });
    });

    it("should parse JSON with all fields", () => {
      const json = {
        type: "https://example.com/problems/error",
        title: "Error",
        status: 500,
        detail: "Something went wrong",
        instance: "/api/v1/resource",
        code: "INTERNAL_ERROR",
        traceId: "abc-123",
      };

      const details = ProblemSerializer.fromJson(json);

      expect(details.type).toBe("https://example.com/problems/error");
      expect(details.title).toBe("Error");
      expect(details.status).toBe(500);
      expect(details.detail).toBe("Something went wrong");
      expect(details.instance).toBe("/api/v1/resource");
      expect(details.code).toBe("INTERNAL_ERROR");
      expect(details.traceId).toBe("abc-123");
    });

    it("should throw for non-object input", () => {
      expect(() => ProblemSerializer.fromJson("string")).toThrow(
        "Expected object for ProblemDetails",
      );
      expect(() => ProblemSerializer.fromJson(null)).toThrow("Expected object for ProblemDetails");
      expect(() => ProblemSerializer.fromJson(123)).toThrow("Expected object for ProblemDetails");
    });

    it("should throw for missing required fields", () => {
      expect(() => ProblemSerializer.fromJson({})).toThrow('Missing or invalid "type" field');
      expect(() => ProblemSerializer.fromJson({ type: "test" })).toThrow(
        'Missing or invalid "title" field',
      );
      expect(() => ProblemSerializer.fromJson({ type: "test", title: "Test" })).toThrow(
        'Missing or invalid "status" field',
      );
      expect(() =>
        ProblemSerializer.fromJson({ type: "test", title: "Test", status: 400 }),
      ).toThrow('Missing or invalid "code" field');
    });

    it("should throw for invalid field types", () => {
      expect(() =>
        ProblemSerializer.fromJson({ type: 123, title: "Test", status: 400, code: "TEST" }),
      ).toThrow('Missing or invalid "type" field');
      expect(() =>
        ProblemSerializer.fromJson({ type: "test", title: 123, status: 400, code: "TEST" }),
      ).toThrow('Missing or invalid "title" field');
      expect(() =>
        ProblemSerializer.fromJson({ type: "test", title: "Test", status: "400", code: "TEST" }),
      ).toThrow('Missing or invalid "status" field');
      expect(() =>
        ProblemSerializer.fromJson({ type: "test", title: "Test", status: 400, code: 123 }),
      ).toThrow('Missing or invalid "code" field');
    });

    it.each([
      ["type", { type: "", title: "Test", status: 400, code: "TEST" }],
      ["title", { type: "test", title: "", status: 400, code: "TEST" }],
      ["code", { type: "test", title: "Test", status: 400, code: "" }],
    ])('should throw for an empty required "%s" field', (field, json) => {
      expectParseProblem(
        () => ProblemSerializer.fromJson(json),
        `Missing or invalid "${field}" field`,
      );
    });

    it.each([
      ["NaN", Number.NaN],
      ["positive infinity", Number.POSITIVE_INFINITY],
      ["negative infinity", Number.NEGATIVE_INFINITY],
      ["fraction", 400.5],
      ["below the HTTP status range", 99],
      ["above the HTTP status range", 600],
    ])("should throw for a %s status", (_case, status) => {
      expectParseProblem(
        () => ProblemSerializer.fromJson({ type: "test", title: "Test", status, code: "TEST" }),
        'Missing or invalid "status" field',
      );
    });

    it.each([100, 599])("should accept the HTTP status range boundary %i", (status) => {
      expect(
        ProblemSerializer.fromJson({ type: "test", title: "Test", status, code: "TEST" }),
      ).toMatchObject({ status });
    });

    it("should preserve a valid RFC 7807 round trip", () => {
      const problem = {
        type: "https://example.com/problems/not-found",
        title: "Not Found",
        status: 404,
        detail: "The user could not be found",
        instance: "/users/123",
        code: "USER_NOT_FOUND",
        traceId: "abc-123",
      };

      expect(ProblemSerializer.fromJson(JSON.parse(JSON.stringify(problem)))).toEqual(problem);
    });
  });
});

describe("ProblemExtensions validation", () => {
  describe("validateExtensions", () => {
    it("should validate valid extensions", () => {
      const extensions = { errors: ["error1"], count: 2 };
      const result = validateExtensions(extensions);
      expect(result).toEqual(extensions);
    });

    it("should validate empty object", () => {
      const result = validateExtensions({});
      expect(result).toEqual({});
    });

    it("should throw for non-object input", () => {
      expect(() => validateExtensions("string")).toThrow();
      expect(() => validateExtensions(123)).toThrow();
      expect(() => validateExtensions(null)).toThrow();
      expect(() => validateExtensions(undefined)).toThrow();
    });
  });

  describe("isValidExtensions", () => {
    it("should return true for valid extensions", () => {
      expect(isValidExtensions({ errors: [] })).toBe(true);
      expect(isValidExtensions({})).toBe(true);
    });

    it("should return false for invalid extensions", () => {
      expect(isValidExtensions("string")).toBe(false);
      expect(isValidExtensions(123)).toBe(false);
      expect(isValidExtensions(null)).toBe(false);
      expect(isValidExtensions(undefined)).toBe(false);
    });
  });
});
