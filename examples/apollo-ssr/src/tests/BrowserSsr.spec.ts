import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { beforeAll, describe, expect, it } from "vitest";

describe("BrowserSsr", () => {
  beforeAll(async () => {
    await promisify(execFile)("pnpm", ["run", "build"], {
      cwd: new URL("../..", import.meta.url),
      timeout: 50_000,
      maxBuffer: 1_000_000,
    });
  }, 55_000);

  it("hydrates the production build and isolates a late response after identity change on desktop and mobile", async () => {
    const { stdout } = await promisify(execFile)(process.execPath, ["browser-check.mjs"], {
      cwd: new URL("../..", import.meta.url),
      timeout: 60_000,
      maxBuffer: 1_000_000,
    });
    const evidence = stdout
      .split("\n")
      .filter((line) => line.startsWith("{"))
      .map((line) => JSON.parse(line));
    expect(evidence).toHaveLength(2);
    for (const result of evidence) {
      expect(result).toMatchObject({
        initialHydrationFetches: 0,
        nativeMutation: "14.00",
        transitionedPrice: "31.00",
        tenantPrice: "38.00",
        lateResponseIsolated: true,
        errors: [],
      });
    }
  }, 70_000);
});
