import { existsSync, rmSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProgram } from "../cli.js";
import {
  normalizeNonInteractiveOptions,
  parseCliOptions,
  validateCliOptions,
  validateResolvedOptions,
} from "../options.js";

const generateMock = vi.hoisted(() => vi.fn());

vi.mock("../generator.js", () => ({
  generate: generateMock,
}));

describe("noninteractive CLI option validation", () => {
  beforeEach(() => {
    generateMock.mockClear();
  });

  it("documents the pnpm-only install contract in CLI help", () => {
    const help = createProgram().helpInformation();

    expect(help).toContain("Create a pnpm-based Croco application");
    expect(help).toContain("--no-install");
    expect(help).toContain("Skip pnpm dependency installation");
    expect(help).not.toContain("--package-manager");
  });

  it("rejects ddd-api generation when --api is missing", () => {
    const cliOptions = parseCliOptions("my-api", {
      preset: "ddd-api",
      scope: "@test",
      install: false,
      git: false,
    });

    expect(() => normalizeNonInteractiveOptions(cliOptions)).toThrow(
      "--api is required for ddd-api and ddd-fullstack",
    );
  });

  it("rejects invalid enum values with actionable messages", () => {
    const cliOptions = parseCliOptions("my-api", {
      preset: "ddd-api",
      scope: "@test",
      api: "rest",
      install: false,
      git: false,
    });

    expect(() => normalizeNonInteractiveOptions(cliOptions)).toThrow(
      'Invalid --api value "rest". Expected graphql or trpc.',
    );
  });

  it("rejects empty scalar CLI values before prompt or generation", () => {
    const cliOptions = parseCliOptions("my-api", {
      preset: "ddd-api",
      scope: "",
      api: "trpc",
      install: false,
      git: false,
    });

    expect(() => validateCliOptions(cliOptions)).toThrow("Package scope is required");
  });

  it("rejects deployment flags for blank projects", () => {
    const cliOptions = parseCliOptions("my-blank", {
      preset: "blank",
      scope: "@test",
      frontendDeploy: "vercel",
      install: false,
      git: false,
    });

    expect(() => normalizeNonInteractiveOptions(cliOptions)).toThrow(
      "--frontend-deploy is not supported with the blank preset",
    );
  });

  it("rejects Next.js API hosting for multiple web apps", () => {
    const cliOptions = parseCliOptions("my-fullstack", {
      preset: "ddd-fullstack",
      scope: "@test",
      api: "trpc",
      apiHosting: "nextjs",
      webApps: "web,admin",
      install: false,
      git: false,
    });

    expect(() => normalizeNonInteractiveOptions(cliOptions)).toThrow(
      "--api-hosting nextjs requires exactly one web app",
    );
  });

  it("rejects invalid explicit --db values with actionable messages", () => {
    const cliOptions = parseCliOptions("my-api", {
      preset: "ddd-api",
      scope: "@test",
      api: "trpc",
      db: "mysql",
      install: false,
      git: false,
    });

    expect(() => normalizeNonInteractiveOptions(cliOptions)).toThrow(
      'Invalid --db value "mysql". Expected postgres, mongodb or redis.',
    );
  });

  it("rejects prompt-resolved incompatible options before generation", () => {
    expect(() =>
      validateResolvedOptions({
        projectName: "my-api",
        scope: "@test",
        preset: "ddd-api",
        webApps: ["web"],
        api: "trpc",
        apiHosting: "standalone",
        db: [],
        agentRules: false,
        installDeps: false,
        initGit: false,
      }),
    ).toThrow("--web-apps is only supported with the ddd-fullstack preset");
  });

  it("rejects invalid project names before generation", async () => {
    const targetDir = `/tmp/croco-invalid-name-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`process.exit: ${String(code)}`);
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      const program = createProgram();

      await expect(
        program.parseAsync(
          [
            `${targetDir}/InvalidName`,
            "--preset",
            "ddd-api",
            "--scope",
            "@test",
            "--api",
            "trpc",
            "--no-install",
            "--no-git",
          ],
          { from: "user" },
        ),
      ).rejects.toThrow("process.exit: 1");

      expect(errorSpy).toHaveBeenCalledWith(
        "\nError: Project name must contain only lowercase letters, numbers, hyphens, and underscores",
      );
      expect(existsSync(targetDir)).toBe(false);
    } finally {
      exitSpy.mockRestore();
      errorSpy.mockRestore();
      rmSync(targetDir, { recursive: true, force: true });
    }
  });

  it("rejects missing noninteractive --api before creating the target directory", async () => {
    const targetDir = `/tmp/croco-missing-api-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`process.exit: ${String(code)}`);
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      const program = createProgram();

      await expect(
        program.parseAsync(
          [targetDir, "--preset", "ddd-api", "--scope", "@test", "--no-install", "--no-git"],
          { from: "user" },
        ),
      ).rejects.toThrow("process.exit: 1");

      expect(errorSpy).toHaveBeenCalledWith(
        "\nError: --api is required for ddd-api and ddd-fullstack",
      );
      expect(existsSync(targetDir)).toBe(false);
    } finally {
      exitSpy.mockRestore();
      errorSpy.mockRestore();
      rmSync(targetDir, { recursive: true, force: true });
    }
  });

  it("accepts omitted optional --db in noninteractive CLI generation", async () => {
    const targetDir = `/tmp/croco-no-db-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const program = createProgram();

    await program.parseAsync(
      [
        targetDir,
        "--preset",
        "ddd-api",
        "--scope",
        "@test",
        "--api",
        "trpc",
        "--no-install",
        "--no-git",
      ],
      { from: "user" },
    );

    expect(generateMock).toHaveBeenCalledWith(
      targetDir,
      expect.objectContaining({
        projectName: targetDir.split("/").at(-1),
        db: [],
      }),
    );
  });

  it("normalizes safe noninteractive defaults for fullstack projects", () => {
    const cliOptions = parseCliOptions("my-fullstack", {
      preset: "ddd-fullstack",
      scope: "@test",
      api: "graphql",
      install: false,
      git: false,
      agentRules: false,
    });

    expect(normalizeNonInteractiveOptions(cliOptions)).toMatchObject({
      projectName: "my-fullstack",
      scope: "@test",
      preset: "ddd-fullstack",
      webApps: ["web"],
      api: "graphql",
      apiHosting: "standalone",
      db: [],
      agentRules: false,
      installDeps: false,
      initGit: false,
    });
  });
});
