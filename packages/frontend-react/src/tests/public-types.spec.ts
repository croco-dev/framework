import { describe, expectTypeOf, it } from "vitest";

import type { CrocoDataFn, CrocoPageContext } from "../index";

describe("public types", () => {
  it("exports CrocoDataFn from the package entrypoint", () => {
    expectTypeOf<CrocoDataFn<{ readonly message: string }>>().parameters.toEqualTypeOf<
      [CrocoPageContext]
    >();
  });
});
