import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createFrameworkManifest } from "../framework-manifest";

describe("generated artifact ignore policy", () => {
  it.each([
    ["/.croco/build/", ".", true],
    [".croco/build/", ".", true],
    ["**/.croco/build", ".", true],
    ["/apps/api/.croco/build/", "apps/api", true],
    ["apps/api/.croco/build/", "apps/api", true],
    ["**/.croco/build", "apps/api", true],
    ["/.croco/build/", "apps/api", false],
    ["/.croco/build-extra/", ".", false],
    ["/.croco/build/routes.mjs.bak", ".", false],
    ["/other/.croco/build/", ".", false],
  ])(
    "applies %s relative to its ignore file for project %s (ignored: %s)",
    (rule, project, ignored) => {
      const root = mkdtempSync(join(tmpdir(), "croco-artifact-ignore-"));
      try {
        writeFileSync(join(root, ".gitignore"), `${rule}\n`);
        const projectRoot = join(root, project);
        mkdirSync(projectRoot, { recursive: true });
        const manifest = createFrameworkManifest({ projectRoot, sourcePaths: [] });
        expect(manifest.generatedArtifacts.map((artifact) => artifact.path)).toEqual([
          ".croco/build/framework-manifest.json",
          ".croco/build/intent-map.json",
          ".croco/build/route-registration-table.json",
          ".croco/build/routes.mjs",
        ]);
        for (const artifact of manifest.generatedArtifacts) {
          expect(artifact.gitIgnored, artifact.path).toBe(ignored);
          expect(artifact.commitPolicy, artifact.path).toBe(
            ignored ? "gitignored-generated" : "commit-required",
          );
          expect(artifact.gitIgnoreRule, artifact.path).toBe(ignored ? rule : undefined);
        }
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
  );
});
