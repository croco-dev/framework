import { describe, expect, it } from "vitest";
import { toRouteMatchKey, toRuntimeRoutePath } from "../libs/routePath";

describe("toRuntimeRoutePath", () => {
  it("converts named catch-all parameters without changing ordinary parameters", () => {
    expect(toRuntimeRoutePath("/assets/:...path")).toBe("/assets/:path{.+}");
    expect(toRuntimeRoutePath("/:...path")).toBe("/:path{.+}");
    expect(toRuntimeRoutePath("/users/:id")).toBe("/users/:id");
  });

  it("leaves an unnamed catch-all token unchanged", () => {
    expect(toRuntimeRoutePath("/assets/:...")).toBe("/assets/:...");
  });
});

describe("toRouteMatchKey", () => {
  it.each([
    ["/users/:id", "/users/:userId", "/users/:"],
    ["/users/:id?", "/users/:userId?", "/users/:?"],
    ["/users/:id/posts/:postId", "/users/:userId/posts/:slug", "/users/:/posts/:"],
    ["/assets/:...path", "/assets/:...file", "/assets/:{.+}"],
    ["/assets/:...path", "/assets/:file{.+}", "/assets/:{.+}"],
    ["/users/:id{[0-9]+}", "/users/:userId{[0-9]+}", "/users/:{[0-9]+}"],
  ])("normalizes %s and %s to the same match key", (first, second, expected) => {
    expect(toRouteMatchKey(first)).toBe(expected);
    expect(toRouteMatchKey(second)).toBe(expected);
  });

  it("preserves static segments and distinct matcher constraints", () => {
    expect(toRouteMatchKey("/users/:id")).not.toBe(toRouteMatchKey("/teams/:id"));
    expect(toRouteMatchKey("/users/:id")).not.toBe(toRouteMatchKey("/users/:...id"));
    expect(toRouteMatchKey("/users/:id")).not.toBe(toRouteMatchKey("/users/:id?"));
    expect(toRouteMatchKey("/users/:id{[0-9]+}")).not.toBe(toRouteMatchKey("/users/:id{[a-z]+}"));
    expect(toRouteMatchKey("/users/current")).toBe("/users/current");
    expect(toRouteMatchKey("/actions:read")).toBe("/actions:read");
    expect(toRouteMatchKey("/actions:write")).toBe("/actions:write");
    expect(toRouteMatchKey("/assets/:...")).toBe("/assets/:...");
  });
});
