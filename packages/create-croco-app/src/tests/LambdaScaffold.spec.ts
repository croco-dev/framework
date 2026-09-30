import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generate } from "../generator.js";

describe("Lambda scaffold API selection", () => {
  let targetDir: string;

  beforeEach(() => {
    targetDir = mkdtempSync(join(tmpdir(), "croco-lambda-scaffold-"));
  });

  afterEach(() => {
    rmSync(targetDir, { recursive: true, force: true });
  });

  it.each([
    { api: "graphql", selectedApp: "graphql-api", excludedApp: "api" },
    { api: "trpc", selectedApp: "api", excludedApp: "graphql-api" },
  ] as const)(
    "generates only the selected $api Lambda app",
    async ({ api, selectedApp, excludedApp }) => {
      await generate(targetDir, {
        projectName: "lambda-scaffold",
        scope: "@test",
        preset: "ddd-api",
        webApps: [],
        api,
        apiHosting: "standalone",
        backendDeploy: "lambda",
        db: [],
        agentRules: false,
        installDeps: false,
        initGit: false,
      });

      expect(existsSync(join(targetDir, "apps", excludedApp))).toBe(false);
      expect(existsSync(join(targetDir, "apps", selectedApp, "src", "handler.ts"))).toBe(true);
      expect(readFileSync(join(targetDir, "sst.config.ts"), "utf8")).toContain(
        `apps/${selectedApp}/src/handler.handler`,
      );
      const manifest = JSON.parse(
        readFileSync(join(targetDir, "apps", selectedApp, "package.json"), "utf8"),
      );
      expect(manifest.main).toBe("./src/handler.ts");
      expect(manifest.scripts.build).toContain("tsup src/handler.ts --format cjs --clean");
    },
  );
});
