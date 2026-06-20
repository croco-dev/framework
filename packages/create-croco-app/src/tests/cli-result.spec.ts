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
      nextSteps: ["cd /tmp/my-app", "pnpm install", "pnpm dev"],
    });
    expect(formatHumanSuccess(result)).toBe(
      [
        "Project created in /tmp/my-app.",
        "Next steps:",
        "  cd /tmp/my-app",
        "  pnpm install",
        "  pnpm dev",
      ].join("\n"),
    );
  });

  it("uses the SaaS API dev command for SaaS template next steps", () => {
    const result = createSuccessResult("/tmp/my-saas", createOptions({ preset: "saas" }));

    expect(result.nextSteps).toEqual(["cd /tmp/my-saas", "pnpm dev:api"]);
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
