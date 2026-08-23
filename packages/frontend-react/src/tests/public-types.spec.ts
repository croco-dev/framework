import { describe, expectTypeOf, it } from "vitest";

import {
  PageDataUnavailableProblem,
  usePageData,
  useParsedPageData,
  useRequiredPageData,
} from "../index";

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
  it("exports honest page data access contracts", () => {
    type PageData = { readonly message: string };

    expectTypeOf(usePageData<PageData>).returns.toEqualTypeOf<PageData | undefined>();
    expectTypeOf(useRequiredPageData<PageData>).returns.toEqualTypeOf<PageData>();
    expectTypeOf(useParsedPageData<PageData>)
      .parameter(0)
      .toMatchTypeOf<{
        readonly parse: (input: unknown) => PageData;
      }>();
    expectTypeOf(useParsedPageData<PageData>).returns.toEqualTypeOf<PageData | undefined>();

    const parser = {
      parse: (input: unknown): PageData => ({ message: String(input) }),
    };
    const inferParsedPageData = () => useParsedPageData(parser);

    expectTypeOf(inferParsedPageData).returns.toEqualTypeOf<PageData | undefined>();
    expectTypeOf(PageDataUnavailableProblem).toBeConstructibleWith();
  });

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
