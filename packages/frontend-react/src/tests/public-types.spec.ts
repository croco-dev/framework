import { describe, expectTypeOf, it } from "vitest";

import type {
  CrocoDataFn,
  CrocoPageContext,
  FrontendAuthBridgeState,
  FrontendAuthGateState,
  FrontendPermissionCheck,
  ProblemPanelProps,
  ProblemRecoveryAction,
} from "../index";

describe("public types", () => {
  it("exports CrocoDataFn from the package entrypoint", () => {
    expectTypeOf<CrocoDataFn<{ readonly message: string }>>().parameters.toEqualTypeOf<
      [CrocoPageContext]
    >();
  });

  it("exports auth bridge contracts from the package entrypoint", () => {
    expectTypeOf<FrontendAuthBridgeState>().toHaveProperty("session");
    expectTypeOf<FrontendAuthGateState>().toMatchTypeOf<
      | { readonly kind: "allowed" }
      | { readonly kind: "loading" }
      | { readonly kind: "denied" }
      | { readonly kind: "unauthenticated" }
      | { readonly kind: "unavailable" }
    >();
    expectTypeOf<FrontendPermissionCheck>().toHaveProperty("permission").toEqualTypeOf<string>();
  });

  it("exports Problem UI contracts from the package entrypoint", () => {
    expectTypeOf<ProblemPanelProps>().toHaveProperty("problem");
    expectTypeOf<ProblemRecoveryAction>()
      .toHaveProperty("kind")
      .toEqualTypeOf<
        | "retry"
        | "signIn"
        | "requestAccess"
        | "changeTenant"
        | "contactSupport"
        | "custom"
        | undefined
      >();
  });
});
