import { describe, expect, it } from "vitest";
import packageJson from "../../package.json";

describe("package manifest", () => {
  it("declares the tested TypeGraphQL runtime train and bounded TypeDI peer", () => {
    expect(packageJson.dependencies).toMatchObject({
      graphql: "^16.12.0",
      "graphql-scalars": "^1.25.0",
      "type-graphql": "^2.0.0-rc.3",
    });
    expect(packageJson.peerDependencies).toEqual({ typedi: "0.10.0" });
  });
});
