import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkOpenAPIOutput, serializeOpenAPIDocument } from "../libs/output";

describe("OpenAPI output verification", () => {
  let tempDirectory: string | undefined;

  afterEach(async () => {
    if (tempDirectory) {
      await rm(tempDirectory, { force: true, recursive: true });
      tempDirectory = undefined;
    }
  });

  it("checks unchanged output without changing bytes or mtime", async () => {
    const outFile = await createOutputFile();
    const expected = serializeOpenAPIDocument(createDocument());
    await writeFile(outFile, expected);
    const before = {
      content: await readFile(outFile),
      mtimeMs: (await stat(outFile)).mtimeMs,
    };

    await expect(checkOpenAPIOutput(outFile, expected)).resolves.toBeNull();
    await expect(
      Promise.all([readFile(outFile), stat(outFile)]).then(([content, metadata]) => ({
        content,
        mtimeMs: metadata.mtimeMs,
      })),
    ).resolves.toEqual(before);
  });

  it("reports changed output", async () => {
    const outFile = await createOutputFile();
    const expected = serializeOpenAPIDocument(createDocument());
    await writeFile(outFile, `${expected}\n`);

    await expect(checkOpenAPIOutput(outFile, expected)).resolves.toBe("changed");
  });

  it("reports missing output", async () => {
    const outFile = await createOutputFile();

    await expect(checkOpenAPIOutput(outFile, "{}")).resolves.toBe("missing");
  });

  async function createOutputFile(): Promise<string> {
    tempDirectory = await mkdtemp(join(tmpdir(), "croco-openapi-output-"));
    return join(tempDirectory, "openapi.json");
  }
});

function createDocument(): object {
  return {
    openapi: "3.1.0",
    info: { title: "Croco API", version: "1.0.0" },
    paths: {},
  };
}
