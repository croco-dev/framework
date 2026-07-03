import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

    expect(execSyncMock).toHaveBeenCalledWith("pnpm --version", { stdio: "ignore" });
    expect(execSyncMock).toHaveBeenCalledWith("pnpm install", {
      cwd: testDir,
      stdio: "inherit",
    });
    expect(existsSync(join(testDir, "pnpm-workspace.yaml"))).toBe(true);
    expect(JSON.parse(readFileSync(join(testDir, "package.json"), "utf8")).packageManager).toBe(
      "pnpm@10.15.1",
    );
  }, 15_000);

  it("keeps --no-install as an escape hatch from pnpm", async () => {
    const { generate } = await import("../generator.js");

    await generate(testDir, baseOptions);

    expect(execSyncMock).not.toHaveBeenCalled();
    expect(existsSync(join(testDir, "pnpm-workspace.yaml"))).toBe(true);
  });

  it("fails with an actionable pnpm requirement when pnpm is unavailable", async () => {
    const { generate } = await import("../generator.js");

    execSyncMock.mockImplementationOnce(() => {
      throw new Error("pnpm: command not found");
    });

    await expect(
      generate(testDir, {
        ...baseOptions,
        installDeps: true,
      }),
    ).rejects.toThrow(
      "create-croco-app installs dependencies with pnpm. Install pnpm or rerun with --no-install.",
    );
  });
});
