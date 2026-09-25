import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("published fact history entrypoints", () => {
  it("shares its input problem across CommonJS and ESM entrypoints", () => {
    const verifier = fileURLToPath(
      new URL("../../scripts/verify-built-fact-history-entrypoints.mjs", import.meta.url),
    );
    expect(() => execFileSync(process.execPath, [verifier])).not.toThrow();
  });
});
