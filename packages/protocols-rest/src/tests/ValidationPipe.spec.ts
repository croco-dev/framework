import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ValidationPipe } from "../libs/validators/ValidationPipe";
import { RequestValidationProblem } from "../libs/validators/ValidationProblem";

const QUERY_METADATA = { type: "query", name: "value" } as const;
const HEADER_METADATA = { type: "header", name: "x-scope" } as const;

describe("ValidationPipe", () => {
  it("should reject repeated values before a scalar catch schema can mask them", () => {
    const pipe = new ValidationPipe(z.string().catch("fallback"));
    let caught: unknown;

    try {
      pipe.transform(["first", "second"], QUERY_METADATA);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(RequestValidationProblem);
    expect(caught).toMatchObject({
      issues: [{ path: "query.value", message: "Expected a single query value" }],
    });
  });

  it("should reject repeated values with a stable message for a catch-free wrapped scalar", () => {
    const pipe = new ValidationPipe(z.string().optional());
    let caught: unknown;

    try {
      pipe.transform(["first", "second"], QUERY_METADATA);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(RequestValidationProblem);
    expect(caught).toMatchObject({
      issues: [{ path: "query.value", message: "Expected a single query value" }],
    });
  });

  it.each([
    ["coerced string", z.coerce.string()],
    ["coerced boolean", z.coerce.boolean()],
    [
      "preprocessed scalar",
      z.preprocess((value) => (Array.isArray(value) ? value.join(",") : value), z.string()),
    ],
  ])("should reject repeated values before a %s schema can reinterpret them", (_name, schema) => {
    const pipe = new ValidationPipe(schema);

    expect(() => pipe.transform(["first", "second"], QUERY_METADATA)).toThrowError(
      expect.objectContaining({
        issues: [{ path: "query.value", message: "Expected a single query value" }],
      }),
    );
  });

  it("should preserve scalar schema errors for a single query value", () => {
    const pipe = new ValidationPipe(z.number());

    expect(() => pipe.transform("first", QUERY_METADATA)).toThrowError(
      expect.objectContaining({
        issues: [{ path: "query.value", message: "Expected number, received string" }],
      }),
    );
  });

  it("should parse a single value with a scalar catch schema", () => {
    const pipe = new ValidationPipe(z.string().catch("fallback"));

    expect(pipe.transform("first", QUERY_METADATA)).toBe("first");
  });

  it("should normalize single and repeated values for a catch-wrapped array schema", () => {
    const pipe = new ValidationPipe(z.array(z.string()).catch([]));

    expect(pipe.transform("first", QUERY_METADATA)).toEqual(["first"]);
    expect(pipe.transform(["first", "second"], QUERY_METADATA)).toEqual(["first", "second"]);
  });

  it("should preserve an explicit catch fallback for a single invalid array query value", () => {
    const pipe = new ValidationPipe(z.array(z.string().min(2)).catch([]));

    expect(pipe.transform("a", QUERY_METADATA)).toEqual([]);
  });

  it("should preserve catch-free array element and refinement failures", () => {
    const elementPipe = new ValidationPipe(z.array(z.string().min(2)).catch([]));
    const refinementPipe = new ValidationPipe(
      z
        .array(z.string())
        .refine((values) => values.length >= 3, "Expected at least three values")
        .catch([]),
    );

    expect(() => elementPipe.transform(["a", "valid"], QUERY_METADATA)).toThrowError(
      expect.objectContaining({
        issues: [expect.objectContaining({ path: "query.0" })],
      }),
    );
    expect(() => refinementPipe.transform(["first", "second"], QUERY_METADATA)).toThrowError(
      expect.objectContaining({
        issues: [{ path: "query.value", message: "Expected at least three values" }],
      }),
    );
  });

  it.each([
    z.union([z.string().catch("fallback"), z.array(z.string())]),
    z.union([z.array(z.string()), z.string().catch("fallback")]),
  ])("should parse repeated values through catch unions without using fallbacks", (schema) => {
    const pipe = new ValidationPipe(schema);

    expect(pipe.transform("first", QUERY_METADATA)).toBe("first");
    expect(pipe.transform(["first", "second"], QUERY_METADATA)).toEqual(["first", "second"]);
  });

  it.each([z.union([z.string(), z.array(z.string())]), z.any(), z.unknown()])(
    "should preserve repeated values for schemas that accept arrays directly",
    (schema) => {
      const pipe = new ValidationPipe(schema);

      expect(pipe.transform(["first", "second"], QUERY_METADATA)).toEqual(["first", "second"]);
    },
  );

  it.each([
    z.union([z.coerce.string(), z.array(z.string())]),
    z.union([
      z.preprocess((value) => (Array.isArray(value) ? value.join(",") : value), z.string()),
      z.array(z.string()),
    ]),
  ])("should bypass scalar value-changing union branches for repeated values", (schema) => {
    const pipe = new ValidationPipe(schema);

    expect(pipe.transform(["first", "second"], QUERY_METADATA)).toEqual(["first", "second"]);
  });

  it("should normalize comma-separated and raw array headers for catch-wrapped arrays", () => {
    const pipe = new ValidationPipe(z.array(z.string()).catch([]));

    expect(pipe.transform("read, write", HEADER_METADATA)).toEqual(["read", "write"]);
    expect(pipe.transform(["read, write", "admin"], HEADER_METADATA)).toEqual([
      "read",
      "write",
      "admin",
    ]);
  });

  it("should preserve catch-free header array element and refinement failures", () => {
    const elementPipe = new ValidationPipe(z.array(z.string().min(2)).catch([]));
    const refinementPipe = new ValidationPipe(
      z
        .array(z.string())
        .refine((values) => values.length >= 3, "Expected at least three scopes")
        .catch([]),
    );

    expect(() => elementPipe.transform("a, valid", HEADER_METADATA)).toThrowError(
      expect.objectContaining({
        issues: [expect.objectContaining({ path: "headers.0" })],
      }),
    );
    expect(() => refinementPipe.transform("read, write", HEADER_METADATA)).toThrowError(
      expect.objectContaining({
        issues: [{ path: "headers.value", message: "Expected at least three scopes" }],
      }),
    );
  });

  it("should preserve catch fallbacks for missing array headers and invalid scalar headers", () => {
    const arrayPipe = new ValidationPipe(z.array(z.string()).catch([]));
    const scalarPipe = new ValidationPipe(z.string().min(3).catch("fallback"));

    expect(arrayPipe.transform(undefined, HEADER_METADATA)).toEqual([]);
    expect(scalarPipe.transform("x", HEADER_METADATA)).toBe("fallback");
  });
});
