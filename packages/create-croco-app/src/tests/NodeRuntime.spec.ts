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

    const repositoryToolchain = readFileSync(join(repositoryRoot, "mise.toml"), "utf8");

    expect(/^node = "(\d+)\.\d+\.\d+"$/m.exec(repositoryToolchain)?.[1]).toBe(
      GENERATED_NODE_VERSION,
    );
    expect(GENERATED_NODE_ENGINE_RANGE).toBe(rootPackageJson.engines?.node);
    expect(GENERATED_NODE_ENGINE_RANGE).toBe(generatorPackageJson.engines?.node);
  });

  it.each(["24.0.0", "25.1.0", "v26.0.0"])("accepts supported Node version %s", (version) => {
    expect(() => assertSupportedNodeVersion(version)).not.toThrow();
  });

  it.each(["20.19.0", "22.23.2", "v23.11.0", "invalid"])(
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
          minimumVersion: "24",
          recovery: expect.stringContaining("nvm install 24 && nvm use 24"),
        }),
      });
    },
  );
});
