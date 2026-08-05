import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PnpmCommandProblem } from "../libs/problems/PnpmCommandProblem.js";
import type { GeneratorOptions } from "../types.js";

const execSyncMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", () => ({
  execSync: execSyncMock,
}));

const baseOptions: GeneratorOptions = {
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

describe("generate() pnpm install contract", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = `/tmp/croco-install-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    execSyncMock.mockReset();
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("runs pnpm install when dependency installation is enabled", async () => {
    const { generate } = await import("../generator.js");

    await generate(testDir, {
      ...baseOptions,
      installDeps: true,
    });

    expect(execSyncMock.mock.calls).toEqual([
      ["pnpm --version", { stdio: "ignore" }],
      ["pnpm install --no-frozen-lockfile", { cwd: testDir, stdio: "inherit" }],
      ["pnpm install --lockfile-only --frozen-lockfile", { cwd: testDir, stdio: "inherit" }],
    ]);
    expect(existsSync(join(testDir, "pnpm-workspace.yaml"))).toBe(true);
    expect(JSON.parse(readFileSync(join(testDir, "package.json"), "utf8")).packageManager).toBe(
      "pnpm@11.9.0",
    );
  }, 15_000);

  it("keeps --no-install as an escape hatch from pnpm", async () => {
    const { generate } = await import("../generator.js");

    await generate(testDir, baseOptions);

    expect(execSyncMock).not.toHaveBeenCalled();
    expect(existsSync(join(testDir, "pnpm-workspace.yaml"))).toBe(true);
  });

  it("reports an actionable Problem when pnpm is unavailable", async () => {
    const { generate } = await import("../generator.js");

    execSyncMock.mockImplementationOnce(() => {
      throw new Error("pnpm: command not found");
    });

    const error = await generate(testDir, {
      ...baseOptions,
      installDeps: true,
    }).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(PnpmCommandProblem);
    expect((error as PnpmCommandProblem).toJSON()).toMatchObject({
      code: "create-croco-app/pnpm-unavailable",
      stage: "availability-check",
      command: "pnpm --version",
      recovery: expect.stringContaining("--no-install"),
    });
  });

  it.each([
    {
      failedCall: 2,
      code: "create-croco-app/dependency-install-failed",
      stage: "dependency-install",
      command: "pnpm install --no-frozen-lockfile",
    },
    {
      failedCall: 3,
      code: "create-croco-app/lockfile-validation-failed",
      stage: "lockfile-validation",
      command: "pnpm install --lockfile-only --frozen-lockfile",
    },
  ])(
    "reports an actionable Problem when $stage fails",
    async ({ failedCall, code, stage, command }) => {
      const { generate } = await import("../generator.js");

      execSyncMock.mockImplementation((..._args: unknown[]) => {
        if (execSyncMock.mock.calls.length === failedCall) {
          throw new Error(`${command} failed`);
        }
      });

      const error = await generate(testDir, {
        ...baseOptions,
        installDeps: true,
      }).catch((cause: unknown) => cause);

      expect(error).toBeInstanceOf(PnpmCommandProblem);
      expect((error as PnpmCommandProblem).toJSON()).toMatchObject({
        code,
        stage,
        command,
        recovery: expect.stringContaining("--no-install"),
      });
    },
  );
});
