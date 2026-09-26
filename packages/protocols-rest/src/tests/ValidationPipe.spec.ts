import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ValidationPipe } from "../libs/validators/ValidationPipe";
import { RequestValidationProblem } from "../libs/validators/ValidationProblem";

const QUERY_METADATA = { type: "query", name: "value" } as const;
const HEADER_METADATA = { type: "header", name: "x-scope" } as const;

describe("ValidationPipe", () => {
  it("should parse async refinements and map rejection to request issues", async () => {
    const pipe = new ValidationPipe(
      z.string().refine(async (value) => value !== "taken", "name is taken"),
    );

    await expect(pipe.transform("ada", QUERY_METADATA)).resolves.toBe("ada");
    await expect(pipe.transform("taken", QUERY_METADATA)).rejects.toThrowError(
      expect.objectContaining({
        issues: [{ path: "query.value", message: "name is taken" }],
      }),
    );
  });

  it("should reject repeated values before a scalar catch schema can mask them", async () => {
    const pipe = new ValidationPipe(z.string().catch("fallback"));
    let caught: unknown;

    try {
      await pipe.transform(["first", "second"], QUERY_METADATA);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(RequestValidationProblem);
    expect(caught).toMatchObject({
      issues: [{ path: "query.value", message: "Expected a single query value" }],
    });
  });

  it("should reject repeated values with a stable message for a catch-free wrapped scalar", async () => {
    const pipe = new ValidationPipe(z.string().optional());
    let caught: unknown;

    try {
      await pipe.transform(["first", "second"], QUERY_METADATA);
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
  ])(
    "should reject repeated values before a %s schema can reinterpret them",
    async (_name, schema) => {
      const pipe = new ValidationPipe(schema);

      await expect(pipe.transform(["first", "second"], QUERY_METADATA)).rejects.toThrowError(
        expect.objectContaining({
          issues: [{ path: "query.value", message: "Expected a single query value" }],
        }),
      );
    },
  );

  it("should preserve scalar schema errors for a single query value", async () => {
    const pipe = new ValidationPipe(z.number());

    await expect(pipe.transform("first", QUERY_METADATA)).rejects.toThrowError(
      expect.objectContaining({
        issues: [{ path: "query.value", message: "Expected number, received string" }],
      }),
    );
  });

  it("should parse a single value with a scalar catch schema", async () => {
    const pipe = new ValidationPipe(z.string().catch("fallback"));

    await expect(pipe.transform("first", QUERY_METADATA)).resolves.toBe("first");
  });

  it("should normalize single and repeated values for a catch-wrapped array schema", async () => {
    const pipe = new ValidationPipe(z.array(z.string()).catch([]));

    await expect(pipe.transform("first", QUERY_METADATA)).resolves.toEqual(["first"]);
    await expect(pipe.transform(["first", "second"], QUERY_METADATA)).resolves.toEqual([
      "first",
      "second",
    ]);
  });

  it("should preserve an explicit catch fallback for a single invalid array query value", async () => {
    const pipe = new ValidationPipe(z.array(z.string().min(2)).catch([]));

    await expect(pipe.transform("a", QUERY_METADATA)).resolves.toEqual([]);
  });

  it("should preserve catch-free array element and refinement failures", async () => {
    const elementPipe = new ValidationPipe(z.array(z.string().min(2)).catch([]));
    const refinementPipe = new ValidationPipe(
      z
        .array(z.string())
        .refine((values) => values.length >= 3, "Expected at least three values")
        .catch([]),
    );

    await expect(elementPipe.transform(["a", "valid"], QUERY_METADATA)).rejects.toThrowError(
      expect.objectContaining({
        issues: [expect.objectContaining({ path: "query.0" })],
      }),
    );
    await expect(
      refinementPipe.transform(["first", "second"], QUERY_METADATA),
    ).rejects.toThrowError(
      expect.objectContaining({
        issues: [{ path: "query.value", message: "Expected at least three values" }],
      }),
    );
  });

  it.each([
    z.union([z.string().catch("fallback"), z.array(z.string())]),
    z.union([z.array(z.string()), z.string().catch("fallback")]),
  ])(
    "should parse repeated values through catch unions without using fallbacks",
    async (schema) => {
      const pipe = new ValidationPipe(schema);

      await expect(pipe.transform("first", QUERY_METADATA)).resolves.toBe("first");
      await expect(pipe.transform(["first", "second"], QUERY_METADATA)).resolves.toEqual([
        "first",
        "second",
      ]);
    },
  );

  it.each([z.union([z.string(), z.array(z.string())]), z.any(), z.unknown()])(
    "should preserve repeated values for schemas that accept arrays directly",
    async (schema) => {
      const pipe = new ValidationPipe(schema);

      await expect(pipe.transform(["first", "second"], QUERY_METADATA)).resolves.toEqual([
        "first",
        "second",
      ]);
    },
  );

  it.each([
    z.union([z.coerce.string(), z.array(z.string())]),
    z.union([
      z.preprocess((value) => (Array.isArray(value) ? value.join(",") : value), z.string()),
      z.array(z.string()),
    ]),
  ])("should bypass scalar value-changing union branches for repeated values", async (schema) => {
    const pipe = new ValidationPipe(schema);

    await expect(pipe.transform(["first", "second"], QUERY_METADATA)).resolves.toEqual([
      "first",
      "second",
    ]);
  });

  it("should normalize comma-separated and raw array headers for catch-wrapped arrays", async () => {
    const pipe = new ValidationPipe(z.array(z.string()).catch([]));

    await expect(pipe.transform("read, write", HEADER_METADATA)).resolves.toEqual([
      "read",
      "write",
    ]);
    await expect(pipe.transform(["read, write", "admin"], HEADER_METADATA)).resolves.toEqual([
      "read",
      "write",
      "admin",
    ]);
  });

  it("should preserve catch-free header array element and refinement failures", async () => {
    const elementPipe = new ValidationPipe(z.array(z.string().min(2)).catch([]));
    const refinementPipe = new ValidationPipe(
      z
        .array(z.string())
        .refine((values) => values.length >= 3, "Expected at least three scopes")
        .catch([]),
    );

    await expect(elementPipe.transform("a, valid", HEADER_METADATA)).rejects.toThrowError(
      expect.objectContaining({
        issues: [expect.objectContaining({ path: "headers.0" })],
      }),
    );
    await expect(refinementPipe.transform("read, write", HEADER_METADATA)).rejects.toThrowError(
      expect.objectContaining({
        issues: [{ path: "headers.value", message: "Expected at least three scopes" }],
      }),
    );
  });

  it("should preserve catch fallbacks for missing array headers and invalid scalar headers", async () => {
    const arrayPipe = new ValidationPipe(z.array(z.string()).catch([]));
    const scalarPipe = new ValidationPipe(z.string().min(3).catch("fallback"));

    await expect(arrayPipe.transform(undefined, HEADER_METADATA)).resolves.toEqual([]);
    await expect(scalarPipe.transform("x", HEADER_METADATA)).resolves.toBe("fallback");
  });
});
