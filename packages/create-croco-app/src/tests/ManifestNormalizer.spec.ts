import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { rewriteExternalCrocoWorkspaceRanges } from "../helpers/manifest-normalizer.js";

describe("rewriteExternalCrocoWorkspaceRanges", () => {
  const directories: string[] = [];
  afterEach(() => {
    for (const directory of directories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("reports an unknown external dependency as a coded Problem without writing its manifest", () => {
    const directory = mkdtempSync(join(tmpdir(), "croco-manifest-"));
    directories.push(directory);
    const path = join(directory, "package.json");
    const content = JSON.stringify({ dependencies: { "@croco/unknown-package": "workspace:*" } });
    writeFileSync(path, content);

    expect(() => rewriteExternalCrocoWorkspaceRanges(directory)).toThrow(
      expect.objectContaining({
        code: "create-croco-app/published-dependency-range-missing",
        extensions: expect.objectContaining({ packageName: "@croco/unknown-package" }),
      }),
    );
    expect(readFileSync(path, "utf8")).toBe(content);
  });
});
