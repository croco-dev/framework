import type { Hono } from "hono";
import { describe, expectTypeOf, it } from "vitest";

import type {
  LambdaHandler,
  LambdaHandlerOptions,
  createLambdaHandler,
  createLambdaPreset,
} from "../index";

type LambdaApp = Hono | { readonly fetch: (req: Request) => Promise<Response> };

describe("public types", () => {
  it("does not expose no-op Lambda preset options", () => {
    expectTypeOf<typeof createLambdaPreset>().parameters.toEqualTypeOf<[]>();
  });

  it("exposes the transport Lambda handler options", () => {
    expectTypeOf<typeof createLambdaHandler>().parameters.toEqualTypeOf<
      [LambdaApp, LambdaHandlerOptions?]
    >();
    expectTypeOf<typeof createLambdaHandler>().returns.toEqualTypeOf<LambdaHandler>();
  });
});
