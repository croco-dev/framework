import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
describe("published acquisition entrypoints", () => {
  it("classifies the canonical acquisition Problems in CJS and ESM without hiding persistence failures", () => {
    const verifier = fileURLToPath(
      new URL("../../scripts/verify-built-acquisition-entrypoints.mjs", import.meta.url),
    );
    expect(execFileSync(process.execPath, [verifier], { encoding: "utf8" })).toContain(
      "CJS and ESM acquisition operations preserve denied, bounded and failed lookup results.",
    );
  });
});
