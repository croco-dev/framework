import { describe, expect, it } from "vitest";
import packageJson from "../../package.json";

describe("package manifest", () => {
  it("should declare direct GraphQL runtime and public type dependencies", () => {
    expect(packageJson.dependencies).toMatchObject({
      graphql: "^16.12.0",
      "graphql-scalars": "^1.25.0",
      "reflect-metadata": "^0.2.2",
      "type-graphql": "^2.0.0-rc.3",
    });
  });
});
