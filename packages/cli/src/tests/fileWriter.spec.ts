import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fsPromises from "node:fs/promises";
import { writeFile, readFile, rm, mkdir, access, symlink } from "node:fs/promises";
import { join } from "node:path";
import {
  createCrocoCommandRuntime,
  logWriteResult,
  renderWriteResult,
  runWithCrocoCommandRuntime,
} from "../libs/cliRuntime.js";
import { write } from "../libs/fileWriter.js";

vi.mock("node:fs/promises", async (importOriginal) => ({
  ...(await importOriginal<typeof fsPromises>()),
}));

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

  it("should preserve exactly one complete writer when creating the same file concurrently", async () => {
    const contents = ["first-owner:한글\n".repeat(8193), "second-owner:終\n".repeat(4097)];
    const results = await Promise.all(
      contents.map((content) => write(targetPath, content, { overwrite: false })),
    );

    expect(results.map((result) => result.status).sort()).toEqual([
      "created",
      "exists-no-overwrite",
    ]);
    const winner = results.findIndex((result) => result.status === "created");
    expect(await readFile(targetPath)).toEqual(Buffer.from(contents[winner] ?? ""));
    expect(results.every((result) => result.diff === undefined)).toBe(true);

    expect(await write(targetPath, "retry must not replace the winner")).toEqual({
      status: "exists-no-overwrite",
      path: targetPath,
    });
    expect(await readFile(targetPath)).toEqual(Buffer.from(contents[winner] ?? ""));
  });

  it("should leave existing user content unchanged when overwrite is false", async () => {
    const original = Buffer.from("user-owned:α\n".repeat(71));
    await mkdir(join(tmpDir, "nested"), { recursive: true });
    await writeFile(targetPath, original);

    await expect(write(targetPath, "replacement", { overwrite: false })).resolves.toEqual({
      status: "exists-no-overwrite",
      path: targetPath,
    });
    expect(await readFile(targetPath)).toEqual(original);
  });

  it("should propagate filesystem failure and allow retry after its cause is removed", async () => {
    await mkdir(tmpDir, { recursive: true });
    await writeFile(join(tmpDir, "nested"), "parent is a user file");

    await expect(write(targetPath, "generated")).rejects.toMatchObject({ code: "EEXIST" });
    expect(await readFile(join(tmpDir, "nested"), "utf-8")).toBe("parent is a user file");
    await rm(join(tmpDir, "nested"));

    await expect(write(targetPath, "generated")).resolves.toMatchObject({ status: "created" });
    expect(await readFile(targetPath, "utf-8")).toBe("generated");
  });

  it("should preserve a dangling symlink instead of writing through it", async () => {
    await mkdir(join(tmpDir, "nested"), { recursive: true });
    const destination = join(tmpDir, "user-target.txt");
    await symlink(destination, targetPath);

    await expect(write(targetPath, "generated")).resolves.toEqual({
      status: "exists-no-overwrite",
      path: targetPath,
    });
    expect(await fsPromises.readlink(targetPath)).toBe(destination);
    await expect(access(destination)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it.each([false, true])(
    "should propagate a partial write failure with overwrite=%s and require explicit recovery",
    async (overwrite) => {
      if (overwrite) await writeExistingFile("previous user content");
      const failure = Object.assign(new Error("storage exhausted"), { code: "ENOSPC" });
      const realWriteFile = fsPromises.writeFile;
      const writer = vi.spyOn(fsPromises, "writeFile").mockImplementationOnce(async (path) => {
        await realWriteFile(path, "partial bytes");
        throw failure;
      });
      try {
        await expect(write(targetPath, "complete generated content", { overwrite })).rejects.toBe(
          failure,
        );
      } finally {
        writer.mockRestore();
      }

      expect(await readFile(targetPath, "utf-8")).toBe("partial bytes");
      await expect(write(targetPath, "implicit retry")).resolves.toMatchObject({
        status: "exists-no-overwrite",
      });
      expect(await readFile(targetPath, "utf-8")).toBe("partial bytes");
      await expect(
        write(targetPath, "recovered content", { overwrite: true }),
      ).resolves.toMatchObject({
        status: "overwritten",
      });
      expect(await readFile(targetPath, "utf-8")).toBe("recovered content");
    },
  );

  it("should keep dry-run read-only for a missing file", async () => {
    await expect(write(targetPath, "preview\n", { dryRun: true })).resolves.toEqual({
      status: "skipped-dry-run",
      path: targetPath,
      diff: "+2 lines",
    });
    await expect(access(tmpDir)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("should preserve the explicit overwrite content and diff contract", async () => {
    await writeExistingFile("old\n");
    const preview = await write(targetPath, "replacement\n", { dryRun: true });
    expect(await readFile(targetPath, "utf-8")).toBe("old\n");

    const result = await write(targetPath, "replacement\n", { overwrite: true });
    expect(result).toEqual({ status: "overwritten", path: targetPath, diff: preview.diff });
    expect(result.diff).toContain("-old\n+replacement\n");
    expect(await readFile(targetPath, "utf-8")).toBe("replacement\n");
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

describe("generated-file result rendering", () => {
  it("renders every write status with stable output", () => {
    expect([
      renderWriteResult({ status: "created", path: "/workspace/created.ts" }),
      renderWriteResult({ status: "overwritten", path: "/workspace/overwritten.ts" }),
      renderWriteResult({
        status: "skipped-dry-run",
        path: "/workspace/dry-run.ts",
        diff: "diff output",
      }),
      renderWriteResult({ status: "exists-no-overwrite", path: "/workspace/existing.ts" }),
    ]).toMatchInlineSnapshot(`
      [
        [
          "Created: /workspace/created.ts",
        ],
        [
          "Overwritten: /workspace/overwritten.ts",
        ],
        [
          "[Dry run] Would create: /workspace/dry-run.ts",
          "diff output",
        ],
        [
          "Skipped (exists): /workspace/existing.ts",
        ],
      ]
    `);
  });

  it("omits empty dry-run diffs", () => {
    expect(
      renderWriteResult({ status: "skipped-dry-run", path: "/workspace/file.ts", diff: "" }),
    ).toEqual(["[Dry run] Would create: /workspace/file.ts"]);
  });

  it("writes rendered output through the active command runtime", () => {
    const stdout: string[] = [];
    const runtime = createCrocoCommandRuntime({ stdout: (message) => stdout.push(message) });

    runWithCrocoCommandRuntime(runtime, () => {
      logWriteResult({ status: "created", path: "/workspace/file.ts" });
      logWriteResult(null);
    });

    expect(stdout).toEqual(["Created: /workspace/file.ts"]);
  });
});
