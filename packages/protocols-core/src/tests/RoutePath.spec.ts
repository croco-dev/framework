import { describe, expect, it } from "vitest";
import { toRuntimeRoutePath } from "../libs/routePath";

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
