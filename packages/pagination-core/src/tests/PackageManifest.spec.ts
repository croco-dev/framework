import { describe, expect, it } from "vitest";
import packageJson from "../../package.json";

describe("package manifest", () => {
  it("should declare zod as a runtime dependency for exported schemas", () => {
    expect(packageJson.dependencies).toMatchObject({
      zod: "4.3.6",
    });
  });
});
