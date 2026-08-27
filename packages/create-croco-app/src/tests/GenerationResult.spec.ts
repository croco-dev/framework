import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generate } from "../generator.js";
import { resolveGoalOptions } from "../goals.js";
import type { GeneratorOptions } from "../generator.js";

describe("GenerationResult", () => {
  let testRoot: string;

  beforeEach(() => {
    testRoot = mkdtempSync(join(tmpdir(), "croco-generation-result-"));
  });

  afterEach(() => {
    rmSync(testRoot, { recursive: true, force: true });
  });

  it("returns the published canonical target, resolved choices, artifacts, and next commands", async () => {
    const requestedTarget = join(testRoot, "nested", "..", "my-blank");
    const options = { ...createBlankOptions(), wrapperSecret: "must-not-leak" };

    const result = await generate(requestedTarget, options);

    expect(result).toMatchObject({
      ok: true,
      code: "create-croco-app/project-created",
      targetDir: resolve(requestedTarget),
      projectName: "my-blank",
      preset: "blank",
      packageManager: "pnpm",
      nodeRequirement: ">=22",
      postActions: {
        git: "skipped",
        dependencies: "skipped",
      },
      configuration: {
        projectName: "my-blank",
        scope: "@test",
        preset: "blank",
        webApps: [],
        apiHosting: "standalone",
        runtimePlatform: "node",
        db: [],
        agentRules: false,
        installDeps: false,
        initGit: false,
      },
      artifacts: [
        { kind: "project-manifest", path: "package.json" },
        { kind: "node-runtime", path: ".nvmrc" },
        { kind: "runtime-capability", path: "croco-runtime-capability.manifest.json" },
      ],
      nextSteps: [
        { command: "pnpm", args: ["install"], cwd: resolve(requestedTarget) },
        { command: "pnpm", args: ["dev"], cwd: resolve(requestedTarget) },
      ],
    });
    expect(existsSync(result.targetDir)).toBe(true);

    options.webApps.push("mutated-after-generation");
    options.db.push("redis");
    expect(result.configuration.webApps).toEqual([]);
    expect(result.configuration.db).toEqual([]);
    expect(result.configuration).not.toHaveProperty("wrapperSecret");
  });

  it("reports effective SaaS defaults, goal intent, and every generated root contract", async () => {
    const targetDir = join(testRoot, "my-saas");
    const options = resolveGoalOptions("my-saas", "@test", "saas-api", {
      installDeps: false,
      initGit: false,
    });

    const result = await generate(targetDir, options);

    expect(result.configuration).toMatchObject({
      goal: "saas-api",
      preset: "saas",
      saasProviderProfile: "saas-node-postgres",
      tenantModel: "org",
      runtimePlatform: "node",
    });
    expect(result.artifacts).toEqual([
      { kind: "project-manifest", path: "package.json" },
      { kind: "node-runtime", path: ".nvmrc" },
      { kind: "runtime-capability", path: "croco-runtime-capability.manifest.json" },
      { kind: "application-intent", path: "croco.app.json" },
      { kind: "provider-profile", path: "croco-saas-profile.manifest.json" },
      { kind: "tenant-model", path: "croco-tenant-model.manifest.json" },
      { kind: "tenant-model-schema", path: "croco-tenant-model.schema.json" },
      { kind: "runtime-policy", path: "croco-runtime-policy.manifest.json" },
      { kind: "architecture-policy", path: "croco.arch.json" },
    ]);
    expect(result.nextSteps).toEqual([
      { command: "pnpm", args: ["install"], cwd: targetDir },
      { command: "pnpm", args: ["dev:api"], cwd: targetDir },
    ]);
  });
});

function createBlankOptions(): GeneratorOptions {
  return {
    projectName: "my-blank",
    scope: "@test",
    preset: "blank",
    webApps: [],
    apiHosting: "standalone",
    db: [],
    agentRules: false,
    installDeps: false,
    initGit: false,
  };
}
