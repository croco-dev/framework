import { OutputContractValidator } from "@croco/presentation-preset";
import { describe, expect, it } from "vitest";

import { createMetaOutputContract } from "../libs/output/outputContract";

describe("createMetaOutputContract", () => {
  it("creates a valid multi-environment output contract", () => {
    const contract = createMetaOutputContract({
      presetName: "meta-vite",
      clientEntry: "client/index.js",
      ssrEntry: "ssr/entry.js",
      rscEntry: "rsc/entry.js",
    });
    const report = new OutputContractValidator().validate(contract);

    expect(report.results.filter((result) => result.severity === "error")).toHaveLength(0);
    expect(report.passed).toBe(true);
    expect(contract.entries.map((entry) => entry.exportName)).toEqual([
      "./client",
      "./ssr",
      "./rsc",
    ]);
    expect(contract.entries).toEqual([
      { exportName: "./client", main: "client/index.js", types: "client/index.d.ts" },
      { exportName: "./ssr", main: "ssr/entry.js", types: "ssr/entry.d.ts" },
      { exportName: "./rsc", main: "rsc/entry.js", types: "rsc/entry.d.ts" },
    ]);
    expect(contract.artifacts).toEqual(
      expect.arrayContaining([
        { path: "client/index.js", format: "esm", type: "code" },
        { path: "ssr/entry.js", format: "esm", type: "code" },
        { path: "rsc/entry.js", format: "esm", type: "code" },
        { path: "client/index.html", format: "esm", type: "asset" },
        { path: "client/style.css", format: "esm", type: "asset" },
      ]),
    );
  });
});
