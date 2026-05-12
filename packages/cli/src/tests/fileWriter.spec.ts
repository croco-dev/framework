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
});
