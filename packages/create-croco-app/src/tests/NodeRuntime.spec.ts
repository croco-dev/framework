import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { UnsupportedNodeVersionProblem } from "../libs/problems/UnsupportedNodeVersionProblem.js";
import {
  assertSupportedNodeVersion,
  GENERATED_NODE_ENGINE_RANGE,
  GENERATED_NODE_VERSION,
} from "../node-runtime.js";

describe("generated Node runtime contract", () => {
  it("matches the repository and published generator Node train", () => {
    const repositoryRoot = join(process.cwd(), "..", "..");
    const rootPackageJson = JSON.parse(
      readFileSync(join(repositoryRoot, "package.json"), "utf8"),
    ) as {
      engines?: { node?: unknown };
    };
    const generatorPackageJson = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8"),
    ) as {
      engines?: { node?: unknown };
    };

    const repositoryNodeVersion = readFileSync(join(repositoryRoot, ".nvmrc"), "utf8").trim();

    expect(repositoryNodeVersion.split(".")[0]).toBe(GENERATED_NODE_VERSION);
    expect(GENERATED_NODE_ENGINE_RANGE).toBe(rootPackageJson.engines?.node);
    expect(GENERATED_NODE_ENGINE_RANGE).toBe(generatorPackageJson.engines?.node);
  });

  it.each(["22.0.0", "23.1.0", "v24.0.0"])("accepts supported Node version %s", (version) => {
    expect(() => assertSupportedNodeVersion(version)).not.toThrow();
  });

  it.each(["18.20.8", "20.19.0", "invalid"])(
    "rejects unsupported Node version %s with recovery",
    (version) => {
      let error: unknown;

      try {
        assertSupportedNodeVersion(version);
      } catch (caught) {
        error = caught;
      }

      expect(error).toBeInstanceOf(UnsupportedNodeVersionProblem);
      expect(error).toMatchObject({
        code: "create-croco-app/unsupported-node-version",
        extensions: expect.objectContaining({
          actualVersion: version,
          minimumVersion: "22",
          recovery: expect.stringContaining("nvm install 22 && nvm use 22"),
        }),
      });
    },
  );
});
