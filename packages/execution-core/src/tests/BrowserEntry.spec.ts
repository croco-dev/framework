import { resolve } from "node:path";
import { build } from "esbuild";
import { describe, expect, it } from "vitest";

describe("browser entry", () => {
  it("bundles the public runtime entry without Node built-ins", async () => {
    const result = await build({
      bundle: true,
      entryPoints: [resolve(import.meta.dirname, "../index.ts")],
      format: "esm",
      logLevel: "silent",
      platform: "browser",
      write: false,
    });

    expect(result.outputFiles).toHaveLength(1);
  });
});
