import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("CLI test contract", () => {
  it("keeps integration tests out of the unit test task", () => {
    const packageJson = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
    ) as { readonly scripts?: Readonly<Record<string, string>> };

    expect(packageJson.scripts?.test).toBe('vitest run --exclude "src/tests/integration/**"');
    expect(packageJson.scripts?.["test:e2e"]).toBe("vitest run src/tests/integration");
  });
});
