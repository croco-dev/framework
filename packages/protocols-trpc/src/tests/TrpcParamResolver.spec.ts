import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createTrpcInputSchema } from "../libs/TrpcParamResolver";
import type { ParamIR, RouteIR } from "@croco/protocols-core";

const bodySchema = z.object({
  name: z
    .string()
    .min(1)
    .transform((name) => name.trim()),
});
const locationSchema = z.object({ page: z.coerce.number().int().positive() });

function createRoute(overrides: Partial<RouteIR> = {}): RouteIR {
  return {
    controllerName: "UserController",
    methodName: "create",
    httpMethod: "POST",
    path: "/users",
    routeContract: null,
    params: [{ index: 0, kind: "ctx", name: "", schema: null }],
    inputSchema: bodySchema,
    inputSchemas: { body: bodySchema, path: null, query: locationSchema, headers: null },
    outputSchema: null,
    domain: null,
    ...overrides,
  };
}

describe("createTrpcInputSchema", () => {
  const parameterCases: { name: string; params: ParamIR[] }[] = [
    {
      name: "context-only parameters",
      params: [{ index: 0, kind: "ctx", name: "", schema: null }],
    },
    { name: "no parameters", params: [] },
    {
      name: "a body parameter",
      params: [{ index: 0, kind: "body", name: "", schema: bodySchema }],
    },
  ];

  describe.each(parameterCases)("with $name", ({ params }) => {
    it.each(["path", "query", "headers"] as const)(
      "validates declared bodies alongside %s",
      (location) => {
        const schema = createTrpcInputSchema(
          createRoute({
            params,
            inputSchemas: {
              body: bodySchema,
              path: null,
              query: null,
              headers: null,
              [location]: locationSchema,
            },
          }),
        );

        expect(schema?.parse({ body: { name: " Alice " }, [location]: { page: "1" } })).toEqual({
          body: { name: "Alice" },
          [location]: { page: 1 },
        });
      },
    );
  });

  it.each([
    { query: { page: 1 } },
    { body: { name: "" }, query: { page: 1 } },
    { body: { name: "Alice" }, query: { page: 0 } },
    { body: { name: "Alice" }, query: { page: 1 }, unexpected: true },
  ])("rejects missing or invalid declared input and unknown envelope keys: %j", (input) => {
    const schema = createTrpcInputSchema(createRoute());

    expect(schema?.safeParse(input).success).toBe(false);
  });

  it("honors an optional body schema without a body parameter", () => {
    const schema = createTrpcInputSchema(
      createRoute({
        inputSchemas: {
          body: bodySchema.optional(),
          path: null,
          query: locationSchema,
          headers: null,
        },
      }),
    );

    expect(schema?.parse({ query: { page: 1 } })).toEqual({ query: { page: 1 } });
    expect(schema?.parse({ body: { name: "Alice" }, query: { page: 1 } })).toEqual({
      body: { name: "Alice" },
      query: { page: 1 },
    });
  });

  it("preserves schema-less body parameters in envelopes", () => {
    const schema = createTrpcInputSchema(
      createRoute({
        params: [{ index: 0, kind: "body", name: "", schema: null }],
        inputSchema: null,
        inputSchemas: { body: null, path: null, query: locationSchema, headers: null },
      }),
    );

    expect(schema?.parse({ body: "untyped body", query: { page: 1 } })).toEqual({
      body: "untyped body",
      query: { page: 1 },
    });
  });

  it("rejects bodies when neither a schema nor a body parameter declares them", () => {
    const schema = createTrpcInputSchema(
      createRoute({
        inputSchema: null,
        inputSchemas: { body: null, path: null, query: locationSchema, headers: null },
      }),
    );

    expect(schema?.safeParse({ body: {}, query: { page: 1 } }).success).toBe(false);
    expect(schema?.parse({ query: { page: 1 } })).toEqual({ query: { page: 1 } });
  });

  it("preserves the unwrapped schema for body-only routes", () => {
    const schema = createTrpcInputSchema(
      createRoute({
        inputSchemas: { body: bodySchema, path: null, query: null, headers: null },
      }),
    );

    expect(schema).toBe(bodySchema);
    expect(schema?.parse({ name: "Alice" })).toEqual({ name: "Alice" });
  });
});
