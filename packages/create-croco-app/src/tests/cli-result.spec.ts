import { describe, expect, it } from "vitest";
import {
  createFailureResult,
  createSuccessResult,
  formatHumanFailure,
  formatHumanSuccess,
} from "../cli-result.js";
import { DirectoryNotEmptyProblem } from "../libs/problems/DirectoryNotEmptyProblem.js";
import type { GeneratorOptions } from "../types.js";

describe("CLI result contract", () => {
  it("formats successful generation with target directory and next commands", () => {
    const result = createSuccessResult("/tmp/my-app", createOptions({ installDeps: false }));

    expect(result).toEqual({
      ok: true,
      code: "create-croco-app/project-created",
      targetDir: "/tmp/my-app",
      projectName: "my-app",
      preset: "blank",
      packageManager: "pnpm",
      nodeRequirement: ">=22",
      nodeRecovery: "Run nvm install 22 && nvm use 22.",
      nextSteps: [
        { command: "pnpm", args: ["install"], cwd: "/tmp/my-app" },
        { command: "pnpm", args: ["dev"], cwd: "/tmp/my-app" },
      ],
    });
    expect(formatHumanSuccess(result)).toBe(
      [
        "Project created in /tmp/my-app.",
        "Node.js >=22 is required for install and build. Recovery: Run nvm install 22 && nvm use 22.",
        "Next steps:",
        "  pnpm --dir /tmp/my-app install",
        "  pnpm --dir /tmp/my-app dev",
      ].join("\n"),
    );
  });

  it("uses the SaaS API dev command for SaaS template next steps", () => {
    const result = createSuccessResult("/tmp/my-saas", createOptions({ preset: "saas" }));

    expect(result.nextSteps).toEqual([{ command: "pnpm", args: ["dev:api"], cwd: "/tmp/my-saas" }]);
    expect(result.nodeRequirement).toBe(">=22.5");
    expect(result.nodeRecovery).toBe("Run nvm install 22.5 && nvm use 22.5.");
  });

  it("uses the SaaS Node contract for AI SaaS next steps", () => {
    const result = createSuccessResult("/tmp/my-ai-saas", createOptions({ preset: "ai-saas" }));

    expect(result.nodeRequirement).toBe(">=22.5");
    expect(result.nodeRecovery).toBe("Run nvm install 22.5 && nvm use 22.5.");
  });

  it("keeps shell quoting out of structured next steps", () => {
    const targetDir = "/tmp/Owen's Croco App";
    const result = createSuccessResult(targetDir, createOptions({ installDeps: false }));

    expect(result.nextSteps).toEqual([
      { command: "pnpm", args: ["install"], cwd: targetDir },
      { command: "pnpm", args: ["dev"], cwd: targetDir },
    ]);
    expect(formatHumanSuccess(result)).toContain("pnpm --dir '/tmp/Owen'\\''s Croco App' install");
  });

  it("formats Windows human next steps without cmd-specific cd switches", () => {
    const targetDir = "C:\\Users\\Owen\\Croco App";
    const result = createSuccessResult(targetDir, createOptions({ installDeps: false }));

    expect(formatHumanSuccess(result, "win32")).toContain(
      'pnpm --dir "C:\\Users\\Owen\\Croco App" install',
    );
    expect(formatHumanSuccess(result, "win32")).not.toContain("cd /d");
  });

  it("serializes filesystem Problems with stable code, reason, and recovery", () => {
    const result = createFailureResult(new DirectoryNotEmptyProblem("/tmp/existing"));

    expect(result).toMatchObject({
      ok: false,
      code: "create-croco-app/directory-not-empty",
      unexpected: false,
      recovery:
        "Choose an empty directory, remove the existing files, or pass a new target directory.",
      diagnostic: {
        code: "create-croco-app/directory-not-empty",
        detail: "Directory '/tmp/existing' is not empty.",
        status: 422,
      },
    });
    expect(formatHumanFailure(result)).toContain("Error [create-croco-app/directory-not-empty]");
    expect(formatHumanFailure(result)).toContain("Reason: Directory '/tmp/existing' is not empty.");
    expect(formatHumanFailure(result)).toContain("Recovery: Choose an empty directory");
  });

  it("keeps unexpected failures visibly unexpected", () => {
    const result = createFailureResult(new Error("write failed"));

    expect(result).toMatchObject({
      ok: false,
      code: "create-croco-app/unexpected-failure",
      unexpected: true,
      diagnostic: {
        code: "create-croco-app/unexpected-failure",
        detail: "write failed",
        status: 500,
      },
    });
    expect(formatHumanFailure(result)).toContain(
      "Unexpected error [create-croco-app/unexpected-failure]",
    );
  });
});

function createOptions(overrides: Partial<GeneratorOptions> = {}): GeneratorOptions {
  return {
    projectName: "my-app",
    scope: "@test",
    preset: "blank",
    webApps: [],
    apiHosting: "standalone",
    db: [],
    agentRules: false,
    installDeps: true,
    initGit: false,
    ...overrides,
  };
}
