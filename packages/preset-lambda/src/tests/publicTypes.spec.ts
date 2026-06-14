import type { Hono } from "hono";
import { describe, expectTypeOf, it } from "vitest";

import type { LambdaHandler, createLambdaHandler, createLambdaPreset } from "../index";

type LambdaApp = Hono | { readonly fetch: (req: Request) => Promise<Response> };

describe("public types", () => {
  it("does not expose no-op Lambda preset options", () => {
    expectTypeOf<typeof createLambdaPreset>().parameters.toEqualTypeOf<[]>();
  });

  it("does not expose no-op Lambda handler options", () => {
    expectTypeOf<typeof createLambdaHandler>().parameters.toEqualTypeOf<[LambdaApp]>();
    expectTypeOf<typeof createLambdaHandler>().returns.toEqualTypeOf<LambdaHandler>();
  });
});
