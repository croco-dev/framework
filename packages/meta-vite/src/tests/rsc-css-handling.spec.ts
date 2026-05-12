import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures/rsc-basic");
const cssFixturePath = join(fixtureDir, "rsc-style.css");

async function importCssFixture(specifier: string) {
  try {
    return { loaded: true, value: await import(specifier) } as const;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return { loaded: false, message } as const;
  }
}

describe("rsc css handling", () => {
  it("documents raw CSS import behavior in the test runtime", async () => {
    const source = await readFile(cssFixturePath, "utf8");
    const result = await importCssFixture(pathToFileURL(cssFixturePath).href);

    expect(source).toContain(".rsc-basic");
    if (result.loaded) {
      expect(result.value).toBeDefined();
      return;
    }

    expect(result.message).toMatch(/Unknown file extension|Cannot find module|failed to load/i);
  });

  it("documents virtual CSS ?direct import behavior in the test runtime", async () => {
    const source = await readFile(cssFixturePath, "utf8");
    const result = await importCssFixture(`${pathToFileURL(cssFixturePath).href}?direct`);

    expect(source).toContain("color:");
    if (result.loaded) {
      expect(result.value).toBeDefined();
      return;
    }

    expect(result.message).toMatch(/Unknown file extension|Cannot find module|failed to load/i);
  });
});
