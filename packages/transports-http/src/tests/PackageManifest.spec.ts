import { describe, expect, it } from "vitest";
import packageJson from "../../package.json";

describe("package manifest", () => {
  it("should declare zod as a runtime dependency for exported ParamResolver types", () => {
    expect(packageJson.dependencies).toMatchObject({
      zod: "^3.23.8",
    });
  });
});
