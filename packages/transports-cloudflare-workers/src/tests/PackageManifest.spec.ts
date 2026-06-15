import { describe, expect, it } from "vitest";
import packageJson from "../../package.json";

describe("package manifest", () => {
  it("should declare Cloudflare Workers runtime types as a public dependency", () => {
    expect(packageJson.dependencies).toMatchObject({
      "@cloudflare/workers-types": "^4.0.0",
    });
    expect(packageJson.devDependencies).not.toHaveProperty("@cloudflare/workers-types");
  });
});
