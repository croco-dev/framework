import { describe, expect, it } from "vitest";

import { fieldMatchesPath } from "../package-manifest-contracts.mjs";

describe("package-manifest-contracts", () => {
  it("compares root and publish fields without object key order sensitivity", () => {
    const source = {
      exports: {
        ".": {
          import: "./dist/index.mjs",
          require: "./dist/index.js",
          types: "./dist/index.d.ts",
        },
      },
      publishConfig: {
        exports: {
          ".": {
            types: "./dist/index.d.ts",
            require: "./dist/index.js",
            import: "./dist/index.mjs",
          },
        },
      },
    };

    expect(fieldMatchesPath(source, "exports", "publishConfig.exports")).toBe(true);
  });

  it("keeps array values order-sensitive", () => {
    const source = {
      files: ["dist", "templates"],
      publishConfig: {
        files: ["templates", "dist"],
      },
    };

    expect(fieldMatchesPath(source, "files", "publishConfig.files")).toBe(false);
  });
});
