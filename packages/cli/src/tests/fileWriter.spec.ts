import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFile, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { write } from "../libs/fileWriter.js";

describe("write", () => {
  const tmpDir = "/tmp/croco-fw-test-" + Date.now();
  const targetPath = join(tmpDir, "nested", "file.txt");

  beforeEach(async () => {
    try {
      await rm(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  afterEach(async () => {
    try {
      await rm(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("should return status created for new file", async () => {
    const result = await write(targetPath, "hello world");
    expect(result.status).toBe("created");
    expect(result.path).toBe(targetPath);
  });

  it("should return status skipped-dry-run in dry-run mode", async () => {
    const result = await write(targetPath, "hello", { dryRun: true });
    expect(result.status).toBe("skipped-dry-run");
  });

  it("should return status exists-no-overwrite when file exists and overwrite is false", async () => {
    await mkdir(join(tmpDir, "nested"), { recursive: true });
    await writeFile(targetPath, "existing");
    const result = await write(targetPath, "new content");
    expect(result.status).toBe("exists-no-overwrite");
  });

  it("should return status overwritten when overwrite is true", async () => {
    await mkdir(join(tmpDir, "nested"), { recursive: true });
    await writeFile(targetPath, "old");
    const result = await write(targetPath, "new", { overwrite: true });
    expect(result.status).toBe("overwritten");
  });

  it("should render an inserted line without changing the following lines", async () => {
    await writeExistingFile("alpha\nbeta\ngamma\n");

    const result = await write(targetPath, "alpha\ninserted\nbeta\ngamma\n", { dryRun: true });

    expect(result.diff).toBe(
      [
        `--- ${targetPath}`,
        `+++ ${targetPath}`,
        "@@ -1,3 +1,4 @@",
        " alpha",
        "+inserted",
        " beta",
        " gamma",
      ].join("\n") + "\n",
    );
  });

  it("should render a deleted line with stable context", async () => {
    await writeExistingFile("alpha\nbeta\ngamma\ndelta\n");

    const result = await write(targetPath, "alpha\ngamma\ndelta\n", { dryRun: true });

    expect(result.diff).toBe(
      [
        `--- ${targetPath}`,
        `+++ ${targetPath}`,
        "@@ -1,4 +1,3 @@",
        " alpha",
        "-beta",
        " gamma",
        " delta",
      ].join("\n") + "\n",
    );
  });

  it("should render a replacement as removed and added lines", async () => {
    await writeExistingFile("alpha\nbeta\ngamma\n");

    const result = await write(targetPath, "alpha\nchanged\ngamma\n", { dryRun: true });

    expect(result.diff).toBe(
      [
        `--- ${targetPath}`,
        `+++ ${targetPath}`,
        "@@ -1,3 +1,3 @@",
        " alpha",
        "-beta",
        "+changed",
        " gamma",
      ].join("\n") + "\n",
    );
  });

  it("should render distant changes as separate hunks", async () => {
    const before = [
      "one",
      "two",
      "three",
      "four",
      "five",
      "six",
      "seven",
      "eight",
      "nine",
      "ten",
      "eleven",
      "twelve",
      "thirteen",
      "fourteen",
    ].join("\n");
    const after = before.replace("two", "TWO").replace("thirteen", "THIRTEEN");
    await writeExistingFile(before);

    const result = await write(targetPath, after, { dryRun: true });

    expect(result.diff).toBe(
      [
        `--- ${targetPath}`,
        `+++ ${targetPath}`,
        "@@ -1,5 +1,5 @@",
        " one",
        "-two",
        "+TWO",
        " three",
        " four",
        " five",
        "@@ -10,5 +10,5 @@",
        " ten",
        " eleven",
        " twelve",
        "-thirteen",
        "+THIRTEEN",
        " fourteen",
        "\\ No newline at end of file",
        "",
      ].join("\n"),
    );
  });

  it("should return an empty diff when content is unchanged", async () => {
    await writeExistingFile("alpha\nbeta\n");

    const result = await write(targetPath, "alpha\nbeta\n", { dryRun: true });

    expect(result.diff).toBe("");
  });

  it.each([
    {
      name: "adding",
      before: "alpha\nbeta",
      after: "alpha\nbeta\n",
      changedLine: "-beta\n\\ No newline at end of file\n+beta",
    },
    {
      name: "removing",
      before: "alpha\nbeta\n",
      after: "alpha\nbeta",
      changedLine: "-beta\n+beta\n\\ No newline at end of file",
    },
  ])("should represent $name the newline at EOF", async ({ before, after, changedLine }) => {
    await writeExistingFile(before);

    const result = await write(targetPath, after, { dryRun: true });

    expect(result.diff).toBe(
      [`--- ${targetPath}`, `+++ ${targetPath}`, "@@ -1,2 +1,2 @@", " alpha", changedLine].join(
        "\n",
      ) + "\n",
    );
  });

  it("should preserve an inserted blank line at EOF in the serialized diff", async () => {
    await writeExistingFile("same\n");

    const result = await write(targetPath, "same\n\n", { dryRun: true });

    expect(result.diff).toBe(
      [`--- ${targetPath}`, `+++ ${targetPath}`, "@@ -1,1 +1,2 @@", " same", "+", ""].join("\n"),
    );
  });

  it("should preserve alignment above the exact edit-distance limit", async () => {
    const before = Array.from({ length: 101 }, (_, index) => [`before ${index}`, `same ${index}`])
      .flat()
      .join("\n");
    const after = Array.from({ length: 101 }, (_, index) => [`after ${index}`, `same ${index}`])
      .flat()
      .join("\n");
    await writeExistingFile(before);

    const result = await write(targetPath, after, { dryRun: true });

    expect(result.diff).toContain("-before 0\n+after 0\n same 0\n");
    expect(result.diff).toContain("-before 1\n+after 1\n same 1\n");
    expect(result.diff).toMatch(
      /\n\.\.\. diff truncated \(showing first 199 of \d+ lines\) \.\.\.\n$/,
    );
  });

  it("should bound large diffs with an explicit truncation marker", async () => {
    const before = Array.from({ length: 300 }, (_, index) => `before ${index}`).join("\n");
    const after = Array.from({ length: 300 }, (_, index) => `after ${index}`).join("\n");
    await writeExistingFile(before);

    const result = await write(targetPath, after, { dryRun: true });
    const diffLines = result.diff?.trimEnd().split("\n") ?? [];

    expect(diffLines.length).toBeLessThanOrEqual(200);
    expect(diffLines.at(-1)).toMatch(
      /^\.\.\. diff truncated \(showing first \d+ of \d+ lines\) \.\.\.$/,
    );
    expect(result.diff).toContain("-before 0\n+after 0\n");
    expect(result.diff).toMatch(/\n$/);
  });

  async function writeExistingFile(content: string): Promise<void> {
    await mkdir(join(tmpDir, "nested"), { recursive: true });
    await writeFile(targetPath, content);
  }
});
