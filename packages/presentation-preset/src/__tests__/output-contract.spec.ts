import { describe, expect, it } from "vitest";

describe("OutputContract types", () => {
  it("compiles with valid BuildArtifact", () => {
    const artifact: import("../output-contract").BuildArtifact = {
      path: "index.js",
      format: "esm",
      type: "code",
    };
    expect(artifact.path).toBe("index.js");
  });

  it("compiles with valid OutputContract", () => {
    const contract: import("../output-contract").OutputContract = {
      presetName: "node",
      buildTime: new Date().toISOString(),
      format: "dual",
      artifacts: [
        { path: "index.js", format: "esm", type: "code" },
        { path: "index.cjs", format: "cjs", type: "code" },
        { path: "index.d.ts", format: "esm", type: "types" },
      ],
      entries: [{ exportName: ".", main: "index.js", cjs: "index.cjs", types: "index.d.ts" }],
    };
    expect(contract.presetName).toBe("node");
    expect(contract.artifacts.length).toBe(3);
  });

  it("accepts DeployTarget with runtime constraints", () => {
    const target: import("../output-contract").DeployTarget = {
      target: "lambda",
      output: {
        presetName: "lambda",
        buildTime: new Date().toISOString(),
        format: "dual",
        artifacts: [],
        entries: [],
      },
      runtime: {
        nodeVersion: "20.x",
        memory: 512,
        timeout: 30,
      },
    };
    expect(target.runtime?.nodeVersion).toBe("20.x");
  });
});
